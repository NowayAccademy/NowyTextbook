# 制約
NOT NULL・UNIQUE・CHECK・DEFAULT・外部キー制約でデータの品質を守ります

## 本章の目標

本章では以下を目標にして学習します。

- なぜアプリ側のバリデーションだけでは不十分かを説明できること
- NOT NULL・UNIQUE・CHECK・DEFAULT・外部キー制約を正しく定義できること
- 制約違反エラーのメッセージを読んで、原因を特定できること

## 1. なぜ制約が必要か

### アプリ側だけでは不十分な理由

「バリデーション（入力値の検証）はアプリ側でやっているからDBの制約はいらない」と思いがちですが、実際の現場では以下のような経路でデータが書き込まれます。

```
データが書き込まれる経路（すべてにバリデーションを入れるのは困難）
  ┌─────────────────────────────────────────────────────┐
  │  Webアプリ（フロントエンドのバリデーション）           │
  │  APIサーバー（バックエンドのバリデーション）           │
  │  バッチ処理（手動実装が漏れやすい）                   │
  │  管理画面（別チームが開発）                          │
  │  データ移行スクリプト（一時的に作ったもの）           │
  │  直接SQLの実行（障害対応や手動修正）                  │
  └─────────────────────────────────────────────────────┘
            すべてのケースで → DB制約が守ってくれる
```

DB側に制約を入れておくと、どの経路からデータが来ても最後の砦として品質を保証できます。

> **ポイント**  
> 「DBの制約はアプリのバリデーションの代わり」ではなく「アプリのバリデーションに加えた最後の防衛ライン」です。両方あることで二重の安全が確保されます。

## 2. NOT NULL制約

### NOT NULLとは

NULL（値がない状態）を禁止する制約です。そのカラムには必ず何らかの値が入ることを保証します。

```sql
-- NOT NULL制約の定義
CREATE TABLE users (
    id        SERIAL       PRIMARY KEY,   -- PRIMARY KEY は暗黙的に NOT NULL
    name      VARCHAR(100) NOT NULL,      -- 必須項目
    email     VARCHAR(255) NOT NULL,      -- 必須項目
    phone     VARCHAR(20),               -- NULL 許容（任意項目）
    bio       TEXT,                       -- NULL 許容（自己紹介は任意）
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- NOT NULL 違反の例
INSERT INTO users (name, email) VALUES (NULL, 'test@example.com');
-- ERROR: null value in column "name" of relation "users" violates not-null constraint
-- DETAIL: Failing row contains (2, null, test@example.com, null, null, 2024-01-15...).

-- email を省略すると NOT NULL 違反
INSERT INTO users (name) VALUES ('田中太郎');
-- ERROR: null value in column "email" of relation "users" violates not-null constraint
```

### NOT NULLを付けるべきかどうかの判断

| 状況 | NOT NULL を付けるか |
| --- | --- |
| ビジネス上必須の項目（注文日時、ユーザー名など） | 付ける |
| 後から登録する任意の項目（プロフィール写真など） | NULL許容（付けない） |
| 真偽値フラグ（is_active など） | 付ける（デフォルト値と一緒に） |
| 外部キー（任意の関係） | 要件次第 |

> **ポイント**  
> 「必須かどうか分からない」場合は NULL 許容にしておくほうが安全です。後から NOT NULL を追加するのは既存データが NULL の場合に困りますが、逆（NOT NULL → NULL 許容）は比較的容易です。

> **現場メモ**  
> 稼働中の大規模テーブルに NOT NULL 制約を後から追加するのは、思っているより大変です。PostgreSQL 11以降では定数のDEFAULT値を同時指定すればメタデータのみの変更で済みますが、既存行に NULL が混在している場合は「まずバックフィル → 次にNOT NULL追加」という2ステップが必要です。あるプロジェクトで1億行テーブルのカラムにNOT NULLを追加しようとしたとき、既存のNULLを埋めるバッチ処理に数時間かかり、その間本番に影響が出ました。「本番テーブルへの制約追加は設計時に決めておく」ことが最善です。

