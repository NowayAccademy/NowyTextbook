# セキュリティと権限
ロール・GRANT/REVOKE・SQLインジェクション対策・マスキングを学びます

## 本章の目標

本章では以下を目標にして学習します。

- PostgreSQLのロールとユーザーの概念を説明できること
- GRANT/REVOKEで適切な権限設定ができること
- 最小権限の原則を実践できること
- SQLインジェクションの仕組みと対策を説明できること
- プリペアドステートメントを使った安全なDB接続を実装できること
- 本番データのマスキングの必要性と方法を説明できること
- pg_hba.confの役割を説明できること

---

## 1. PostgreSQLのロール（role）とユーザーの概念

### ロールとユーザーの関係

PostgreSQLでは「ユーザー」と「ロール」は本質的に同じ概念です。`CREATE USER` は `LOGIN` 権限を持つロールを作成する短縮形です。

```sql
-- CREATE USER と CREATE ROLE + LOGIN は同じ意味
CREATE USER app_user WITH PASSWORD 'app_password';
-- 上記は以下と同等
CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';

-- LOGINなしのロール（グループとして使う）
CREATE ROLE readonly_role;

-- ロールのリストを確認
\du   -- psqlコマンド

-- または
SELECT rolname, rolsuper, rolcreatedb, rolcanlogin
FROM pg_roles
ORDER BY rolname;
```

### ロールの継承（グループとしてのロール）

ロールは他のロールを「メンバー」として持てます。これにより、権限のグループ管理ができます。

```sql
-- グループロールを作成（LOGINなし）
CREATE ROLE app_readonly;
CREATE ROLE app_readwrite;

-- ユーザーを作成（LOGINあり）
CREATE USER alice WITH PASSWORD 'alice_password';
CREATE USER bob   WITH PASSWORD 'bob_password';

-- ユーザーをグループロールに追加
GRANT app_readonly  TO alice;
GRANT app_readwrite TO bob;

-- ロールのメンバーシップを確認
SELECT
    r.rolname AS role_name,
    m.rolname AS member_name
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.roleid
JOIN pg_roles m ON m.oid = am.member
ORDER BY r.rolname, m.rolname;
```

> **ポイント**  
> ロールを使ったグループ管理により、「新しいメンバーが来たら適切なロールを付与するだけ」で権限設定が完了します。個別のユーザーに直接権限を付与すると、管理が複雑になります。

> **現場メモ**  
> 「ロールでグループ管理しよう」とわかっていても、リリースが急ぐと「とりあえずALL PRIVILEGESで」という判断になりがちです。筆者が関わったプロジェクトでは、開発初期にアプリユーザーへ `ALL PRIVILEGES` を付与したまま本番リリースしてしまい、後から最小権限に絞り直す作業が大変でした。新規テーブルを追加するたびに「このユーザーには何の権限が必要か」を確認しなければならず、抜け漏れも多発しました。権限設計はDBスキーマ設計と同時に行い、`ALTER DEFAULT PRIVILEGES` を使って新規テーブルにも自動で適用される設定をしておくことを推奨します。

---

## 2. GRANT / REVOKE の構文

### GRANTで権限を付与する

```sql
-- テーブルへのSELECT権限を付与
GRANT SELECT ON users TO alice;

-- 複数の権限を一括付与
GRANT SELECT, INSERT, UPDATE ON orders TO bob;

-- テーブルへの全権限を付与
GRANT ALL PRIVILEGES ON orders TO bob;

-- スキーマ内の全テーブルへの権限を付与
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;

-- 将来作成されるテーブルへのデフォルト権限を設定
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO app_readonly;

-- シーケンスへのUSAGE権限（INSERT時に必要）
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;

-- スキーマへのUSAGE権限（テーブルにアクセスするために必要）
GRANT USAGE ON SCHEMA public TO app_readonly;
GRANT USAGE ON SCHEMA public TO app_readwrite;
```

### REVOKEで権限を剥奪する

```sql
-- SELECT権限を剥奪
REVOKE SELECT ON users FROM alice;

-- 全権限を剥奪
REVOKE ALL PRIVILEGES ON orders FROM bob;

-- スキーマ内の全テーブルから権限を剥奪
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM app_readonly;
```

### 権限の確認

