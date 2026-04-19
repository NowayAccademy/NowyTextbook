# データ型の選び方とPK設計
適切なデータ型の選択と主キーの設計方針を学びます

## 本章の目標

本章では以下を目標にして学習します。

- PostgreSQLの主要なデータ型の特徴と使い分けを説明できること
- 数値・文字列・日時型で適切な型を選択できること
- SERIAL・BIGSERIAL・UUIDのPK設計それぞれのメリット・デメリットを説明できること

## 1. 整数型（SMALLINT, INTEGER, BIGINT）

### 整数型の種類と範囲

| 型名 | バイト数 | 最小値 | 最大値 | 別名 |
| --- | --- | --- | --- | --- |
| **SMALLINT** | 2バイト | -32,768 | 32,767 | INT2 |
| **INTEGER** | 4バイト | -2,147,483,648 | 2,147,483,647（約21億） | INT, INT4 |
| **BIGINT** | 8バイト | -9,223,372,036,854,775,808 | 9,223,372,036,854,775,807 | INT8 |

### いつ何を使うか

```sql
-- 年齢・フラグのような小さな値
CREATE TABLE products (
    stock_count  SMALLINT NOT NULL DEFAULT 0,  -- 在庫数（最大32,767個で十分な場合）
    display_order SMALLINT NOT NULL DEFAULT 0   -- 表示順（数百程度）
);

-- 一般的なIDや件数
CREATE TABLE orders (
    id         INTEGER PRIMARY KEY,  -- 21億件まで大丈夫
    user_id    INTEGER NOT NULL,
    item_count INTEGER NOT NULL DEFAULT 1
);

-- 大量データやIDが21億を超える可能性がある場合
CREATE TABLE access_logs (
    id         BIGINT PRIMARY KEY,   -- アクセスログは大量になることが多い
    user_id    BIGINT,
    page_views BIGINT NOT NULL DEFAULT 0
);
```

> **ポイント**  
> 迷ったら `INTEGER` を選んでおけば大抵は問題ありません。21億レコードを超えるテーブルは少ないですが、将来の拡張を考えると主キーは最初から `BIGINT`（または `BIGSERIAL`）にしておくのが安全です。

## 2. 小数型（NUMERIC/DECIMAL, REAL, DOUBLE PRECISION）

### 小数型の種類と特徴

| 型名 | 特徴 | 用途 |
| --- | --- | --- |
| **NUMERIC(p,s)** | 精度を正確に保証する。演算が遅い | 金額・税率など精度が重要なもの |
| **DECIMAL(p,s)** | NUMERICと同じ（別名） | 同上 |
| **REAL** | 4バイト浮動小数点。約6桁の精度 | 精度が重要でない計算 |
| **DOUBLE PRECISION** | 8バイト浮動小数点。約15桁の精度 | 科学技術計算など |

`NUMERIC(p, s)` の `p` は全体の桁数、`s` は小数点以下の桁数です。

```sql
-- 金額には必ず NUMERIC を使う
CREATE TABLE order_items (
    id       SERIAL  PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    price    NUMERIC(10, 2) NOT NULL,  -- 最大9999999999.99円
    quantity INTEGER NOT NULL DEFAULT 1,
    tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.1000  -- 例：10% = 0.1000
);

-- 浮動小数点の誤差の例（危険な使い方）
SELECT 0.1 + 0.2;
-- result: 0.30000000000000004  ← REAL/DOUBLE PRECISIONでは誤差が出る

SELECT CAST(0.1 AS NUMERIC) + CAST(0.2 AS NUMERIC);
-- result: 0.3  ← NUMERICは正確
```

> **注意**  
> 金額には絶対に `REAL` や `DOUBLE PRECISION` を使わないでください。浮動小数点の誤差により、計算結果が 100円 → 99.99999... 円のようにずれることがあります。金額・税率・割引率は必ず `NUMERIC` を使います。

## 3. 文字列型（CHAR, VARCHAR, TEXT）

### 文字列型の種類と違い

| 型名 | 特徴 | 使いどころ |
| --- | --- | --- |
| **CHAR(n)** | n文字固定長。短い場合は空白で埋める | 都道府県コード等の固定長コード値 |
| **VARCHAR(n)** | n文字まで可変長 | 制限をかけたい文字列フィールド |
| **TEXT** | 長さ制限なし可変長 | 本文、説明文など長さが不定のもの |

