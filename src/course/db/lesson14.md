# 運用
VACUUM・ANALYZE・バックアップ・マイグレーションなどPostgreSQL運用の基本を学びます

## 本章の目標

本章では以下を目標にして学習します。

- PostgreSQLのMVCC（多版型同時実行制御）と不要行の発生理由を説明できること
- VACUUMとANALYZEの役割を説明できること
- pg_dumpを使ってバックアップと復元ができること
- 論理バックアップと物理バックアップの違いを説明できること
- 本番環境への安全なマイグレーション手順を説明できること
- 接続情報の安全な管理方法を実践できること

---

## 1. PostgreSQLのMVCC（多版型同時実行制御）と不要行

### MVCCとは何か

**MVCC（Multi-Version Concurrency Control / 多版型同時実行制御）** とは、複数のトランザクションが同時に同じデータを読み書きできるようにするための仕組みです。

図書館で例えると、「1冊の本を複数人が同時に読める」ようなイメージです。実際には1冊しかありませんが、データベースは各トランザクションに「自分が開始した時点のスナップショット（写真）」を見せることで、この同時アクセスを実現しています。

### MVCCの動作

PostgreSQLでUPDATEやDELETEを行うとき、古いデータは即座に削除されません。

```sql
-- このUPDATEは...
UPDATE users SET name = '田中一郎' WHERE id = 1;

-- 内部的には以下のように動作する
-- 1. 古い行（name = '田中太郎'）を「削除済み」としてマーク
-- 2. 新しい行（name = '田中一郎'）を追加
-- 3. 古い行はまだ物理的にテーブルに残っている
```

### 不要行（dead tuple）

このため、大量のUPDATE/DELETEを行うと、テーブルに**不要行（dead tuple）** が溜まっていきます。

```sql
-- dead tupleの確認
SELECT
    schemaname,
    tablename,
    n_live_tup  AS 有効行数,
    n_dead_tup  AS 不要行数,
    ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS 不要行率
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

> **ポイント**  
> 不要行が溜まると、テーブルのサイズが膨らみ（テーブル膨張）、フルスキャンに時間がかかるようになります。Excelで例えると、削除した行が実は見えないだけで残っているようなイメージです。

---

## 2. VACUUMの役割

**VACUUM** は不要行（dead tuple）を回収し、テーブルのストレージを整理するコマンドです。「データベースの掃除機」と思ってください。

### VACUUMの種類

```sql
-- 通常のVACUUM（不要行を回収し、再利用可能にする）
VACUUM users;

-- すべてのテーブルをVACUUM
VACUUM;

-- テーブルの内容を出力しながらVACUUM（詳細確認）
VACUUM VERBOSE users;

-- VACUUM FULL（テーブルを完全に再構築。テーブルサイズを縮小できる）
-- ※ テーブル全体に排他ロックがかかるため、本番では慎重に
VACUUM FULL users;

-- ANALYZEも同時に実行
VACUUM ANALYZE users;
```

### 通常VACUUMとVACUUM FULLの違い

| 比較項目 | 通常VACUUM | VACUUM FULL |
| --- | --- | --- |
| ロック | なし（並行読み書きOK） | 排他ロック（全操作待機） |
| テーブルサイズ | 縮小しない（空き領域を再利用可能にするだけ） | 縮小する |
| 速度 | 速い | 遅い |
| 用途 | 定期実行 | テーブル膨張の解消（メンテナンスウィンドウ） |

> **注意**  
> `VACUUM FULL` は本番環境のサービス中に実行すると、排他ロックにより全アクセスが停止します。必ずメンテナンスウィンドウ中か、`pg_repack` などのツールを使ったオンライン整理を検討してください。

> **現場メモ**  
> 筆者が経験したケースでは、毎晩大量のバッチ処理でレコードを更新・削除するシステムで、autovacuumのデフォルト設定のままにしていたところ、数ヶ月後にテーブルサイズが10倍近く膨張していたことがありました。クエリが突然遅くなって調査してみると、`pg_stat_user_tables` の `n_dead_tup` が数百万行になっていた、という状況です。VACUUM を忘れると（あるいは autovacuum が追いつかないと）ディスクが静かに、そして着実に膨らんでいきます。`pg_size_pretty(pg_total_relation_size(...))` でテーブルサイズを定期的に確認する監視を入れることを強く推奨します。

### トランザクションIDの周回問題（XID Wraparound）

PostgreSQLはトランザクションIDを32ビット整数（約21億）で管理しています。これが溢れると深刻な問題が起きます。VACUUMにはこの周回を防ぐ役割もあります。

```sql
-- トランザクションIDの使用状況確認
SELECT
    datname,
    age(datfrozenxid) AS xid_age,
    2000000000 - age(datfrozenxid) AS remaining_xids