```sql
-- テーブルへの権限を確認
SELECT
    grantee,
    table_name,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
ORDER BY table_name, grantee;

-- psqlコマンド（テーブルの権限を見やすく表示）
\dp users
```

> **ポイント**  
> `GRANT ... WITH GRANT OPTION` を付けると、権限を付与されたユーザーが他のユーザーに同じ権限をさらに付与できます。通常の業務ユーザーにはこのオプションは付けないようにしましょう。

---

## 3. 最小権限の原則

**最小権限の原則（Principle of Least Privilege）** とは、ユーザー（またはアプリケーション）に対して、業務に必要な最小限の権限だけを与えるというセキュリティの基本原則です。

### 悪い例：全権限を持つアプリユーザー

```sql
-- 悪い例：アプリが管理者権限でDBに接続している
-- もしアプリが乗っ取られたら、DBの全データを読み書き・削除できる
CREATE USER myapp WITH PASSWORD 'password' SUPERUSER;
```

### 良い例：用途別のユーザー設計

```sql
-- 読み取り専用ユーザー（レポート・分析用）
CREATE USER myapp_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE myapp TO myapp_readonly;
GRANT USAGE ON SCHEMA public TO myapp_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO myapp_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO myapp_readonly;

-- アプリ用ユーザー（CRUD操作のみ。DDLは不可）
CREATE USER myapp_app WITH PASSWORD 'app_password';
GRANT CONNECT ON DATABASE myapp TO myapp_app;
GRANT USAGE ON SCHEMA public TO myapp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO myapp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO myapp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO myapp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO myapp_app;

-- マイグレーション用ユーザー（DDL操作が必要）
CREATE USER myapp_migrate WITH PASSWORD 'migrate_password';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myapp_migrate;
-- または特定スキーマの全権限
GRANT ALL ON SCHEMA public TO myapp_migrate;
```

### 権限マトリクスの例

| ユーザー | 目的 | SELECT | INSERT | UPDATE | DELETE | CREATE/DROP |
| --- | --- | --- | --- | --- | --- | --- |
| `myapp_app` | アプリ | ○ | ○ | ○ | ○（一部） | × |
| `myapp_readonly` | レポート | ○ | × | × | × | × |
| `myapp_migrate` | スキーマ変更 | ○ | ○ | ○ | ○ | ○ |
| `postgres` | 管理 | ○ | ○ | ○ | ○ | ○ |

> **ポイント**  
> アプリケーションのDBユーザーには、本当に必要なテーブルへの最小権限だけを付与しましょう。「面倒だからALL PRIVILEGES」は、セキュリティインシデントが起きたときの被害範囲を広げます。

---

## 4. スーパーユーザーの危険性

### スーパーユーザーとは

`postgres` はPostgreSQLインストール時に作成されるスーパーユーザーです。スーパーユーザーはすべての権限チェックをバイパスし、DBのあらゆる操作が可能です。

```sql
-- スーパーユーザーの作成（慎重に）
CREATE ROLE admin_user WITH SUPERUSER LOGIN PASSWORD 'strong_password';

-- スーパーユーザーの確認
SELECT rolname, rolsuper FROM pg_roles WHERE rolsuper = true;
```

### スーパーユーザーを使ってはいけない場面

```sql
-- NG：アプリケーションのDB接続にスーパーユーザーを使う
DATABASE_URL=postgresql://postgres:postgres@localhost/myapp

-- OK：専用のアプリユーザーを作って接続する
DATABASE_URL=postgresql://myapp_app:app_password@localhost/myapp
```

> **注意**  
> `postgres` ユーザーのパスワードはデフォルトで空またはOSユーザー認証のことがあります。インストール後すぐに強いパスワードを設定してください。また、アプリからの接続には絶対に `postgres` ユーザーを使わないでください。万が一アプリの脆弱性を突かれた場合、DB全体が危険にさらされます。

> **現場メモ**  
> 開発環境・ステージング・本番で同じDBパスワードを使い回しているチームを見かけることがあります。「どうせ社内環境だから」という気持ちはわかりますが、開発者が誤って本番の接続文字列を使ってしまうリスクがあります。また、退職したエンジニアが開発環境のパスワードを知っていた場合、同じパスワードを使い回していると本番DBへのアクセスが続いてしまいます。環境ごとに異なるパスワード・ユーザーを設定し、本番のクレデンシャルは担当者のみが管理する仕組みを作ることが重要です。AWSであればSecrets Manager、GCPであればSecret Managerを使った動的なクレデンシャル管理が業界標準になっています。