### 現場での使い分け

```sql
-- CHAR：固定長コード値（使いどころは限られる）
CREATE TABLE prefectures (
    code CHAR(2) PRIMARY KEY,   -- '01', '13' のような都道府県コード
    name VARCHAR(10) NOT NULL
);

-- VARCHAR：上限を明示したい場合
CREATE TABLE users (
    id       SERIAL       PRIMARY KEY,
    username VARCHAR(50)  NOT NULL,    -- ユーザー名は50文字まで
    email    VARCHAR(255) NOT NULL,    -- メールアドレスは最大255文字
    phone    VARCHAR(20)               -- 電話番号
);

-- TEXT：長さが不定の文字列
CREATE TABLE articles (
    id      SERIAL  PRIMARY KEY,
    title   VARCHAR(255) NOT NULL,  -- タイトルは長さ制限あり
    content TEXT    NOT NULL,       -- 本文は長さ制限なし
    summary TEXT                    -- 要約（NULL許容）
);
```

> **ポイント**  
> PostgreSQLでは `TEXT` と `VARCHAR` のパフォーマンス差はほぼありません。「制限を明示したい（例：ユーザー名は50文字まで）」なら `VARCHAR(n)`、「制限を設けない」なら `TEXT` と使い分けると明確です。`CHAR` は空白パディングの挙動が紛らわしいため、現場ではほぼ使われません。

### CHARの注意点

```sql
-- CHAR(5) に 'ABC' を格納すると 'ABC  '（空白2つで埋まる）
CREATE TABLE test_char (val CHAR(5));
INSERT INTO test_char VALUES ('ABC');

SELECT val, LENGTH(val) FROM test_char;
-- val   | length
-- ------+--------
-- ABC   |      5  ← 空白込みで5文字

-- 比較も注意が必要
SELECT * FROM test_char WHERE val = 'ABC';    -- ヒットする（空白を無視して比較）
SELECT * FROM test_char WHERE val = 'ABC  '; -- これもヒットする
```

## 4. 日付・時刻型（DATE, TIME, TIMESTAMP, TIMESTAMPTZ）

### 日付・時刻型の種類

| 型名 | 格納内容 | 例 |
| --- | --- | --- |
| **DATE** | 日付のみ（時刻なし） | `2024-01-15` |
| **TIME** | 時刻のみ（日付なし） | `10:30:00` |
| **TIMESTAMP** | 日付＋時刻（タイムゾーンなし） | `2024-01-15 10:30:00` |
| **TIMESTAMPTZ** | 日付＋時刻＋タイムゾーン情報 | `2024-01-15 10:30:00+09` |

### タイムゾーンの注意

```sql
-- DATE：日付だけ（誕生日、イベント日など）
CREATE TABLE events (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,        -- 「2024年3月1日」という日付
    start_time TIME,                 -- 「10:00」という時刻
    end_time   TIME
);

-- TIMESTAMP vs TIMESTAMPTZ
CREATE TABLE audit_logs (
    id         SERIAL      PRIMARY KEY,
    action     VARCHAR(100) NOT NULL,
    -- タイムゾーンなし：サーバーのローカル時刻として保存（おすすめしない）
    created_at_local TIMESTAMP,
    -- タイムゾーンあり：UTCに変換して保存し、取得時にタイムゾーンを適用（推奨）
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- タイムゾーンの確認
SHOW timezone;
-- TimeZone
-- ----------
-- Asia/Tokyo

-- TIMESTAMPTZの動作確認
INSERT INTO audit_logs (action) VALUES ('ログイン');
SELECT created_at FROM audit_logs;
-- created_at
-- ----------------------------
-- 2024-01-15 10:30:00+09  ← 日本時間で表示される
```

> **ポイント**  
> 日時を保存するときは基本的に `TIMESTAMPTZ`（タイムゾーン付き）を使いましょう。複数国で使うサービスや、将来の国際化を考えるとタイムゾーン情報があった方が安全です。「いつ起きたか」という事実を正確に記録できます。

## 5. BOOLEAN型

