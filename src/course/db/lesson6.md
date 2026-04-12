# テーブル定義
CREATE TABLE・ALTER TABLE・DROP TABLEでテーブルを作成・変更・削除します

## 本章の目標

本章では以下を目標にして学習します。

- CREATE TABLEで適切なデータ型・制約を指定してテーブルを作成できること
- ALTER TABLEでカラム追加・変更・削除など既存テーブルを安全に変更できること
- DROP TABLE・TRUNCATEの違いを理解して使い分けられること
- シーケンス（SERIAL）の仕組みを理解できること
- 本番環境でのDDL操作のリスクと注意点を説明できること

---

## 1. CREATE TABLEの基本構文

テーブルを作成するには `CREATE TABLE` 文を使います。設計図を現実のデータベースに落とし込む作業です。建物に例えると、ERDが建築設計図であり、CREATE TABLEがその設計図をもとに実際の建物を建てる作業です。

### 基本構文

```sql
CREATE TABLE テーブル名 (
    カラム名 データ型 [制約],
    カラム名 データ型 [制約],
    ...
    [テーブル制約]
);
```

### IF NOT EXISTSオプション

`IF NOT EXISTS` を付けると、テーブルが既に存在する場合にエラーを出さずにスキップします。

```sql
-- テーブルが存在しない場合だけ作成する
CREATE TABLE IF NOT EXISTS users (
    id   SERIAL      PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
```

> **ポイント**  
> マイグレーションスクリプトや初期化スクリプトでは `IF NOT EXISTS` を付けておくと、同じSQLを何度実行しても安全です（これを「冪等性がある」といいます）。本番環境での誤実行防止に役立ちます。

### 主なデータ型

| データ型 | 用途 | 例 |
| --- | --- | --- |
| `INTEGER` / `INT` | 整数 | 年齢、数量 |
| `BIGINT` | 大きな整数（約920京まで） | IDが大量になる場合 |
| `SERIAL` | 自動採番の整数（後述） | 主キー |
| `BIGSERIAL` | 自動採番の大きな整数 | 大規模テーブルの主キー |
| `VARCHAR(n)` | 可変長文字列（最大n文字） | 名前、メールアドレス |
| `TEXT` | 長さ無制限の文字列 | コメント、本文 |
| `BOOLEAN` | 真偽値（true/false） | フラグ |
| `DATE` | 日付のみ | 誕生日、有効期限 |
| `TIMESTAMP` | 日付＋時刻（タイムゾーンなし） | ログの日時 |
| `TIMESTAMPTZ` | タイムゾーン付き日時 | 国際サービスの日時 |
| `NUMERIC(p,s)` | 高精度数値（p:総桁数, s:小数桁数） | 金額 |
| `DECIMAL(p,s)` | NUMERICの別名 | 金額 |
| `UUID` | 128ビットの一意識別子 | セキュアなID |

### 主な制約

| 制約 | 意味 |
| --- | --- |
| `PRIMARY KEY` | 主キー（NULLなし・重複なし） |
| `NOT NULL` | NULL禁止 |
| `UNIQUE` | 値の重複禁止 |
| `DEFAULT 値` | デフォルト値の設定 |
| `CHECK (条件)` | 値の範囲・条件チェック |
| `REFERENCES テーブル(カラム)` | 外部キー参照（整合性の保証） |

---

## 2. 実践的なCREATE TABLE例

### usersテーブル（ユーザー情報）