---

## 5. SQLインジェクションとは（攻撃例で説明）

**SQLインジェクション** とは、ユーザーからの入力に悪意のあるSQL文を混入させ、意図しないDB操作を引き起こす攻撃手法です。Web攻撃の中でも特に被害が大きく、個人情報漏洩の原因として頻繁に報告されています。

### 脆弱なコードの例

```python
# 非常に危険なコード（絶対に書いてはいけない）
user_input = request.form['user_id']

# ユーザーが "1 OR 1=1" と入力した場合...
query = f"SELECT * FROM users WHERE id = {user_input}"
# → SELECT * FROM users WHERE id = 1 OR 1=1
# → WHERE 1=1 は常にTRUE なので全件が返ってしまう！
```

### 典型的な攻撃パターン

```sql
-- ログイン画面への攻撃
-- 入力: ' OR '1'='1' --
SELECT * FROM users WHERE email = '' OR '1'='1' --' AND password = '...';
-- '1'='1'は常にTRUEなので、どんな認証も通過してしまう

-- UNION攻撃（他テーブルのデータを取得）
-- 入力: 1 UNION SELECT id, password, 3, 4 FROM users--
SELECT name, email FROM products WHERE id = 1
UNION SELECT id, password, 3, 4 FROM users--;
-- usersテーブルのパスワードが取得される！

-- DROP TABLEの埋め込み（データ破壊）
-- 入力: 1; DROP TABLE users; --
SELECT * FROM products WHERE id = 1;
DROP TABLE users; --
```

> **注意**  
> SQLインジェクションは「過去の攻撃手法」ではなく、今もWebアプリ攻撃の主要な手法です。OWASPのTop 10にも毎年ランクインしています。文字列結合でSQLを組み立てるコードを見たら、即座に修正してください。

> **現場メモ**  
> SQLインジェクションは「教科書の話」と侮るべきではありません。実際には「古いコードベースを引き継いだ」「外部委託先が書いたコードにあった」という形で今も見つかります。コードレビューでは `f"SELECT ... WHERE id = {user_input}"` のような文字列フォーマットを使ったSQLを見たら、必ず指摘してください。また、SQLを動的に組み立てる際に「ORDER BY句」や「テーブル名」に外部入力を使っているコードも危険です（プリペアドステートメントはこれらには対応できないため、ホワイトリスト方式での検証が必要）。セキュリティ診断（ペネトレーションテスト）を受けたことのないシステムは、一度専門家にSQLインジェクションの検査を依頼することを推奨します。

---

## 6. プリペアドステートメントによる対策

### プリペアドステートメント（パラメータバインド）とは

ユーザーの入力をSQL文に直接埋め込まず、**プレースホルダー**（`$1`, `?` など）を使って値を別途渡す方法です。これにより、ユーザーの入力がSQL文の一部として解釈されることを防げます。

### PostgreSQLでのプリペアドステートメント

```sql
-- SQL単体でのPREPARE（動作確認用）
PREPARE get_user (BIGINT) AS
    SELECT id, email, name FROM users WHERE id = $1;

-- 実行
EXECUTE get_user(1);

-- 解放
DEALLOCATE get_user;
```

### Pythonでの実装例（psycopg2）

```python
import psycopg2
import os

conn = psycopg2.connect(
    host=os.environ['DB_HOST'],
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD']
)

# 悪い例（SQLインジェクション脆弱）
user_id = request.args.get('id')
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")  # 危険！

# 良い例（プリペアドステートメント）
user_id = request.args.get('id')
cursor.execute(
    "SELECT * FROM users WHERE id = %s",
    (user_id,)  # タプルで渡す
)

# 複数パラメータ
cursor.execute(
    "SELECT * FROM users WHERE email = %s AND is_active = %s",
    (email, True)
)

# INSERTでも同様
cursor.execute(
    "INSERT INTO users (email, name) VALUES (%s, %s)",
    (email, name)
)
```

### Node.jsでの実装例（pg）