FROM pg_database
ORDER BY xid_age DESC;
-- xid_age が 1.5億を超えたら警告を検討
```

---

## 3. ANALYZEの役割

**ANALYZE** はテーブルのデータ分布（統計情報）を収集し、クエリプランナーが最適な実行計画を立てられるようにするコマンドです。

カーナビに例えると、道路の渋滞情報を更新するようなイメージです。古い情報だと、最適なルートを選べません。

```sql
-- 特定テーブルの統計情報を更新
ANALYZE users;

-- すべてのテーブルを更新
ANALYZE;

-- テーブルの統計情報を確認
SELECT
    tablename,
    attname    AS column_name,
    n_distinct AS distinct_values,
    correlation
FROM pg_stats
WHERE tablename = 'users';
```

### ANALYZEが重要な理由

```sql
-- 統計情報が古いと、クエリプランナーが誤った判断をする
-- 例：100万行あるのに10行と思い込んでシーケンシャルスキャンを選択する

EXPLAIN ANALYZE
SELECT * FROM users WHERE status = 'active';

-- 統計情報を更新してから再実行すると実行計画が改善されることがある
ANALYZE users;
EXPLAIN ANALYZE
SELECT * FROM users WHERE status = 'active';
```

> **ポイント**  
> 大量のINSERT/UPDATE/DELETEの後は、手動で `ANALYZE` を実行することを検討してください。統計情報が古いと、インデックスを使うべき場所でフルスキャンが選ばれ、クエリが突然遅くなることがあります。

---

## 4. autovacuumの仕組み

**autovacuum** は、VACUUMとANALYZEを自動で実行するデーモンプロセスです。手動で毎回実行しなくても、PostgreSQLが自動的にメンテナンスしてくれます。

### autovacuumの動作条件

autovacuumは以下の条件を満たしたテーブルに対して自動実行されます。

```sql
-- autovacuumの設定確認
SHOW autovacuum_vacuum_threshold;  -- デフォルト: 50行
SHOW autovacuum_vacuum_scale_factor; -- デフォルト: 0.2（20%）

-- VACUUM実行の条件: dead tuple数 > 50 + テーブル行数 × 0.2
-- （例：1万行のテーブルなら 50 + 10000 × 0.2 = 2050行のdead tupleでVACUUM）

-- ANALYZE実行の条件も同様
SHOW autovacuum_analyze_threshold;    -- デフォルト: 50行
SHOW autovacuum_analyze_scale_factor; -- デフォルト: 0.1（10%）
```

### autovacuumの状況確認

```sql
-- autovacuumが実際に動いているか確認
SELECT
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count
FROM pg_stat_user_tables
ORDER BY last_autovacuum DESC NULLS LAST;
```

### テーブルごとのautovacuum設定の調整

更新頻度の高いテーブルはautovacuumの閾値を下げると効果的です。

```sql
-- 特定テーブルのautovacuum設定を調整
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- 5%でVACUUM
    autovacuum_analyze_scale_factor = 0.02  -- 2%でANALYZE
);
```

> **ポイント**  
> autovacuumは便利ですが、「動いているから大丈夫」と油断は禁物です。特に大量の更新が走るバッチ処理の後は、autovacuumが追いつかない場合があります。`pg_stat_user_tables` で `n_dead_tup` を監視する習慣をつけましょう。

---

## 5. バックアップ（pg_dump）と復元（pg_restore / psql）

### pg_dumpの基本

`pg_dump` はデータベースの論理バックアップを取得するツールです。テーブル定義とデータをSQLまたはバイナリ形式で出力します。

```bash
# プレーンSQL形式でバックアップ（読みやすいが大きいDBでは遅い）
pg_dump -h localhost -U postgres -d mydb > mydb_backup.sql