## 3. UNIQUE制約

### UNIQUEとは

重複した値を禁止する制約です。主キーと異なり、NULL は許容します（ただし、NULLどうしは同一視されないことが多い）。

```sql
-- 単一カラムのUNIQUE制約
CREATE TABLE users (
    id       SERIAL       PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    email    VARCHAR(255) NOT NULL UNIQUE,  -- メールは重複不可
    username VARCHAR(50)  NOT NULL UNIQUE   -- ユーザー名も重複不可
);

-- 重複エラーの例
INSERT INTO users (name, email, username) VALUES ('田中', 'tanaka@example.com', 'tanaka');
INSERT INTO users (name, email, username) VALUES ('田中二郎', 'tanaka@example.com', 'tanaka2');
-- ERROR: duplicate key value violates unique constraint "users_email_key"
-- DETAIL: Key (email)=(tanaka@example.com) already exists.
```

### 複数カラムのUNIQUE制約（複合UNIQUE）

複数のカラムの組み合わせで一意性を保証する場合は、テーブル制約として定義します。

```sql
-- 「同じユーザーが同じ商品を重複してお気に入り登録できない」
CREATE TABLE favorites (
    id         SERIAL      PRIMARY KEY,
    user_id    INTEGER     NOT NULL,
    product_id INTEGER     NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, product_id)  -- この組み合わせで重複不可
);

-- user_id=1 が product_id=5 を2回登録しようとするとエラー
INSERT INTO favorites (user_id, product_id) VALUES (1, 5);  -- OK
INSERT INTO favorites (user_id, product_id) VALUES (1, 5);  -- エラー
-- ERROR: duplicate key value violates unique constraint "favorites_user_id_product_id_key"

-- ただし user_id=2, product_id=5 は別の組み合わせなので OK
INSERT INTO favorites (user_id, product_id) VALUES (2, 5);  -- OK
```

> **ポイント**  
> UNIQUE 制約は自動的にインデックスを作成します。検索条件によく使うカラムに UNIQUE 制約を付けると、検索性能の向上にもなります。

## 4. CHECK制約

### CHECKとは

カラムの値が特定の条件を満たすことを保証する制約です。「年齢は0以上」「ステータスは特定の値のみ」のような制限をDB側で強制できます。

```sql
-- CHECK制約の例
CREATE TABLE products (
    id          SERIAL         PRIMARY KEY,
    name        VARCHAR(255)   NOT NULL,
    price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),          -- 価格は0以上
    stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0), -- 在庫は0以上
    status      VARCHAR(20)    NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'deleted')),          -- ステータスは特定値のみ
    discount_rate NUMERIC(5, 4) CHECK (discount_rate >= 0 AND discount_rate <= 1.0)
    -- 割引率は 0.0 〜 1.0 の範囲
);

-- CHECK違反の例
INSERT INTO products (name, price, stock) VALUES ('テスト商品', -100, 0);
-- ERROR: new row for relation "products" violates check constraint "products_price_check"
-- DETAIL: Failing row contains (1, テスト商品, -100.00, 0, active, null).

INSERT INTO products (name, price, status) VALUES ('テスト商品', 1000, 'pending');
-- ERROR: new row for relation "products" violates check constraint "products_status_check"
```

### 複数カラムにまたがるCHECK制約

```sql
-- 開始日 ≤ 終了日 であることを保証する
CREATE TABLE campaigns (
    id         SERIAL  PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    start_date DATE    NOT NULL,
    end_date   DATE    NOT NULL,
    CHECK (start_date <= end_date)  -- テーブル制約として定義
);

-- 違反例
INSERT INTO campaigns (name, start_date, end_date)
VALUES ('夏セール', '2024-09-01', '2024-08-01');
-- ERROR: new row for relation "campaigns" violates check constraint "campaigns_check"
```

> **ポイント**  
> `CHECK` 制約はシンプルな条件には有効ですが、複雑なビジネスロジック（他テーブルを参照するような条件）はアプリ側で処理しましょう。DB制約には「他のテーブルの値を参照するCHECK」は書けません。