```javascript
const { Pool } = require('pg');
const pool = new Pool();

// 悪い例（SQLインジェクション脆弱）
const userId = req.params.id;
const result = await pool.query(`SELECT * FROM users WHERE id = ${userId}`); // 危険！

// 良い例（パラメータバインド）
const userId = req.params.id;
const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
);

// 複数パラメータ
const result = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = $2',
    [email, true]
);
```

> **ポイント**  
> プリペアドステートメントを使えば、ユーザーが `' OR '1'='1` と入力しても、それはSQLの一部ではなく「`id` カラムに比較する文字列の値」として扱われます。構造と値を分離することがSQLインジェクション対策の本質です。

---

## 7. アプリからのDB接続における注意点

### コネクションプールを使う

アプリが毎回新しいDB接続を開くと、接続オーバーヘッドが大きく、接続数が上限を超えやすくなります。

```python
# 悪い例：リクエストごとに新しい接続を作る
def get_user(user_id):
    conn = psycopg2.connect(...)  # 毎回接続！
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result

# 良い例：コネクションプールを使う
from psycopg2 import pool

connection_pool = pool.SimpleConnectionPool(
    minconn=1,
    maxconn=20,
    host=os.environ['DB_HOST'],
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD']
)

def get_user(user_id):
    conn = connection_pool.getconn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        result = cursor.fetchone()
        return result
    finally:
        connection_pool.putconn(conn)  # 接続を返却（閉じない）
```

### タイムアウトの設定

```sql
-- 長時間クエリのタイムアウト（DBサーバー側で設定）
ALTER ROLE myapp_app SET statement_timeout = '30s';

-- 接続自体のタイムアウト
ALTER ROLE myapp_app SET lock_timeout = '10s';
```

### SSL接続の強制

```bash
# SSL接続を必須にする（平文での接続を防ぐ）
postgresql://myapp_app:password@db.example.com/myapp?sslmode=require
```

> **ポイント**  
> 本番環境では、アプリとDBの通信は必ず暗号化（SSL/TLS）してください。同一VPC内でも、意図しないパケットキャプチャで認証情報が盗まれる可能性があります。

---

## 8. 本番データのマスキング

### なぜマスキングが必要か

開発・テスト作業のために本番DBのデータコピーを開発環境に持ってくることがありますが、個人情報がそのまま開発環境に入ると：

- 開発者全員が本番の個人情報にアクセスできる状態になる
- 開発環境は本番より脆弱なことが多い
- GDPRや個人情報保護法への違反になる可能性がある

### マスキングの実装例

```sql
-- 開発環境用のダンプにマスキングを適用するSQL

-- メールアドレスのマスキング（ドメイン部分だけ残す）
UPDATE users
SET email = 'user_' || id || '@example.com';

-- 電話番号のマスキング
UPDATE users
SET phone = '000-0000-0000';

-- 氏名のマスキング
UPDATE users
SET name = 'テストユーザー' || id;

-- クレジットカード番号のマスキング（下4桁だけ残す）
UPDATE payment_methods
SET card_number = '****-****-****-' || RIGHT(card_number, 4);

-- 住所のマスキング
UPDATE user_addresses
SET
    address_line = '（マスキング済み）',
    postal_code  = '000-0000';
```

### pg_anonymizerの活用

```sql
-- pg_anonymizer拡張を使った宣言的なマスキング
CREATE EXTENSION IF NOT EXISTS anon CASCADE;

-- マスキングルールを定義
SECURITY LABEL FOR anon ON COLUMN users.email
    IS 'MASKED WITH FUNCTION anon.fake_email()';

SECURITY LABEL FOR anon ON COLUMN users.name
    IS 'MASKED WITH FUNCTION anon.fake_last_name() || anon.fake_first_name()';

SECURITY LABEL FOR anon ON COLUMN users.phone
    IS 'MASKED WITH VALUE ''000-0000-0000''';

-- マスキングされたダンプを取得
SELECT anon.dump_to_file('/tmp/masked_dump.sql');
```

### 開発環境へのデータコピー手順（安全な方法）

```bash
# 1. 本番からダンプ（--data-only で定義は除く）
pg_dump -h prod-db.example.com -U myapp_readonly -d myapp \
    --data-only -F c -f prod_data.dump

# 2. 開発環境のスキーマに復元
pg_restore -h localhost -U postgres -d myapp_dev prod_data.dump

# 3. 開発環境でマスキングを実行
psql -h localhost -U postgres -d myapp_dev -f masking.sql

# 4. バックアップファイルを削除（個人情報を含むため）
rm prod_data.dump
```