# カスタム形式でバックアップ（圧縮、並列リストアが可能）
pg_dump -h localhost -U postgres -d mydb -F c -f mydb_backup.dump

# ディレクトリ形式でバックアップ（大規模DBに向く、並列処理可能）
pg_dump -h localhost -U postgres -d mydb -F d -f mydb_backup_dir/

# 特定テーブルのみバックアップ
pg_dump -h localhost -U postgres -d mydb -t users -t orders > tables_backup.sql

# スキーマ定義のみ（データなし）
pg_dump -h localhost -U postgres -d mydb --schema-only > schema_only.sql

# データのみ（テーブル定義なし）
pg_dump -h localhost -U postgres -d mydb --data-only > data_only.sql
```

### 復元の方法

```bash
# プレーンSQL形式の復元
psql -h localhost -U postgres -d mydb_restore < mydb_backup.sql

# カスタム形式の復元（pg_restore使用）
pg_restore -h localhost -U postgres -d mydb_restore mydb_backup.dump

# 並列復元（カスタム/ディレクトリ形式のみ）
pg_restore -h localhost -U postgres -d mydb_restore -j 4 mydb_backup.dump
# -j 4 は4並列で復元

# テーブル1つだけ復元
pg_restore -h localhost -U postgres -d mydb_restore -t users mydb_backup.dump
```

### 全データベースのバックアップ（pg_dumpall）

```bash
# クラスタ全体（全DB + ロール + 設定）をバックアップ
pg_dumpall -h localhost -U postgres > all_databases_backup.sql

# ロールと設定のみ（DB内容なし）
pg_dumpall -h localhost -U postgres --globals-only > globals_backup.sql
```

> **ポイント**  
> `pg_dump` はバックアップ取得中も通常通り読み書き可能です（非ブロッキング）。ただし、バックアップ開始時点のスナップショットが取られるため、バックアップ中に更新されたデータはバックアップに含まれません。

> **現場メモ**  
> 「バックアップを毎日取得していたのに、いざリストアしようとしたら手順書が古くて復元できなかった」という話を聞いたことがあります。具体的には、pg_dumpのバージョンと pg_restore のバージョンが一致しておらず、復元時にエラーが出るケースや、復元先のDBが存在しない・権限が足りないといった問題が本番障害時に発覚する、というパターンです。「バックアップを取る」ことと「バックアップから復元できる」ことは別物です。月に一度でも構いませんので、定期的にリストアテストを行う運用を取り入れることを強く推奨します。

### pg_dump / pg_restore を使う際の注意点

```bash
# バージョン確認（dump と restore は同一メジャーバージョンを推奨）
pg_dump --version
pg_restore --version

# 復元先のDBは事前に作成しておく
createdb -h localhost -U postgres mydb_restore

# pg_restore は --exit-on-error を付けると途中でエラー停止する（本番推奨）
pg_restore -h localhost -U postgres -d mydb_restore \
    --exit-on-error mydb_backup.dump

# 復元ログをファイルに保存しておくと障害調査に役立つ
pg_restore -h localhost -U postgres -d mydb_restore \
    -v mydb_backup.dump 2>&1 | tee restore_$(date +%Y%m%d).log