## 5. DEFAULT値

### DEFAULTとは

INSERT時にカラムの値が指定されなかった場合に使われるデフォルト値を設定します。

```sql
-- DEFAULT値の設定例
CREATE TABLE articles (
    id         SERIAL       PRIMARY KEY,
    title      VARCHAR(255) NOT NULL,
    content    TEXT         NOT NULL,
    status     VARCHAR(20)  NOT NULL DEFAULT 'draft',   -- デフォルトは下書き
    view_count INTEGER      NOT NULL DEFAULT 0,         -- デフォルトは0
    is_public  BOOLEAN      NOT NULL DEFAULT FALSE,     -- デフォルトは非公開
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 現在時刻
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- DEFAULT値を使ったINSERT（status, view_count, is_public, created_at, updated_at を省略できる）
INSERT INTO articles (title, content) VALUES ('初めての記事', 'こんにちは世界');

-- 結果確認
SELECT * FROM articles;
--  id |   title    |    content     | status | view_count | is_public |         created_at
-- ----+------------+----------------+--------+------------+-----------+--------------------------
--   1 | 初めての記事 | こんにちは世界  | draft  |          0 | f         | 2024-01-15 10:30:00+09
```

### DEFAULT で使える表現

```sql
-- 定数値
DEFAULT 'active'
DEFAULT 0
DEFAULT FALSE

-- 関数（PostgreSQL）
DEFAULT CURRENT_TIMESTAMP    -- 現在の日時（タイムゾーンなし）
DEFAULT CURRENT_DATE         -- 今日の日付
DEFAULT NOW()                -- 現在の日時（タイムゾーンあり）
DEFAULT gen_random_uuid()    -- UUIDの自動生成

-- NEXTVAL（シーケンス）
DEFAULT nextval('my_sequence')
```

> **ポイント**  
> `DEFAULT CURRENT_TIMESTAMP` と `DEFAULT NOW()` はほぼ同じですが、PostgreSQLでは `DEFAULT CURRENT_TIMESTAMP` が標準SQLに近い書き方です。`updated_at` カラムの自動更新は DEFAULT では設定できないため、トリガーや `ON CONFLICT DO UPDATE` を使います。

## 6. 外部キー制約（参照整合性、DDL構文）

### 外部キー制約の定義方法

外部キー制約の定義には2つの書き方があります。

```sql
-- 書き方1：カラム定義に直接記述（シンプルな場合）
CREATE TABLE orders (
    id          SERIAL  PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    amount      INTEGER NOT NULL
);

-- 書き方2：テーブル制約として定義（ON DELETE等を指定する場合、制約名を付ける場合）
CREATE TABLE orders (
    id          SERIAL  PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    amount      INTEGER NOT NULL,
    CONSTRAINT orders_customer_id_fk
        FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);
```

> **ポイント**  
> 外部キー制約はデータ整合性を守りますが、INSERT/UPDATE/DELETE のたびにチェックが走るため、大量の一括処理では一時的にパフォーマンスに影響することがあります。

## 7. 制約に名前をつける（CONSTRAINT名）

### 制約名の重要性

制約にカスタム名を付けることで、エラーメッセージが読みやすくなり、後からの変更も容易になります。

```sql
-- 制約名を付けた例（推奨）
CREATE TABLE users (
    id       SERIAL       PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    email    VARCHAR(255) NOT NULL,
    age      INTEGER,

    -- カラム制約に名前を付ける
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_age_positive CHECK (age >= 0 AND age <= 150)
);

-- 制約名を付けない場合、PostgreSQLが自動で付ける（読みにくい）
-- 例：users_email_key、users_age_check など

-- 後から制約を削除する場合（名前があると簡単）
ALTER TABLE users DROP CONSTRAINT users_age_positive;

-- 後から制約を追加する場合
ALTER TABLE users ADD CONSTRAINT users_age_positive CHECK (age >= 0 AND age <= 150);
```

### 制約名の命名規則（例）