> **注意**  
> 本番データを開発環境に持ってくる場合は、必ずマスキングを実施し、マスキング前のダンプファイルは即座に削除してください。「マスキングし忘れた」「ダンプファイルをうっかりGitにコミットした」という事故は実際に発生しています。

> **現場メモ**  
> `.env` ファイルをGitHubにpushしてしまう事故は今でも頻繁に発生しています。GitHubには「シークレットスキャン」機能があり、既知のパターン（AWS Access KeyやPostgreSQL接続文字列など）を検出すると通知が来ますが、スキャンに引っかかった時点でパブリックリポジトリなら既に公開されています。筆者のチームでも「DBのパスワードが入った `.env` を間違ってコミットしてしまった」という事故が起きたことがあります。その際はパスワードの即時変更・全セッションのキル・アクセスログの確認を行いました。`echo ".env" >> .gitignore` はプロジェクト開始時の必須作業として習慣化してください。また `git secrets` や `gitleaks` などのプリコミットフックツールの導入も有効です。

---

## 9. pg_hba.confの役割（接続認証）

### pg_hba.confとは

`pg_hba.conf`（HBA = Host-Based Authentication）は、PostgreSQLへの接続認証を制御する設定ファイルです。「誰が、どこから、どのDBに、どの認証方法で接続できるか」を定義します。

```
# pg_hba.conf の場所（PostgreSQLのデータディレクトリ）
# 例: /etc/postgresql/15/main/pg_hba.conf

# 書式: type  database  user  address  auth-method [auth-options]
```

### pg_hba.confの設定例

```
# pg_hba.conf

# ローカルUnixドメインソケット接続（OSユーザーとPGユーザーが一致する場合のみ）
local   all             postgres                                peer

# ローカルホストからの接続（パスワード認証）
host    all             all             127.0.0.1/32            scram-sha-256

# 同一ネットワーク内からの接続（特定ユーザーのみ）
host    myapp           myapp_app       192.168.1.0/24          scram-sha-256

# レプリケーション接続
host    replication     replicator      192.168.1.10/32         scram-sha-256

# 全てのアクセスを拒否（最後の行）
host    all             all             0.0.0.0/0               reject
```

### 主な認証方式

| 認証方式 | 説明 | 推奨度 |
| --- | --- | --- |
| `scram-sha-256` | SHAを使ったパスワード認証（推奨） | 高 |
| `md5` | MD5ハッシュのパスワード認証（古い） | 中（新規は非推奨） |
| `peer` | OSのユーザー名とPGユーザー名を照合 | ローカルのみ |
| `trust` | 認証なし（テスト環境のみ） | 本番では絶対NG |
| `reject` | 接続を拒否 | ブロックに使う |

> **注意**  
> `trust` は認証なしで接続できる設定です。テスト環境の `localhost` のみに限定し、本番環境では絶対に使わないでください。設定変更後は `SELECT pg_reload_conf();` で反映されます（PostgreSQLの再起動は不要）。

```sql
-- pg_hba.confの変更を反映（再起動不要）
SELECT pg_reload_conf();

-- 現在の接続設定を確認
SELECT * FROM pg_hba_file_rules;
```

---

## 10. よくあるセキュリティミス

### ミス1: デフォルトパスワードを使い続ける

```bash
# 悪い例：インストール直後のままにしている
psql -U postgres  # パスワードなし（trust認証）

# 良い例：インストール後すぐにパスワードを設定
ALTER USER postgres WITH PASSWORD 'StrongPasswordHere!';
```

### ミス2: アプリユーザーにスーパーユーザー権限を付与する

```sql
-- 絶対NG
CREATE USER myapp WITH SUPERUSER PASSWORD 'password';

-- 正しい方法
CREATE USER myapp WITH PASSWORD 'password';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO myapp;
```

### ミス3: SQLを文字列連結で組み立てる