```

---

## 6. 論理バックアップ vs 物理バックアップ

### 論理バックアップ（pg_dump）

| 項目 | 内容 |
| --- | --- |
| 形式 | SQL文またはPostgreSQL専用バイナリ |
| 速度 | 遅い（データをSQL化する処理が必要） |
| 柔軟性 | 高い（特定テーブル・特定行の復元が可能） |
| バージョン互換 | 高い（異なるPostgreSQLバージョン間での移行に使える） |
| 用途 | 開発環境へのコピー、特定テーブルの移行 |

### 物理バックアップ（pg_basebackup）

```bash
# ベースバックアップ（物理バックアップ）を取得
pg_basebackup -h localhost -U replicator -D /backup/base -P -X stream
```

| 項目 | 内容 |
| --- | --- |
| 形式 | PostgreSQLの内部ファイルのコピー |
| 速度 | 速い（ファイルコピーのみ） |
| 柔軟性 | 低い（テーブル単位での復元は困難） |
| バージョン互換 | 低い（同じPostgreSQLバージョンでないと復元できない） |
| 用途 | 本番DBのフルバックアップ、ストリーミングレプリケーション |

### WAL（Write-Ahead Logging）とポイントインタイムリカバリ

物理バックアップと **WAL（トランザクションログ）** を組み合わせると、特定の時点への復元（PITR: Point-In-Time Recovery）が可能です。

```
[月曜のベースバックアップ] + [月曜〜水曜のWAL] = 水曜任意時点への復元が可能
```

> **ポイント**  
> 本番環境では「論理バックアップ（pg_dump）+ 物理バックアップ（pg_basebackup）+ WALアーカイブ」を組み合わせるのがベストプラクティスです。論理バックアップは手軽な復元用、物理バックアップはPITRによる精密な復元用と使い分けます。

---

## 7. マイグレーション戦略（本番への安全な適用）

### マイグレーションとは

マイグレーション（migration）とは、データベースのスキーマ変更を安全・確実に本番環境に適用するための手順です。

### 安全なマイグレーションの基本原則

1. **バックアップを取ってから実行する**
2. **ステージング環境で事前に検証する**
3. **ロールバック手順を事前に用意する**
4. **大きな変更を小さな変更に分割する**
5. **冪等性を持たせる（何度実行しても同じ結果になるようにする）**

> **現場メモ**  
> 筆者がプロダクト運用で最も肝を冷やした経験の一つが、本番でのマイグレーション実行です。数百万件のデータが入っているテーブルに対して `ALTER TABLE` でカラムを追加したとき、ステージング環境（数万件）では数秒で終わっていた処理が、本番では予想外に長時間かかりテーブルロックが解放されず、その間サービスがリクエストを受け付けなくなったことがあります。大量データへのDDL（特に `ALTER TABLE`・インデックス追加）は本番で「想定外に時間がかかる」ことが多いです。必ず本番に近いデータ量を使ったステージングで検証してから実行してください。

### マイグレーションスクリプトの例

```sql
-- V001__create_users_table.sql（良い例）
-- IF NOT EXISTSで冪等性を保証
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL    PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックスも冪等に
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

```sql
-- V002__add_phone_to_users.sql
-- カラムの存在チェックしてから追加（冪等性）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'phone'
    ) THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
END $$;
```

### 大量データへのインデックス追加（ロックを最小化する）

```sql
-- 通常のCREATE INDEXはテーブルロックがかかる
-- 本番では CONCURRENTLY オプションを使う
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
-- CONCURRENTLY は時間はかかるが、テーブルへの読み書きをブロックしない

-- ただし CONCURRENTLY はトランザクション内では使えない
-- また、途中で失敗した場合は INVALID なインデックスが残ることがある
-- その場合は以下で確認・削除する
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'orders';
-- INVALID インデックスの削除
DROP INDEX CONCURRENTLY idx_orders_user_id;
```