| 制約の種類 | 命名例 |
| --- | --- |
| PRIMARY KEY | `テーブル名_pkey` |
| UNIQUE | `テーブル名_カラム名_key` または `テーブル名_カラム名_unique` |
| CHECK | `テーブル名_条件の説明_check` |
| FOREIGN KEY | `テーブル名_カラム名_fk` または `テーブル名_参照先テーブル名_fkey` |

```sql
-- 命名規則に従った例
CREATE TABLE order_items (
    id          SERIAL         PRIMARY KEY,
    order_id    INTEGER        NOT NULL,
    product_id  INTEGER        NOT NULL,
    quantity    INTEGER        NOT NULL,
    unit_price  NUMERIC(10,2)  NOT NULL,

    CONSTRAINT order_items_order_id_fk
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_product_id_fk
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT order_items_quantity_positive
        CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_positive
        CHECK (unit_price >= 0)
);
```

## 8. 制約違反エラーの読み方

### エラー別の読み方ガイド

```sql
-- ① NOT NULL 違反
-- ERROR:  null value in column "email" of relation "users" violates not-null constraint
-- DETAIL: Failing row contains (1, 田中太郎, null, ...).
-- 読み方：「email」カラムに NULL を入れようとした

-- ② UNIQUE 違反
-- ERROR:  duplicate key value violates unique constraint "users_email_unique"
-- DETAIL: Key (email)=(tanaka@example.com) already exists.
-- 読み方：「users_email_unique」制約に違反。tanaka@example.com が既に存在する

-- ③ CHECK 違反
-- ERROR:  new row for relation "products" violates check constraint "products_price_positive"
-- DETAIL: Failing row contains (1, テスト品, -100, ...).
-- 読み方：「products_price_positive」CHECK制約に違反。価格=-100が条件を満たさない

-- ④ 外部キー違反（子→存在しない親への参照）
-- ERROR:  insert or update on table "orders" violates foreign key constraint "orders_customer_id_fk"
-- DETAIL: Key (customer_id)=(999) is not present in table "customers".
-- 読み方：customer_id=999 が「customers」テーブルに存在しない

-- ⑤ 外部キー違反（子が存在する親の削除）
-- ERROR:  update or delete on table "customers" violates foreign key constraint "orders_customer_id_fk"
--         on table "orders"
-- DETAIL: Key (id)=(1) is still referenced from table "orders".
-- 読み方：id=1 がまだ「orders」テーブルから参照されているため削除できない
```

### エラーの対処パターン

| エラー | 原因 | 対処 |
| --- | --- | --- |
| NOT NULL違反 | 必須カラムにNULLを送った | アプリのバリデーションを確認する |
| UNIQUE違反 | 重複した値を登録しようとした | 事前に存在チェックをするか、UPSERT（INSERT ON CONFLICT）を使う |
| CHECK違反 | 許可されていない値を送った | 値の範囲・形式を確認する |
| 外部キー違反（挿入） | 存在しない親IDを指定した | 親のレコードを先に作成する |
| 外部キー違反（削除） | 子が存在する親を削除しようとした | 子を先に削除するか、CASCADEを設定する |

## ポイント

- **NOT NULL にすべきカラムが NULL 許容になっていないか**
  - 「後から NOT NULL に変えるのは大変」。設計時に決める
- **UNIQUE 制約が必要なカラムに制約が付いているか**
  - アプリ側だけで重複チェックをしていると、並行リクエストで重複が入ることがある
- **論理削除テーブルの UNIQUE 制約が部分インデックスになっているか**
  - 削除済みデータとの衝突を防ぐには `WHERE deleted_at IS NULL` の部分インデックスが必要
- **外部キー制約に CASCADE の設定が要件と一致しているか**
  - 親を消したとき子も消えるのか、子が残るとエラーにするのかを明確に
- **本番テーブルへの制約追加で、既存データが違反しないか事前確認したか**
  - `SELECT count(*) WHERE col IS NULL` などで確認してから制約を追加する

---

## まとめ