```sql
-- BOOLEAN型の使い方
CREATE TABLE users (
    id         SERIAL  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,   -- アクティブかどうか
    is_admin   BOOLEAN NOT NULL DEFAULT FALSE,  -- 管理者かどうか
    email_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- BOOLEANの値
INSERT INTO users (name, is_active, is_admin) VALUES ('田中太郎', TRUE, FALSE);
INSERT INTO users (name, is_active, is_admin) VALUES ('管理者', TRUE, TRUE);

-- BOOLEAN条件の書き方
SELECT * FROM users WHERE is_active = TRUE;
SELECT * FROM users WHERE is_active;          -- TRUE と同じ意味
SELECT * FROM users WHERE NOT is_admin;       -- is_admin = FALSE と同じ意味
SELECT * FROM users WHERE is_active IS TRUE;  -- NULL も区別する厳密な書き方
```

> **ポイント**  
> `BOOLEAN` は `TRUE` / `FALSE` だけでなく `NULL` も取り得ます。「未設定」と「FALSE」を区別する必要があれば `NOT NULL` 制約を付けるか、`NULL` の意味を明確にしてください。

## 6. その他（UUID, JSONB）

### UUID型

UUID（Universally Unique Identifier）は、128ビットの一意な識別子です。  
`550e8400-e29b-41d4-a716-446655440000` のような形式です。

```sql
-- UUIDを主キーに使う例
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- UUID生成関数を有効化

CREATE TABLE sessions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INTEGER     NOT NULL,
    token_data TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- UUIDが自動生成される
INSERT INTO sessions (user_id, token_data, expires_at)
VALUES (1, 'some_token_data', NOW() + INTERVAL '1 hour');

SELECT id FROM sessions;
-- id
-- ------------------------------------
-- 550e8400-e29b-41d4-a716-446655440000  ← ランダムなUUID
```

### JSONB型

JSONB型は、JSONデータをバイナリ形式で保存する型です。  
JSON形式のデータを格納しながら、JSONパスで検索もできます。

```sql
-- JSONB型の使い方
CREATE TABLE product_attributes (
    id         SERIAL  PRIMARY KEY,
    product_id INTEGER NOT NULL,
    attributes JSONB   NOT NULL  -- 商品ごとに異なる属性を格納
);

INSERT INTO product_attributes (product_id, attributes)
VALUES (1, '{"color": "red", "size": "L", "material": "cotton"}');

-- JSONBの特定フィールドで検索
SELECT * FROM product_attributes
WHERE attributes->>'color' = 'red';

-- JSONBフィールドの取得
SELECT
    product_id,
    attributes->>'color' AS color,
    attributes->>'size'  AS size
FROM product_attributes;
```

> **ポイント**  
> `JSONB` は柔軟ですが、スキーマが不明確になり整合性チェックが難しくなります。「カラムを頻繁に追加・変更する部分」や「商品ごとに属性が異なる」ような場合に有効ですが、乱用は避けましょう。

## 7. PK設計（SERIAL vs BIGSERIAL vs UUID）

### 各PKのメリット・デメリット

| 方式 | 型 | メリット | デメリット |
| --- | --- | --- | --- |
| **SERIAL** | 4バイト整数 | シンプル、小さい、JOIN が速い | 21億件で上限、分散環境では使いにくい |
| **BIGSERIAL** | 8バイト整数 | 事実上上限なし、SERIALより安全 | SERIALより若干サイズが大きい |
| **UUID** | 16バイト | 分散環境でも一意、予測不可 | サイズが大きい、読みにくい、インデックスが大きくなる |

```sql
-- SERIAL（小規模・中規模システムのデフォルト選択肢）
CREATE TABLE categories (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- BIGSERIAL（大規模データや将来の拡張を見越して）
CREATE TABLE access_logs (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT,
    path       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- UUID（マイクロサービス、外部公開API、セキュリティ上IDを予測されたくない場合）
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE api_keys (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    INTEGER     NOT NULL,
    key_name   VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- GENERATED ALWAYS AS IDENTITY（PostgreSQL 10以降の推奨方式）
CREATE TABLE products (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
```

> **ポイント**  
> 現場では迷ったら `BIGSERIAL` が安全な選択肢です。`SERIAL`（INTEGER）は将来21億件を超えた場合に型変更が必要になりますが、`BIGSERIAL` ならその心配がありません。UUIDは特定の要件がある場合に使います。