### ゼロダウンタイムマイグレーションのパターン

本番サービスを停止せずにスキーマ変更を行うには、アプリのデプロイとDBマイグレーションを分けて実施します。

```
【カラムリネームの安全な手順】

Step 1: 新カラムを追加（アプリは古いカラムを使い続ける）
ALTER TABLE users ADD COLUMN full_name TEXT;

Step 2: 新カラムにデータをコピー（バックグラウンドで）
UPDATE users SET full_name = name;

Step 3: アプリを「新旧両方を書く」版にデプロイ
-- アプリが name と full_name の両方に書くようにする

Step 4: 新カラムにデータが揃ったことを確認

Step 5: アプリを「新カラムのみ使う」版にデプロイ

Step 6: 古いカラムを削除
ALTER TABLE users DROP COLUMN name;
```

> **ポイント**  
> 「本番でスキーマ変更 → すぐアプリデプロイ」という手順は危険です。デプロイ中の一瞬、古いアプリと新しいスキーマが混在するからです。スキーマ変更は「旧アプリでも動く形」にしてから適用するのが鉄則です。

> **現場メモ**  
> 「ダウンタイムなしでマイグレーションする」は、言葉で書くと簡単そうに見えますが、実際にはアプリのデプロイタイミングとDBの変更順序を細かくコントロールする必要があり、チームで認識を合わせて進めないと事故が起きます。特に複数のサーバーにまたがるアプリをローリングデプロイしている場合は、旧バージョンと新バージョンのアプリが同時に動いている瞬間があります。「そのどちらでも動くスキーマ」を意識した設計が、現場では最も重要なポイントになります。面接でもゼロダウンタイムデプロイの手順を聞かれることがありますので、この流れは押さえておきましょう。

---

## 8. マイグレーションツールの概念

### 主要なマイグレーションツール

| ツール | 特徴 | 向いている場面 |
| --- | --- | --- |
| **Flyway** | SQLファイルベース。シンプルで導入しやすい | Java/Maven プロジェクト |
| **Liquibase** | XML/YAML/JSON/SQLで記述。ロールバック機能が強い | エンタープライズ |
| **Alembic** | Pythonで記述。SQLAlchemy連携 | Python/Flaskプロジェクト |
| **Prisma Migrate** | TypeScriptで記述 | Node.js/TypeScriptプロジェクト |
| **golang-migrate** | CLIツール。Go製 | Go/多言語プロジェクト |

### Flywayのマイグレーションファイル命名規則

```
V{バージョン}__{説明}.sql

例：
V001__create_users_table.sql
V002__add_orders_table.sql
V003__add_index_to_orders.sql
```

命名規則のポイントは以下の通りです。

- バージョン番号はゼロ埋め（`001`, `002`…）で揃えると、ファイル一覧を並べたときに順序が見やすくなります
- 説明部分にはスネークケースを使い、「何を変更したか」を端的に表現します（例: `add_column_profile_url_to_users`）
- ファイル名は一度コミットしたら変更禁止です。Flywayはファイル名とチェックサムで管理するため、変更すると実行エラーになります

### マイグレーションツールが管理するテーブル

FlywayはDBに `flyway_schema_history` テーブルを作成し、実行済みのマイグレーションを記録します。

```sql
-- Flywayが管理するテーブルの例
SELECT
    version,
    description,
    type,
    script,
    checksum,
    installed_on,
    success
FROM flyway_schema_history
ORDER BY installed_rank;
```

> **ポイント**  
> マイグレーションツールを使うことで「どのバージョンのスキーマがどの環境に適用済みか」を一元管理できます。手動でSQLを実行していると「このSQLをステージングに流したっけ？」という混乱が起きます。