```python
# 絶対NG（SQLインジェクションの原因）
query = "SELECT * FROM users WHERE id = " + user_id

# 正しい方法
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

### ミス4: 不要なユーザーを削除しない

```sql
-- 使わなくなったユーザーは削除する
-- まずオブジェクトの所有権を移す
REASSIGN OWNED BY old_user TO postgres;
DROP OWNED BY old_user;
DROP USER old_user;
```

### ミス5: pg_hba.confで全IPからのアクセスを許可する

```
# 絶対NG：全IPからのpassword認証（インターネットに晒されている場合は危険）
host    all    all    0.0.0.0/0    md5

# 良い例：必要なIPのみに限定
host    myapp    myapp_app    10.0.1.5/32    scram-sha-256
```

### ミス6: ログに個人情報が出力される

```sql
-- クエリのログレベルを確認（本番では注意）
SHOW log_statement;  -- 'none', 'ddl', 'mod', 'all'

-- 本番ではパラメータの値をログに残さない設定も検討
-- log_statement = 'ddl'  -- DDLのみログ
```

> **ポイント**  
> `log_statement = 'all'` はすべてのSQLをログに記録しますが、クエリのパラメータに個人情報が含まれる場合、ログファイルに個人情報が漏洩します。本番環境では `log_statement = 'ddl'` か `'none'` が一般的です。

---

## 11. ポイント

シニアエンジニアがセキュリティ関連のコードレビューで確認するポイントをまとめます。

### 権限設計

- **アプリのDBユーザーがSUPERUSERになっていないか**
  - `.env` や接続設定で `postgres` ユーザーを直接使っていないか
- **アプリユーザーに不要なDDL権限（CREATE/DROP/ALTER）が付いていないか**
  - マイグレーション専用ユーザーと通常アプリユーザーが分かれているか
- **環境ごとに異なるユーザー・パスワードが設定されているか**
  - 開発・ステージング・本番で同じクレデンシャルを使い回していないか
- **退職・異動したメンバーのアクセス権が削除されているか**
  - 定期的な権限棚卸しの仕組みがあるか

### SQLインジェクション対策

- **ユーザー入力をSQL文字列に直接連結していないか**
  - `f"... WHERE id = {user_id}"` のような文字列フォーマットを使っていないか
- **ORDER BY句やテーブル名に外部入力を使う場合、ホワイトリスト検証があるか**
  - プリペアドステートメントはORDER BYの列名には対応できない
- **ORMを使っている場合でも、生SQLを書く箇所がないか確認する**
  - ORMのraw queryメソッドを使う際は特に注意

### 認証情報の管理

- **`.env` や設定ファイルが `.gitignore` に追加されているか**
- **接続文字列・パスワードがコード内やログにハードコードされていないか**
- **本番のDBへの接続はVPN経由または特定IPからのみ許可されているか（pg_hba.conf）**

### データ保護

- **開発・テスト環境に本番データをそのままコピーしていないか**
  - マスキングスクリプトが用意されているか
- **ログレベルの設定が本番環境に適切か（個人情報がログに出ていないか）**

---

## 12. まとめ

| テーマ | 要点 |
| --- | --- |
| ロールとユーザー | PostgreSQLでは同じ概念。LOGINの有無が違い |
| GRANT / REVOKE | 必要な権限だけを付与・不要な権限は剥奪 |
| 最小権限の原則 | アプリには読み書きのみ。DDLはマイグレーション専用ユーザー |
| スーパーユーザー | アプリからの接続に絶対使わない。管理作業専用 |
| SQLインジェクション | 文字列連結でSQLを組み立てると攻撃される |
| プリペアドステートメント | $1/$2などのプレースホルダーで安全にパラメータを渡す |
| マスキング | 本番データは開発環境に持ち込む前に必ずマスキング |
| pg_hba.conf | IPアドレスとユーザーで接続を制御。trustは本番禁止 |
| よくあるミス | デフォルトパスワード・全IP許可・文字列連結SQL・不要ユーザー放置 |

---

## 練習問題

### 問題1: ユーザーと権限の設計

> 参照：[1. PostgreSQLのロールとユーザーの概念](#1-postgresqlのロールroleとユーザーの概念) ・ [3. 最小権限の原則](#3-最小権限の原則)

Webアプリケーションのデータベースユーザーを設計してください。以下の役割に対して最小権限の原則で権限を付与してください。

- `app_user`：アプリケーションが日常使いするユーザー（SELECT/INSERT/UPDATE/DELETE）
- `readonly_user`：分析・レポート用のユーザー（SELECT のみ）
- `migration_user`：マイグレーション実行用（DDL を含む全権限）

<details>
<summary>回答を見る</summary>

```sql
-- ユーザーの作成
CREATE USER app_user       WITH PASSWORD 'strong_password_1';
CREATE USER readonly_user  WITH PASSWORD 'strong_password_2';
CREATE USER migration_user WITH PASSWORD 'strong_password_3';