> **現場メモ**  
> UUID vs BIGINT の議論は今でも現場で起きます。「UUIDを使いたい」という意見には「なぜUUIDが必要か」を明確にすることが大事です。「分散システムで複数のDBをマージする予定がある」「APIのURLにIDを出すのでシーケンシャルな連番は避けたい」という明確な理由があるなら正当です。一方「なんとなく安全そう」という理由でUUIDを選ぶと、大量データのJOINでインデックスが膨らんでパフォーマンスに影響します。筆者がいたプロジェクトで、UUIDをPKにした結果、インデックスが通常の2〜3倍のサイズになり、メモリ使用量が増えてクエリが遅くなった経験があります。「何百万件以下のシステムならBIGSERIALで十分」と覚えておくといいでしょう。

## 8. 現場でよくある型選択ミス

### ミス1：金額にREALを使う

```sql
-- 悪い例
CREATE TABLE prices (
    amount REAL NOT NULL  -- 浮動小数点で計算誤差が出る
);

-- 良い例
CREATE TABLE prices (
    amount NUMERIC(12, 2) NOT NULL  -- 正確な金額を保存
);
```

### ミス2：日時をVARCHARで保存する

```sql
-- 悪い例
CREATE TABLE events (
    event_date VARCHAR(20)  -- '2024-01-15' を文字列で保存
    -- 文字列比較になるため、日付計算・ソートが正しく動かない
);

-- 良い例
CREATE TABLE events (
    event_date DATE NOT NULL,  -- 日付型で保存
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### ミス3：主キーをINTEGERにして後で困る

```sql
-- 将来困る可能性がある例
CREATE TABLE user_actions (
    id      INTEGER PRIMARY KEY,  -- アクセスログなど大量データのテーブルで21億超えのリスク
    user_id INTEGER
);

-- 最初からBIGSERIALにしておく
CREATE TABLE user_actions (
    id      BIGSERIAL PRIMARY KEY,
    user_id INTEGER
);
```

### ミス4：VARCHARの長さを短く設定しすぎる

```sql
-- 後で長さ変更が必要になる例
CREATE TABLE users (
    address VARCHAR(50)   -- 実際の住所は100文字超えることが多い
);