> **現場メモ**  
> マイグレーションファイルの命名規則とバージョン管理は、チームで事前に決めておくことが非常に重要です。私が見た失敗例では、複数の開発者が同じバージョン番号（例: `V003__...`）でファイルを作成してしまい、Gitマージ後にFlywayが起動時にエラーを出してデプロイが止まった、というケースがありました。feature ブランチでのマイグレーションファイル作成ルール（例: タイムスタンプをバージョンに使う）をチームで統一しておくと、こうした衝突を防ぎやすくなります。

---

## 9. 接続情報の管理（環境変数・.env）

### 絶対にやってはいけないこと

```python
# 絶対NG：接続情報をコードに直書き
import psycopg2

conn = psycopg2.connect(
    host="db.production.example.com",
    database="myapp_prod",
    user="admin",
    password="SuperSecret123!"  # ← Gitにコミットしたら大惨事
)
```

### 環境変数を使う

```bash
# .env ファイル（Gitにコミットしてはいけない！）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_dev
DB_USER=myapp_user
DB_PASSWORD=dev_password_here
```

```bash
# .gitignore に必ず追加
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
```

```python
# Python での環境変数の読み込み例
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()  # .envファイルを読み込む

conn = psycopg2.connect(
    host=os.environ['DB_HOST'],
    port=os.environ.get('DB_PORT', '5432'),
    database=os.environ['DB_NAME'],
    user=os.environ['DB_USER'],
    password=os.environ['DB_PASSWORD']
)
```

```bash
# PostgreSQLの環境変数（psqlやpg_dumpでも使える）
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=myapp
export PGUSER=myapp_user
export PGPASSWORD=your_password

# この状態で psql と入力するだけで接続できる
psql
```

### 本番環境での接続情報管理

```
開発環境: .env ファイル
ステージング/本番: 環境変数（Docker/Kubernetes シークレット、AWS Secrets Manager など）
```

> **注意**  
> `PGPASSWORD` 環境変数はシェルの履歴やプロセスリストに表示される可能性があります。より安全な方法として、`~/.pgpass` ファイルや AWS Secrets Manager などのシークレット管理サービスの利用を検討してください。

---

## 10. よくある運用ミス

### ミス1: バックアップを取っていない

```bash
# 最低限、本番のDBは毎日バックアップ
# cronの例（毎日3時にバックアップ）
0 3 * * * pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -F c \
  -f /backup/myapp_$(date +\%Y\%m\%d).dump

# バックアップが正しく取れているか定期的に確認（リストアテスト）
pg_restore -d myapp_test /backup/myapp_20260101.dump
```

### ミス2: VACUUMが動いていない

```sql
-- テーブルが膨張していないか確認
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    n_dead_tup AS dead_tuples,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

### ミス3: 接続が枯渇する（Too many connections）

```sql
-- 現在の接続状況を確認
SELECT
    state,
    COUNT(*) AS connection_count,
    MAX(NOW() - state_change) AS max_idle_duration
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- 長時間アイドルの接続を確認
SELECT pid, usename, application_name, state, state_change
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '30 minutes';

-- 最大接続数の確認
SHOW max_connections;
```

> **ポイント**  
> アプリから毎回新しいDB接続を開いていると、すぐに接続が枯渇します。**コネクションプール**（PgBouncer等）を使い、接続を再利用することが本番環境では必須です。

### ミス4: マイグレーションのロールバックを考えていない

```sql
-- 本番でマイグレーション失敗したときのロールバック例
-- 事前に元に戻すSQLも準備しておく

-- 適用するSQL（forward）
ALTER TABLE users ADD COLUMN profile_url TEXT;