-- app_user: DML のみ
GRANT CONNECT ON DATABASE myapp_db TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- readonly_user: SELECT のみ
GRANT CONNECT ON DATABASE myapp_db TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- migration_user: フルアクセス（マイグレーション実行時のみ使用）
GRANT ALL PRIVILEGES ON DATABASE myapp_db TO migration_user;
```

**解説：** 最小権限の原則（Principle of Least Privilege）に従い、各ユーザーに必要最小限の権限だけを付与します。アプリケーションが `migration_user` で動いていると、SQLインジェクションで DROP TABLE が実行されるリスクがあります。`migration_user` はデプロイ時のみ使用し、通常は `app_user` で動かします。

</details>

### 問題2: SQLインジェクションの防止

> 参照：[5. SQLインジェクションとは](#5-sqlインジェクションとは攻撃例で説明) ・ [6. プリペアドステートメントによる対策](#6-プリペアドステートメントによる対策)

以下のコード（Node.js 擬似コード）にSQLインジェクションの脆弱性があります。問題点を説明し、安全な書き方に修正してください。

```javascript
// 脆弱なコード
const userId = req.params.id;
const query = `SELECT * FROM users WHERE id = ${userId}`;
db.query(query);
```

<details>
<summary>回答を見る</summary>

**問題点：**
ユーザー入力をそのまま文字列結合するため、`userId` に `1; DROP TABLE users; --` のような悪意ある文字列が入ると全テーブルが削除される可能性があります。

**安全な書き方（プリペアドステートメント）：**

```javascript
// 安全なコード：パラメータを分離する
const userId = req.params.id;
const query = 'SELECT * FROM users WHERE id = $1';
db.query(query, [userId]);
```

**SQL側で確認：**
```sql
-- PostgreSQL のPREPARE文
PREPARE get_user(bigint) AS
  SELECT * FROM users WHERE id = $1;

EXECUTE get_user(42);
```

**解説：** プリペアドステートメント（パラメータ化クエリ）はSQLと値を分離して送るため、値がどんな文字列でもSQLとして解釈されません。ORMのクエリビルダーも内部でこの仕組みを使っています。文字列結合でSQLを組み立てることは絶対に避けてください。

</details>

### 問題3: 本番データのマスキング

> 参照：[8. 本番データのマスキング](#8-本番データのマスキング)

開発環境の構築に本番データを使いたいですが、個人情報が含まれています。マスキングの方針と具体的なSQLを示してください。

対象テーブル：`users`（id, name, email, phone）

<details>
<summary>回答を見る</summary>

**マスキング方針：**
- `id`：変更しない（外部キー参照が壊れないよう）
- `name`：ランダムな仮名に置き換え
- `email`：`user_{id}@example.com` の形式に変換
- `phone`：固定のダミー値に置き換え

**マスキング用SQL：**

```sql
-- 開発環境のDBにコピー後、個人情報を上書き
UPDATE users SET
  name  = 'テストユーザー' || id::TEXT,
  email = 'user_' || id::TEXT || '@example.com',
  phone = '000-0000-0000';
```

**本番→開発への安全なフロー：**
```bash
# 1. 本番からダンプ
pg_dump -h prod-host -U admin myapp_db > prod_backup.sql

# 2. 開発DBに復元
psql -h localhost -U admin myapp_dev < prod_backup.sql

# 3. マスキング実行（復元直後に必ず実行）
psql -h localhost -U admin -d myapp_dev -f masking.sql

# 4. 確認
psql -h localhost -U admin -d myapp_dev -c "SELECT email FROM users LIMIT 5;"
```

**解説：** 本番データを開発環境に持ち込む前のマスキングは義務です。個人情報保護法・GDPRなどの法規制への対応だけでなく、開発者の端末から本番の個人情報が漏洩するリスクを防ぎます。マスキングスクリプトは必ずバージョン管理し、データコピーのたびに自動で実行されるようCI/CDに組み込むことが理想です。

</details>