-- 適切な長さにする
CREATE TABLE users (
    address VARCHAR(500)  -- 余裕を持った長さに
    -- または TEXT でも良い
);
```

> **注意**  
> `VARCHAR(n)` の `n` を後から大きくする `ALTER TABLE` は基本的に問題ありませんが、小さくする場合はデータが切り捨てられるリスクがあります。最初に適切な長さを設定しておきましょう。

## ポイント

- **金額・価格に REAL / FLOAT を使っていないか**
  - 浮動小数点は丸め誤差が出る → NUMERIC（DECIMAL）を使う
- **タイムゾーンの扱いが統一されているか**
  - TIMESTAMP と TIMESTAMPTZ の混在は混乱の原因 → サーバー側はすべて TIMESTAMPTZ 推奨
- **PK に SERIAL（INTEGER）を使っているテーブルで将来的なデータ量に問題ないか**
  - 安全のため BIGSERIAL か GENERATED ALWAYS AS IDENTITY を推奨
- **VARCHAR の長さ制限が適切か**
  - 「VARCHAR(255) にとりあえず」ではなく、最大長を意識する
  - PostgreSQL では TEXT と VARCHAR の性能差はほぼないため TEXT でも可

---

## まとめ

| テーマ | 要点 |
| --- | --- |
| 整数型 | 迷ったら `INTEGER`。大量データは `BIGINT`/`BIGSERIAL` |
| 小数型 | 金額・税率は必ず `NUMERIC`。浮動小数点（REAL）は誤差が出る |
| 文字列型 | 現場では `VARCHAR(n)` か `TEXT` が主役。`CHAR` はほぼ使わない |
| 日付型 | 日付のみは `DATE`、日時は `TIMESTAMPTZ`（タイムゾーン付き）推奨 |
| BOOLEAN | `TRUE`/`FALSE`/`NULL` の3値。`NOT NULL` を付けることが多い |
| UUID | 分散環境や予測不可能なID生成に使用。インデックスが大きくなる点に注意 |
| JSONB | 柔軟なスキーマに使えるが乱用に注意 |
| PK設計 | 迷ったら `BIGSERIAL`。UUID は特定の要件がある場合に |

---

## 練習問題

### 問題1: 適切な数値型の選択

> 参照：[1. 整数型](#1-整数型smallint-integer-bigint) ・ [2. 小数型](#2-小数型numericdecimal-real-double-precision)

以下のカラムに最適な型を選び、理由を答えてください。

| カラム | 候補 |
|--------|------|
| 商品の価格（円） | INTEGER / NUMERIC(10,2) / REAL |
| 評価スコア（0.0〜5.0、小数1桁） | REAL / NUMERIC(3,1) / INTEGER |
| 在庫数（0〜100万） | SMALLINT / INTEGER / BIGINT |

<details>
<summary>回答を見る</summary>

| カラム | 推奨型 | 理由 |
|--------|--------|------|
| 商品の価格（円） | `INTEGER` | 円は整数なので整数型で十分。REAL/DOUBLE は浮動小数点誤差があるため金額に不適 |
| 評価スコア | `NUMERIC(3,1)` | 小数を正確に扱う必要があるため NUMERIC。REAL は 4.9 が 4.900000095... になる可能性がある |
| 在庫数 | `INTEGER` | 0〜100万は INTEGER（約±21億）の範囲内。SMALLINT（±32767）では不足する可能性 |

**解説：** 金額・スコアなど精度が重要な数値には `NUMERIC`（または `DECIMAL`）を使います。`REAL` や `DOUBLE PRECISION` は科学計算向けで、わずかな誤差が生じます。整数は範囲を見てSMALLINT/INTEGER/BIGINTを選びます。

</details>

### 問題2: 日時型の選択

> 参照：[4. 日付・時刻型](#4-日付・時刻型date-time-timestamp-timestamptz)

以下のカラムに最適な型を選び、理由を答えてください。

| カラム | 候補 |
|--------|------|
| 記事の公開日 | DATE / TIMESTAMP / TIMESTAMPTZ |
| ユーザーの登録日時 | DATE / TIMESTAMP / TIMESTAMPTZ |
| 営業時間の開始時刻 | TIME / TIMETZ / TEXT |

<details>
<summary>回答を見る</summary>

| カラム | 推奨型 | 理由 |
|--------|--------|------|
| 記事の公開日 | `DATE` | 日付だけ管理すれば十分。時刻情報は不要 |
| ユーザーの登録日時 | `TIMESTAMPTZ` | タイムゾーン込みで記録することで、サーバーがどの地域にあっても正確な時刻が保持される |
| 営業時間の開始時刻 | `TIME` | 時刻だけを保持する専用型。タイムゾーンは通常不要 |

**解説：** 日時型は `TIMESTAMPTZ`（タイムゾーン付きタイムスタンプ）が現代の標準です。タイムゾーンなしの `TIMESTAMP` は後からタイムゾーンが変わったときに混乱します。「日付だけ」なら `DATE`、「時刻だけ」なら `TIME` を使います。

</details>

### 問題3: PKの設計

> 参照：[7. PK設計](#7-pk設計serial-vs-bigserial-vs-uuid)

新しいECサイトの注文テーブル (`orders`) を設計します。以下の要件でどの主キー設計を選びますか？

- 将来的にマイクロサービス分割の可能性がある
- 注文IDを外部システム（物流・決済）に共有する必要がある
- 1日あたり最大10万件の注文

<details>
<summary>回答を見る</summary>

**推奨：UUID**

```sql
CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id BIGINT NOT NULL,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**解説：** 上記の要件では UUID が適切です。
- **マイクロサービス**：複数のサービスがそれぞれDBを持つ場合、SERIAL は重複する可能性がある。UUIDは分散環境でも衝突しない
- **外部システム共有**：連番（1,2,3...）は推測可能で悪意ある利用（「注文が全部で何件あるか」推測）のリスクがある
- **件数**：1日10万件は BIGSERIAL でも対応できるが、将来拡張も考慮

1日10万件程度でマイクロサービス化の予定がなければ `BIGSERIAL` でも十分です。

</details>