-- ロールバック用SQL（backward）
ALTER TABLE users DROP COLUMN IF EXISTS profile_url;
```

---

## 11. 現場での判断基準

運用の現場では、以下の判断基準を持っておくと、いざというときに迷わずに動けます。

### バックアップ運用

| 状況 | 判断 |
| --- | --- |
| バックアップを取っている | 「取っているだけ」では不十分。**リストアテストまで実施して初めて完了** |
| バックアップファイルが古い | RTO（目標復旧時間）・RPO（目標復旧時点）を決めてスケジュールを見直す |
| リストアに時間がかかる | カスタム形式（-F c）＋並列復元（-j N）で高速化できる |

### VACUUM / テーブル膨張

| 状況 | 判断 |
| --- | --- |
| n_dead_tup が多い | まず手動 `VACUUM` を実行。大きければ `VACUUM FULL`（要メンテウィンドウ） |
| autovacuum が追いつかない | テーブルの `autovacuum_vacuum_scale_factor` を下げる |
| ディスク使用量が急増 | `pg_total_relation_size` でテーブル・インデックスの肥大化を確認 |

### マイグレーション

| 状況 | 判断 |
| --- | --- |
| 大量データへの ALTER TABLE | **必ず本番相当のデータ量でステージングテスト**。実行時間を計測してから判断 |
| インデックスを本番追加したい | `CREATE INDEX CONCURRENTLY` でロックなし追加を使う |
| カラムリネームがしたい | 段階的なゼロダウンタイム手順（追加→コピー→切替→削除）を使う |
| マイグレーション失敗した | ロールバックSQLを事前に用意してあるか確認。なければ復旧が難しくなる |

---

## 12. ポイント

マイグレーションや運用スクリプトを含む PR をレビューする際、以下の観点を確認してください。現場でよく指摘されるポイントです。

### マイグレーションファイルのチェック

- ファイル名の命名規則（`V{バージョン}__{説明}.sql`）に従っているか
- 既存のマイグレーションファイルを修正していないか（変更禁止）
- `CREATE TABLE`・`CREATE INDEX` に `IF NOT EXISTS` が付いているか（冪等性）
- ロールバック用のSQLがコメントまたは down ファイルとして準備されているか
- 大量データに対する `ALTER TABLE` を含む場合、実行時間の見積もりがあるか
- インデックス追加は `CONCURRENTLY` を使っているか（本番ロック回避）
- `DROP TABLE` / `TRUNCATE` を含む場合、意図が明確か（誤削除のリスク）

### バックアップ・運用スクリプトのチェック

- 接続情報（ホスト・パスワード）がハードコードされていないか
- バックアップ後のリストアテスト手順が含まれているか
- バックアップファイルの保存先・保持期間が定義されているか
- cronジョブのエラーをメールや監視ツールに通知する設定があるか

### VACUUM 設定変更のチェック

- テーブルごとに `autovacuum_vacuum_scale_factor` を変更する場合、意図が説明されているか
- `VACUUM FULL` の実行タイミングがメンテナンスウィンドウ内か

---

## 13. まとめ

| テーマ | 要点 |
| --- | --- |
| MVCC | 各トランザクションは開始時点のスナップショットを見る。dead tupleが発生する |
| VACUUM | dead tupleを回収。VACUUM FULLはテーブルサイズも縮小するが排他ロックが必要 |
| ANALYZE | 統計情報を更新。クエリプランナーの精度を保つ |
| autovacuum | VACUUMとANALYZEを自動実行するデーモン。監視は怠らない |
| pg_dump | 論理バックアップ。特定テーブル・異なるバージョン間の移行に向く |
| 物理バックアップ | pg_basebackup。速い・PITR対応。バージョン依存あり |
| リストアテスト | バックアップは「復元できて」初めて意味を持つ。定期的にテストを実施 |
| マイグレーション | 冪等性を持たせる。ゼロダウンタイムには段階的な変更が必要 |
| 大量データのDDL | 本番相当のデータ量で必ずステージング検証。インデックスは CONCURRENTLY |
| ツール | Flyway/Liquibase等でスキーマバージョンを管理する |
| 命名規則 | マイグレーションファイルの命名はチームで統一。一度コミットしたら変更禁止 |
| 接続情報 | 環境変数/.envで管理。ソースコードに直書き禁止 |
| よくある運用ミス | バックアップなし・VACUUM未実行・接続枯渇・ロールバック未準備 |

---

## 練習問題

### 問題1: マイグレーションファイルの作成

> 参照：[7. マイグレーション戦略](#7-マイグレーション戦略本番への安全な適用)

`articles` テーブルに `view_count INTEGER NOT NULL DEFAULT 0` カラムを追加するマイグレーションファイルを作成してください。ファイル名の命名規則も含めて示してください。

<details>
<summary>回答を見る</summary>

**ファイル名：**
```
20240419120000_add_view_count_to_articles.sql
```

**マイグレーション内容：**
```sql
-- up（適用）
ALTER TABLE articles ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