| テーマ | 要点 |
| --- | --- |
| 制約の必要性 | アプリ側のバリデーションを補完する最後の防衛ライン |
| NOT NULL | 必須カラムに付ける。後から追加は既存データがNULLだと困難 |
| UNIQUE | 重複禁止。複数カラムの組み合わせにも設定できる |
| CHECK | 値の範囲・形式をDB側で強制。他テーブル参照はできない |
| DEFAULT | 省略時の自動値。CURRENT_TIMESTAMP、0、FALSEなどが定番 |
| 外部キー | 参照整合性を保証。ON DELETE の動作を理解して設定する |
| 制約名 | カスタム名を付けるとエラーメッセージが読みやすい |

---

## 練習問題

### 問題1: 制約の追加

> 参照：[1. なぜ制約が必要か](#1-なぜ制約が必要か) ・ [4. CHECK制約](#4-check制約) ・ [5. DEFAULT値](#5-default値)

以下の要件を満たす `products` テーブルを定義してください。

- id：自動採番の主キー
- name：必須、255文字以内
- price：必須、0以上の整数
- stock：デフォルト 0、0以上
- category：`'food'`, `'electronics'`, `'clothing'` のいずれか

<details>
<summary>回答を見る</summary>

```sql
CREATE TABLE products (
  id       BIGSERIAL PRIMARY KEY,
  name     VARCHAR(255) NOT NULL,
  price    INTEGER NOT NULL CHECK (price >= 0),
  stock    INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category TEXT NOT NULL CHECK (category IN ('food', 'electronics', 'clothing'))
);
```

**解説：** `NOT NULL` で必須、`CHECK` で値の範囲やリストを制限、`DEFAULT` でデフォルト値を設定します。category のような固定値リストは `CHECK (category IN (...))` で表現できます（ENUM型でも書けますが、値の追加が ALTER TABLE 不要な CHECK の方が変更しやすい場合があります）。

</details>

### 問題2: 制約違反のエラー解読

> 参照：[8. 制約違反エラーの読み方](#8-制約違反エラーの読み方)

以下のエラーメッセージが出ました。何が問題で、どう修正すればよいですか？

```
ERROR:  new row for relation "products" violates check constraint "products_price_check"
DETAIL:  Failing row contains (1, 'テスト商品', -500, 0, 'food').
```

<details>
<summary>回答を見る</summary>

**問題：** `price` に `-500` という負の値を挿入しようとしたため、`CHECK (price >= 0)` 制約に違反しています。

**修正方法：**
```sql
-- 正しい price（0以上）を指定する
INSERT INTO products (name, price, stock, category)
VALUES ('テスト商品', 500, 0, 'food');
```

**解説：** エラーメッセージには制約名（`products_price_check`）と違反した行のデータが含まれます。制約名から「products テーブルの price カラムの CHECK 制約」と特定できます。制約名を自分で付けておくとエラーが読みやすくなります（例: `CONSTRAINT chk_price_positive CHECK (price >= 0)`）。

</details>

### 問題3: 外部キーの ON DELETE 動作

> 参照：[6. 外部キー制約](#6-外部キー制約参照整合性ddl構文)

`users` と `posts` テーブルがあります（users.id を posts.user_id が参照）。以下の要件それぞれで適切な `ON DELETE` を選んでください。

1. ユーザーを削除したら投稿も一緒に削除したい
2. 投稿がある限りユーザーを削除できないようにしたい
3. ユーザーを削除しても投稿は残し、作者不明として扱いたい

<details>
<summary>回答を見る</summary>

| 要件 | ON DELETE | 説明 |
|------|-----------|------|
| 1 | `CASCADE` | 親（users）削除時に子（posts）も自動削除 |
| 2 | `RESTRICT` または `NO ACTION` | 子が存在する限り親を削除できない |
| 3 | `SET NULL` | 親削除時に子の外部キーを NULL にする（posts.user_id は NULL 許容が必要） |

**解説：** デフォルト（指定なし）は `NO ACTION` で `RESTRICT` と同じ動作です。要件によって選択し、チーム内で統一しておくことが重要です。後から変更するのはマイグレーションが必要で影響範囲が大きいため、設計時に慎重に決めましょう。

</details>