```sql
CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL    PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    age        INTEGER      CHECK (age >= 0 AND age <= 150),
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

各カラムの設計意図：

- `id` : `BIGSERIAL` は将来数十億件になっても対応できる自動採番の主キー
- `email` : `UNIQUE` 制約で同じメールアドレスの重複登録を防ぐ
- `age` : `CHECK` 制約で「0〜150」の範囲外の値を弾く（現実的にあり得ない値の防止）
- `is_active` : `DEFAULT true` で作成直後からアクティブ扱いにする
- `created_at` / `updated_at` : 監査用の日時カラム。`CURRENT_TIMESTAMP` でSQL実行時刻が自動セット

> **ポイント**  
> `created_at` と `updated_at` はほぼすべてのテーブルに付けることが現場のベストプラクティスです。「いつ誰が変更したか」を追跡できるため、障害調査や監査で非常に役立ちます。

### ordersテーブル（注文情報）

```sql
CREATE TABLE IF NOT EXISTS orders (
    id          BIGSERIAL      PRIMARY KEY,
    user_id     BIGINT         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status      VARCHAR(20)    NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    ordered_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 外部キーにはインデックスを追加する（結合を速くするため）
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

設計のポイント：

- `user_id` : `REFERENCES users(id)` で外部キー制約を設定。`ON DELETE RESTRICT` は参照先（users）を削除しようとするとエラーにする。これにより「注文がある顧客を誤って削除する」事故を防げる
- `status` : `CHECK` 制約で許容する値を列挙。ENUMより後から変更しやすい
- `total_price` : `NUMERIC(10, 2)` は最大10桁・小数点以下2桁。金額には絶対に浮動小数点を使わない

> **注意**  
> 金額には絶対に `FLOAT` や `REAL` を使わないでください。浮動小数点数は内部的に2進数で表現されるため、`0.1 + 0.2 = 0.30000000000000004` のような誤差が生じます。1円の誤差が積み重なると、月末の締め処理で大問題になります。金額には必ず `NUMERIC` または `DECIMAL` を使いましょう。

---

## 3. ALTER TABLE

既存テーブルの構造を変更するには `ALTER TABLE` を使います。サービスの成長とともに要件が変わり、テーブルを変更する機会は必ず訪れます。これは「リノベーション工事」のようなものです。

### カラムを追加する（ADD COLUMN）

```sql
-- usersテーブルに電話番号カラムを追加（NULL可）
ALTER TABLE users ADD COLUMN phone VARCHAR(20);

-- NOT NULL制約付きで追加する場合はDEFAULTが必要
ALTER TABLE users ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0;

-- 複数カラムを一度に追加（PostgreSQL 14以降）
ALTER TABLE users
    ADD COLUMN last_login_at TIMESTAMPTZ,
    ADD COLUMN profile_image_url TEXT;
```

> **ポイント**  
> NOT NULL制約付きのカラムを追加する場合、既存の行がNULLのままでは制約違反になります。必ず `DEFAULT` で初期値を指定するか、後でUPDATEしてからNOT NULL制約を追加するかのどちらかにします。

### カラムを削除する（DROP COLUMN）

```sql
-- phoneカラムを削除
ALTER TABLE users DROP COLUMN phone;

-- カラムが存在しない場合もエラーを出さない
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

> **注意**  
> `DROP COLUMN` は元に戻せません。本番環境では必ずバックアップを取ってから実行してください。また、アプリケーションコードが削除するカラムを参照していないか事前に確認しましょう。「カラムを削除したらアプリがエラーを出した」は現場でよくある事故です。

### カラムの型を変更する（ALTER COLUMN TYPE）

```sql
-- ageをINTEGERからSMALLINTに変更
ALTER TABLE users ALTER COLUMN age TYPE SMALLINT;

-- VARCHAR(100)をTEXTに変更
ALTER TABLE users ALTER COLUMN name TYPE TEXT;

-- USINGで変換式を指定（型が自動変換できない場合）
ALTER TABLE users ALTER COLUMN age TYPE VARCHAR(10) USING age::VARCHAR;
```

### カラム名を変更する（RENAME COLUMN）

```sql
-- nameカラムをfull_nameに変更
ALTER TABLE users RENAME COLUMN name TO full_name;
```

### テーブル名を変更する（RENAME TABLE）

```sql
-- usersテーブルをapp_usersに変更
ALTER TABLE users RENAME TO app_users;
```

### NOT NULL制約の追加・削除

```sql
-- NOT NULL制約を追加（既存行がNULLでないことを確認してから）
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;

-- NOT NULL制約を削除
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
```

### デフォルト値の変更

```sql
-- デフォルト値を設定
ALTER TABLE users ALTER COLUMN is_active SET DEFAULT false;

-- デフォルト値を削除
ALTER TABLE users ALTER COLUMN is_active DROP DEFAULT;
```

---

## 4. 本番でのALTER TABLEの注意点

ALTER TABLEはテーブル全体に排他ロックをかける場合があります。大規模テーブルでは長時間ロックが続き、その間そのテーブルへのINSERT/UPDATE/DELETEがすべて待機状態になります。つまり、サービスが止まる可能性があります。

### ロックリスクの比較

| 操作 | リスク | 理由 |
| --- | --- | --- |
| `ADD COLUMN NOT NULL DEFAULT（定数）` | 低（PG11以降） | メタデータのみ変更 |
| `ADD COLUMN NULL` | 低 | メタデータのみ変更 |
| `ALTER COLUMN TYPE` | 高 | 全行の型変換が必要 |
| `ADD CONSTRAINT CHECK（新規）` | 高 | 全行の検証が必要 |
| `ADD CONSTRAINT CHECK NOT VALID` | 低 | 既存行を検証しない |
| `RENAME COLUMN` | 低 | メタデータのみ変更 |
| `DROP COLUMN` | 低 | メタデータのみ変更 |

### PostgreSQL 11以降での改善

PostgreSQL 11以降では、`DEFAULT` 値が定数の場合、`ADD COLUMN NOT NULL DEFAULT 定数` はテーブルを書き換えずにメタデータのみ変更するため、大規模テーブルでも高速です。

```sql
-- PostgreSQL 11以降では大規模テーブルでも高速
ALTER TABLE large_table ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
```

### 安全な型変更の手順（ゼロダウンタイム）

```sql
-- 手順1: 新しいカラムをNULLableで追加（ロックが短い）
ALTER TABLE users ADD COLUMN full_name TEXT;

-- 手順2: 既存データをバックグラウンドで少しずつコピー
-- （大量データは一括UPDATEを避け、バッチで少量ずつ更新する）
UPDATE users SET full_name = name WHERE id BETWEEN 1 AND 10000;
UPDATE users SET full_name = name WHERE id BETWEEN 10001 AND 20000;
-- ... 繰り返す

-- 手順3: アプリを新カラムに切り替える（コードデプロイ）

-- 手順4: NOT NULL制約を追加
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

-- 手順5: 古いカラムを削除
ALTER TABLE users DROP COLUMN name;
```

> **ポイント**  
> 数百万行以上の大規模テーブルでのALTER TABLEは、深夜のメンテナンスウィンドウに実施するか、`pg_repack` などのツールを使って無停止で実行することを検討してください。「本番でALTERしたらサービスが10分止まった」は現場でよく聞く失敗談です。

> **現場メモ**  
> マイグレーションによる本番障害は、DBの知識が浅いエンジニアが引き起こす典型的な事故の一つです。筆者が経験したインシデントで、数千万行のテーブルに `ALTER COLUMN TYPE` を実行したところ、全行の型変換のために排他ロックが15分以上続き、その間サービスのAPIがすべてタイムアウトするという事態になりました。「ステージング環境で10秒で終わったから大丈夫」と思っていても、本番のデータ量が10倍・100倍になっていたりします。本番DBへのマイグレーションを実行する前は必ず「本番と同じデータ量のテスト環境で事前に計測する」「ロックが長時間かかる操作は `NOT VALID` オプションや段階的手順で回避する」を確認してください。チームで「マイグレーションレビューチェックリスト」を持つことを強く推奨します。

---

## 5. DROP TABLE

テーブルを完全に削除するには `DROP TABLE` を使います。テーブル定義もデータもすべて消えます。

```sql
-- テーブルを削除
DROP TABLE orders;

-- テーブルが存在しない場合もエラーを出さない
DROP TABLE IF EXISTS orders;

-- 外部キーで参照されているテーブルを強制削除（参照先も削除される）
DROP TABLE IF EXISTS users CASCADE;
```

> **注意**  
> `DROP TABLE` はテーブル定義とデータの両方を完全に削除します。`CASCADE` はそのテーブルを参照している外部キー制約も一緒に削除します。本番環境では絶対に慎重に扱い、必ずバックアップを確認してから実行してください。

---

## 6. TRUNCATE vs DELETE の違い

テーブルの全データを削除する方法には `TRUNCATE` と `DELETE` の2種類があります。

### DELETEによる全件削除

```sql
-- 全件削除（WHERE句なし）
DELETE FROM orders;

-- WHERE句で条件を絞れる
DELETE FROM orders WHERE status = 'cancelled';
```

### TRUNCATEによる全件削除

```sql
-- TRUNCATEで全件削除
TRUNCATE TABLE orders;

-- シーケンス（自動採番）もリセットする
TRUNCATE TABLE orders RESTART IDENTITY;

-- 外部キーで参照されているテーブルも一緒にクリア
TRUNCATE TABLE users, orders CASCADE;
```

### 比較表

| 比較項目 | DELETE | TRUNCATE |
| --- | --- | --- |
| 速度 | 遅い（1行ずつ処理） | 速い（ページ単位で削除） |
| WHERE句 | 使える | 使えない |
| ロールバック | できる | できる（PostgreSQLのみ） |
| トリガー | 発火する | 発火しない |
| シーケンスリセット | されない | `RESTART IDENTITY`で可能 |
| 不要行（dead tuple） | 多く発生する | 発生しない |
| ロック | 行レベルロック | テーブルレベルロック |

> **ポイント**  
> テスト環境のテーブルを丸ごとリセットしたい場合は `TRUNCATE TABLE テーブル名 RESTART IDENTITY CASCADE;` が便利です。シーケンスも1からリセットされるので、テストデータのIDが毎回1から始まります。

---

## 7. シーケンスの仕組み（SERIALの裏側）

`SERIAL` は実はシーケンスオブジェクトの糖衣構文（シンタックスシュガー）です。「自動的に1, 2, 3...と採番してくれる仕組み」の実体がシーケンスです。

### SERIALの裏側

```sql
-- これを書くと...
CREATE TABLE users (
    id SERIAL PRIMARY KEY
);

-- ...内部的にはこれと同じことが起きる
CREATE SEQUENCE users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE users (
    id INTEGER NOT NULL DEFAULT nextval('users_id_seq') PRIMARY KEY
);

ALTER SEQUENCE users_id_seq OWNED BY users.id;
```

### シーケンスの直接操作

```sql
-- 現在の値を確認（nextvalを一度呼んだ後でないと使えない）
SELECT currval('users_id_seq');

-- 次の値を取得して進める（実際にIDを予約する）
SELECT nextval('users_id_seq');

-- シーケンスの現在の状態を確認
SELECT last_value, increment_by, max_value FROM users_id_seq;

-- シーケンスをリセット（開発環境でのみ使用すること）
ALTER SEQUENCE users_id_seq RESTART WITH 1;
```

> **ポイント**  
> シーケンスは採番のみを担当します。`nextval` を呼んで取得した値は、たとえその後のINSERTがロールバックされても番号は戻りません。そのため、連番に「飛び番」が生じることがあります。これは正常な動作です。

### SERIAL vs BIGSERIAL vs IDENTITYカラム

```sql
-- SERIAL（INT型、最大約21億）
id SERIAL PRIMARY KEY

-- BIGSERIAL（BIGINT型、最大約920京）
id BIGSERIAL PRIMARY KEY

-- PostgreSQL 10以降推奨の書き方（GENERATED ... AS IDENTITY）
-- ALWAYS: 直接INSERT不可（シーケンスのみで採番）
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY

-- BY DEFAULT: 直接INSERTで値を上書きできる
id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
```

> **ポイント**  
> 新しいプロジェクトでは `GENERATED ALWAYS AS IDENTITY` の使用が推奨されています。SERIALは古いアプローチですが、現場でも広く使われています。両方読めるようにしておきましょう。

### UUIDを主キーにする場合

```sql
-- PostgreSQL 13以降はgen_random_uuid()が標準で使える
CREATE TABLE users (
    id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL
);

-- INSERT時にIDを指定しなくても自動生成される
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice');
```

UUID主キーのメリット：
- 連番でないため、外部から推測されにくい（セキュリティ面）
- 複数DBでも衝突しにくい（分散システム向き）

UUID主キーのデメリット：
- 連番より大きい（16バイト vs 8バイト）
- ランダム挿入でBツリーインデックスが断片化しやすい

---

## 8. よくあるミスと対処法

### ミス1: 後から変更が難しいENUMの使いすぎ

**悪い例：**
```sql
-- ENUMで状態を管理する（後から値を追加しづらい）
CREATE TYPE order_status AS ENUM ('pending', 'shipped');
CREATE TABLE orders (
    status order_status NOT NULL
);

-- 後でCANCELLEDを追加しようとすると...
-- ALTER TYPE order_status ADD VALUE 'cancelled';
-- これはトランザクション内で使えない制限がある
```

**良い例：**
```sql
-- VARCHAR + CHECK制約（後から変更しやすい）
CREATE TABLE orders (
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
           CHECK (status IN ('pending', 'shipped'))
);

-- CHECK制約の変更は比較的容易
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'shipped', 'cancelled'));
```

### ミス2: 外部キーのインデックス忘れ

```sql
-- 外部キーにインデックスがないと結合が遅くなる（悪い例）
CREATE TABLE orders (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT    NOT NULL REFERENCES users(id)
    -- user_idにインデックスがない！
);