-- down（ロールバック）
ALTER TABLE articles DROP COLUMN view_count;
```

**解説：** マイグレーションファイル名にはタイムスタンプ（YYYYMMDDHHmmss）をプレフィックスに付けることで実行順序を保証します。up（適用）とdown（ロールバック）をセットで書くと、問題発生時に安全に元に戻せます。一度コミットしたファイルの内容は変更しないことが鉄則です（新しいファイルで修正する）。

</details>

### 問題2: バックアップの取得と復元

> 参照：[5. バックアップと復元](#5-バックアップpgdumpと復元pgrestore-psql)

PostgreSQL の `pg_dump` を使って `myapp_db` データベースをバックアップし、別のデータベース `myapp_restore` に復元するコマンドを書いてください。

<details>
<summary>回答を見る</summary>

```bash
# バックアップ（カスタム形式：圧縮・並列復元が可能）
pg_dump -h localhost -U app_user -d myapp_db -F c -f myapp_db_20240419.dump

# バックアップ（SQL形式：可読性が高い）
pg_dump -h localhost -U app_user -d myapp_db > myapp_db_20240419.sql

# 復元先データベースの作成
createdb -h localhost -U app_user myapp_restore

# カスタム形式からの復元
pg_restore -h localhost -U app_user -d myapp_restore myapp_db_20240419.dump

# SQL形式からの復元
psql -h localhost -U app_user -d myapp_restore < myapp_db_20240419.sql
```

**解説：** `pg_dump` はデータベースの論理バックアップを取得します。`-F c`（カスタム形式）は圧縮され、`pg_restore` の `--jobs` オプションで並列復元が可能です。本番環境では定期的なバックアップと復元テスト（バックアップから実際に復元できるか確認）が必須です。

</details>

### 問題3: 接続数の問題

> 参照：[9. 接続情報の管理](#9-接続情報の管理環境変数・env) ・ [10. よくある運用ミス](#10-よくある運用ミス)

本番環境で以下のエラーが頻発しています。原因と対処法を答えてください。

```
ERROR: remaining connection slots are reserved for non-replication superuser connections
```

<details>
<summary>回答を見る</summary>

**原因：**
PostgreSQL の最大接続数（`max_connections`、デフォルト100）に達した状態です。アプリケーションが接続を適切に解放していないか、アクセスが急増している可能性があります。

**対処法：**

1. **コネクションプールの導入（最も重要）**
   ```
   PgBouncer などのコネクションプーラーを導入する
   アプリ → PgBouncer（少数の接続を管理） → PostgreSQL
   ```

2. **現在の接続数を確認**
   ```sql
   SELECT count(*), state, application_name
   FROM pg_stat_activity
   GROUP BY state, application_name;
   ```

3. **アイドル接続の強制切断（緊急対処）**
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
     AND query_start < NOW() - INTERVAL '10 minutes';
   ```

4. **max_connections の増加（PostgreSQL.conf）**
   ```
   max_connections = 200  # 増やすとメモリ消費も増える
   ```

**解説：** コネクションプールなしでアプリが直接 PostgreSQL に接続する設計では、アクセス増加時に接続数が枯渇します。本番環境では必ず PgBouncer や pgpool-II などのプールを入れることが標準です。

</details>