-- 良い例：外部キーには必ずインデックスを追加
CREATE TABLE orders (
    id      BIGSERIAL PRIMARY KEY,
    user_id BIGINT    NOT NULL REFERENCES users(id)
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

> **注意**  
> PostgreSQLは外部キー制約を設定しても、インデックスを自動作成しません（PRIMARY KEYは自動作成）。外部キーカラムには必ず手動でインデックスを追加してください。

### ミス3: タイムゾーンの考慮漏れ

```sql
-- 悪い例：タイムゾーンなしのTIMESTAMP
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

-- 良い例：タイムゾーンありのTIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

### ミス4: NOT NULL制約の付け忘れ

```sql
-- 悪い例：NULL混入が起きやすい
name VARCHAR(100)

-- 良い例：意図的にNULLを許容する場合を除き、NOT NULLをつける
name VARCHAR(100) NOT NULL
```

> **ポイント**  
> 「このカラムがNULLになることはビジネス的にあり得るか？」を必ず考えてください。NULLが混入すると、アプリ側でのNULLチェックが増え、予期せぬバグの温床になります。

## PRレビューのチェックポイント

- [ ] **本番で実行するマイグレーションに `ALTER COLUMN TYPE` や全行検証が必要な変更が含まれていないか**
  - ロックリスクの高い操作は `NOT VALID` オプションや段階的手順での回避を検討する
- [ ] **マイグレーションを本番と同じデータ量の環境で事前に計測したか**
  - ステージング環境でも本番データ量を模擬しないと見落とす
- [ ] **`DROP TABLE` や `TRUNCATE` を本番で実行する際に確認手順があるか**
  - 実行前に `SELECT COUNT(*)` で対象を必ず確認する
- [ ] **シーケンスの `START WITH` 値が既存データと衝突しないか（データ移行時）**
  - 既存の最大 ID より大きい値を `START WITH` に設定する

---

## 9. まとめ

| テーマ | 要点 |
| --- | --- |
| CREATE TABLE | `IF NOT EXISTS` で冪等性を保つ。データ型・制約を適切に設定 |
| データ型 | 金額はNUMERIC、日時はTIMESTAMPTZ、大量データはBIGINT/BIGSERIAL |
| 制約 | NOT NULL・UNIQUE・CHECK・REFERENCES（外部キー）を活用 |
| ALTER TABLE | ADD COLUMN・DROP COLUMN・RENAME COLUMN・RENAME TABLEで構造変更 |
| 本番ALTER TABLE | 大規模テーブルはロックに注意。型変更は段階的に実施 |
| DROP TABLE | `IF EXISTS` で安全に。`CASCADE` は慎重に |
| TRUNCATE vs DELETE | 全件削除はTRUNCATEが速い。DELETEはWHERE句で絞れる |
| SERIAL/IDENTITY | シーケンスの糖衣構文。新規プロジェクトはIDENTITYカラム推奨 |
| よくあるミス | ENUM使いすぎ・外部キーのインデックス忘れ・TIMESTAMPTZの使い忘れ |
