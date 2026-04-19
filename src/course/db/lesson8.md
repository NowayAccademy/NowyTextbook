# 正規化
更新異常をなくし、データの整合性を保つための正規化（1NF〜3NF）を学びます

## 本章の目標

本章では以下を目標にして学習します。

- 正規化が必要な理由（更新異常・挿入異常・削除異常）を説明できること
- 第1正規形（1NF）・第2正規形（2NF）・第3正規形（3NF）の意味を説明できること
- 非正規形のテーブルを段階的に正規化できること
- 正規化のデメリットと非正規化の現場判断ができること

---

## 1. 正規化が必要な理由

正規化とは「データの重複をなくし、矛盾が生じにくい構造に整理すること」です。

なぜ必要かを具体的な失敗例で見ていきましょう。

### 問題のあるテーブル（非正規形）

「注文管理」を1つのテーブルで管理しようとした例です。

```
注文ID | 顧客名  | 顧客メール        | 商品名         | 数量 | 単価  | カテゴリ
-------|---------|------------------|---------------|------|-------|----------
  1    | 田中太郎 | tanaka@test.com  | ノートPC       |  1   | 80000 | 電子機器
  1    | 田中太郎 | tanaka@test.com  | マウス         |  2   |  2000 | 電子機器
  2    | 鈴木花子 | suzuki@test.com  | ノートPC       |  1   | 80000 | 電子機器
  3    | 田中太郎 | tanaka@test.com  | Tシャツ        |  3   |  3000 | 衣類
```

このテーブルには3種類の「異常」が潜んでいます。

### 更新異常（Update Anomaly）

田中太郎のメールアドレスが変わった場合、**全行を更新する必要があります**。1行でも更新し忘れると、同じ人物のメールアドレスが複数の値になってしまいます。

```sql
-- これだけでは不完全（更新漏れが発生しやすい）
UPDATE orders SET 顧客メール = 'tanaka_new@test.com' WHERE 注文ID = 1;
-- 注文ID=3 の行を更新し忘れると矛盾が生まれる
```

### 挿入異常（Insert Anomaly）

新しい顧客を登録したいのに、その顧客がまだ注文をしていない場合、このテーブルには登録できません。なぜなら「注文ID」という主キーが必要だからです。

### 削除異常（Delete Anomaly）

注文ID=3の注文を削除すると、田中太郎が「Tシャツ」というカテゴリを注文したという情報と一緒に、「衣類」というカテゴリの情報も消えてしまいます。

> **ポイント**  
> 3つの異常はすべて「同じデータが複数の場所に重複して保存されている」ことが原因です。正規化はこの重複を排除することで、異常を防ぎます。

---

## 2. 非正規形の例（1テーブルに詰め込みすぎた例）

正規化の出発点となる、最もひどい非正規形のテーブルを見てみましょう。

```sql
-- 非正規形：受講管理テーブル（このまま作ってはいけない例）
CREATE TABLE enrollment_raw (
    student_id     INTEGER,
    student_name   VARCHAR(100),
    student_email  VARCHAR(255),
    advisor_id     INTEGER,
    advisor_name   VARCHAR(100),
    -- 複数の授業を1行に詰め込んでいる（繰り返しグループ）
    course1_id     INTEGER,
    course1_name   VARCHAR(100),
    course1_grade  VARCHAR(2),
    course2_id     INTEGER,
    course2_name   VARCHAR(100),
    course2_grade  VARCHAR(2),
    course3_id     INTEGER,
    course3_name   VARCHAR(100),
    course3_grade  VARCHAR(2)
);
```

このテーブルの問題点：
- 授業が4つ以上になるとカラムを追加しないといけない
- 授業を取っていない学生の `course2_id` などがNULLだらけになる
- `student_name` や `advisor_name` が何行にも重複する
- 特定の授業を受けている学生を検索しにくい

---

## 3. 第1正規形（1NF）：繰り返しグループの排除・原子値

### 1NFの定義

**すべてのカラムが原子値（それ以上分解できない値）を持ち、繰り返しグループが存在しないこと。**

言い換えると：
- 1つのセルに1つの値だけ入れる
- 「course1, course2, course3...」のような繰り返しカラムをなくす

### 1NFへの変換

```sql
-- 1NF: 繰り返しグループを排除したテーブル
CREATE TABLE enrollment_1nf (
    student_id    INTEGER      NOT NULL,
    student_name  VARCHAR(100) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    advisor_id    INTEGER      NOT NULL,
    advisor_name  VARCHAR(100) NOT NULL,
    course_id     INTEGER      NOT NULL,
    course_name   VARCHAR(100) NOT NULL,
    grade         VARCHAR(2),
    PRIMARY KEY (student_id, course_id)  -- 複合主キー
);
```

データのイメージ：

```
student_id | student_name | student_email      | advisor_id | advisor_name | course_id | course_name | grade
-----------|--------------|-------------------|-----------|--------------|-----------|-------------|------
     1     |  田中太郎    | tanaka@test.com   |    10     |   山田教授   |    101    |  数学基礎   |  A
     1     |  田中太郎    | tanaka@test.com   |    10     |   山田教授   |    102    |  英語I      |  B
     2     |  鈴木花子    | suzuki@test.com   |    11     |   佐藤教授   |    101    |  数学基礎   |  A+
```

> **ポイント**  
> 1NFにするだけで、授業が増えても行を追加するだけで対応できます。ただし、まだ `student_name` や `advisor_name` などの重複が残っています。

---

## 4. 第2正規形（2NF）：部分関数従属の排除

### 2NFの定義

**1NFを満たし、かつ、すべての非キー属性が複合主キー全体に従属していること（部分関数従属がないこと）。**

### 部分関数従属とは

1NFテーブルの主キーは `(student_id, course_id)` の複合主キーです。

- `student_name` は `student_id` だけで決まる → **部分関数従属**（問題あり）
- `course_name` は `course_id` だけで決まる → **部分関数従属**（問題あり）
- `grade` は `(student_id, course_id)` の両方がないと決まらない → **完全関数従属**（OK）

```
student_id ──→ student_name（student_idだけで決まる = 部分従属）
course_id  ──→ course_name（course_idだけで決まる = 部分従属）
(student_id, course_id) ──→ grade（両方必要 = 完全従属）
```

### 2NFへの変換

部分関数従属を排除するため、テーブルを分割します。

```sql
-- 学生テーブル（student_idに完全従属する属性を集める）
CREATE TABLE students (
    id            BIGSERIAL    PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    advisor_id    INTEGER      NOT NULL,
    advisor_name  VARCHAR(100) NOT NULL
);

-- 授業テーブル（course_idに完全従属する属性を集める）
CREATE TABLE courses (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 受講テーブル（複合主キー全体に従属する属性だけ残す）
CREATE TABLE enrollments (
    student_id INTEGER    NOT NULL REFERENCES students(id),
    course_id  INTEGER    NOT NULL REFERENCES courses(id),
    grade      VARCHAR(2),
    PRIMARY KEY (student_id, course_id)
);
```

> **ポイント**  
> 2NFにすることで、授業名の変更が `courses` テーブルの1行を変えるだけで済みます。1NFでは何行も更新が必要でした。

---

## 5. 第3正規形（3NF）：推移関数従属の排除

### 3NFの定義

**2NFを満たし、かつ、すべての非キー属性が主キーに直接従属していること（推移関数従属がないこと）。**

### 推移関数従属とは

2NFの `students` テーブルには、まだ問題があります。

```
student_id ──→ advisor_id ──→ advisor_name
```

`advisor_name` は `student_id` → `advisor_id` → `advisor_name` という**推移的な従属関係**にあります。これは主キーに「直接」従属していないことを意味します。

問題点：
- 同じ指導教員（advisor）を持つ学生が複数いると、`advisor_name` が重複する
- 指導教員の名前が変わったとき、複数行を更新する必要がある（更新異常）

### 3NFへの変換

推移関数従属を排除するため、指導教員をテーブルに分割します。

```sql
-- 指導教員テーブル（新たに分離）
CREATE TABLE advisors (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 学生テーブル（advisor_nameを削除し、advisor_idのみ外部キーとして保持）
CREATE TABLE students (
    id         BIGSERIAL    PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    advisor_id BIGINT       NOT NULL REFERENCES advisors(id)
);

-- 授業テーブル（変更なし）
CREATE TABLE courses (
    id   BIGSERIAL    PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 受講テーブル（変更なし）
CREATE TABLE enrollments (
    student_id BIGINT     NOT NULL REFERENCES students(id),
    course_id  BIGINT     NOT NULL REFERENCES courses(id),
    grade      VARCHAR(2),
    PRIMARY KEY (student_id, course_id)
);
```

### 正規化の全体像まとめ

| 段階 | 変換前 | 変換後 |
| --- | --- | --- |
| 非正規形 → 1NF | 繰り返しグループを1行に | 1行1つの値（原子値） |
| 1NF → 2NF | 複合主キーへの部分従属あり | 主キー全体への完全従属 |
| 2NF → 3NF | 非キー属性間の推移従属あり | 主キーへの直接従属のみ |

> **ポイント**  
> 「3NFまで正規化すれば現場では十分」と言われることが多いです。ボイス・コッド正規形（BCNF）・第4正規形・第5正規形なども存在しますが、一般的なWebアプリケーション開発では3NFで十分なケースがほとんどです。

---

## 6. 各段階でのテーブル変化をコードで示す

実際に正規化の各段階をSQL文で確認しましょう。

### 非正規形（出発点）

```sql
-- 非正規形：すべてを1つのテーブルに詰め込んでいる
CREATE TABLE orders_unnormalized (
    order_id       INTEGER,
    customer_name  VARCHAR(100),
    customer_email VARCHAR(255),
    customer_city  VARCHAR(50),
    city_zip_code  VARCHAR(10),  -- 都市が決まればZIPコードも決まる（推移従属）
    product1_name  VARCHAR(100),
    product1_price NUMERIC(10,2),
    product1_qty   INTEGER,
    product2_name  VARCHAR(100),  -- 繰り返しグループ
    product2_price NUMERIC(10,2),
    product2_qty   INTEGER
);
```

### 第1正規形（1NF）

```sql
-- 1NF: 繰り返しグループを排除
CREATE TABLE orders_1nf (
    order_id       INTEGER,
    customer_name  VARCHAR(100)  NOT NULL,
    customer_email VARCHAR(255)  NOT NULL,
    customer_city  VARCHAR(50)   NOT NULL,
    city_zip_code  VARCHAR(10)   NOT NULL,
    product_name   VARCHAR(100)  NOT NULL,
    product_price  NUMERIC(10,2) NOT NULL,
    quantity       INTEGER       NOT NULL,
    PRIMARY KEY (order_id, product_name)
);
```

### 第2正規形（2NF）

```sql
-- 2NF: 部分関数従属を排除
-- 顧客情報を分離（order_idだけでは決まらない）
CREATE TABLE customers_2nf (
    id    BIGSERIAL    PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL,
    city  VARCHAR(50)  NOT NULL,
    zip   VARCHAR(10)  NOT NULL
);

-- 商品情報を分離（product_nameだけで決まる）
CREATE TABLE products_2nf (
    id    BIGSERIAL     PRIMARY KEY,
    name  VARCHAR(100)  NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL
);

-- 注文テーブル（主キー全体に従属する情報のみ）
CREATE TABLE orders_2nf (
    id          BIGSERIAL PRIMARY KEY,
    customer_id BIGINT    NOT NULL REFERENCES customers_2nf(id),
    ordered_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 注文明細（order_idとproduct_idの両方が必要）
CREATE TABLE order_items_2nf (
    order_id   BIGINT  NOT NULL REFERENCES orders_2nf(id),
    product_id BIGINT  NOT NULL REFERENCES products_2nf(id),
    quantity   INTEGER NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

### 第3正規形（3NF）

```sql
-- 3NF: 推移関数従属を排除
-- city → zip の推移従属を解消するために都市テーブルを分離
CREATE TABLE cities (
    id       BIGSERIAL   PRIMARY KEY,
    name     VARCHAR(50) NOT NULL UNIQUE,
    zip_code VARCHAR(10) NOT NULL
);

-- 顧客テーブルから city と zip を削除し、city_id で参照
CREATE TABLE customers (
    id      BIGSERIAL    PRIMARY KEY,
    email   VARCHAR(255) NOT NULL UNIQUE,
    name    VARCHAR(100) NOT NULL,
    city_id BIGINT       NOT NULL REFERENCES cities(id)
);

-- 商品テーブル（変更なし）
CREATE TABLE products (
    id    BIGSERIAL     PRIMARY KEY,
    name  VARCHAR(100)  NOT NULL UNIQUE,
    price NUMERIC(10,2) NOT NULL
);

-- 注文テーブル（変更なし）
CREATE TABLE orders (
    id          BIGSERIAL   PRIMARY KEY,
    customer_id BIGINT      NOT NULL REFERENCES customers(id),
    ordered_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 注文明細テーブル（変更なし）
CREATE TABLE order_items (
    order_id   BIGINT  NOT NULL REFERENCES orders(id),
    product_id BIGINT  NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,  -- 注文時の価格を記録
    PRIMARY KEY (order_id, product_id)
);
```

> **ポイント**  
> `order_items` に `unit_price` を持たせていることに注目してください。商品の価格は後から変わることがあります。その注文時点の価格を記録するために、`products.price` への参照ではなく、注文時点の価格を`unit_price` として保持するのが正しい設計です。

---

## 7. 正規化のデメリットと非正規化（現場での判断）

正規化はメリットが大きい一方で、デメリットもあります。

### 正規化のデメリット

| デメリット | 説明 |
| --- | --- |
| JOINが増える | テーブルが増えるほど、データを取得するためのJOINも増える |
| クエリが複雑になる | 複数テーブルをJOINするSQLは読みにくくなる |
| パフォーマンスが低下する可能性 | 大量データのJOINはインデックスがないと遅い |

### 非正規化が有効なケース（現場判断）

完全な3NFが常に正解とは限りません。以下のような場面では**意図的に非正規化**することがあります。

```sql
-- 例：注文の合計金額をあらかじめ計算して保持する（非正規化）
-- 本来は order_items の合計を計算すればいいが、
-- 毎回集計するのが重い場合は冗長に持つ

CREATE TABLE orders (
    id          BIGSERIAL     PRIMARY KEY,
    customer_id BIGINT        NOT NULL REFERENCES customers(id),
    total_price NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 非正規化：集計結果を保持
    ordered_at  TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
-- 例：履歴テーブルは意図的に非正規化する
-- ユーザー名が後から変わっても、操作時点の名前を保持したい
CREATE TABLE audit_logs (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    user_name   VARCHAR(100) NOT NULL,  -- 非正規化：変更されても記録を保持
    action      VARCHAR(50)  NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

> **ポイント**  
> 非正規化は「問題があると分かってやる」のが前提です。「なんとなく1つのテーブルに詰め込む」のは設計ミスですが、「パフォーマンス上の理由で意図的に冗長を許容する」のは正当な判断です。非正規化の理由をコメントに書き残しましょう。

> **現場メモ**  
> 「正規化しすぎてJOINが5段になり、誰もクエリを読めなくなった」という経験があります。第3正規形を厳格に適用し続けたテーブル設計が、開発が進むにつれて複雑なJOINの巣窟になってしまったケースです。正規化は「更新異常を防ぐため」のものですが、更新頻度の低いマスタデータや分析用のレポートテーブルでは、意図的に非正規化してパフォーマンスと可読性を優先することも正当な判断です。「第3正規形まで正規化するのが正解」と思い込まず、「このテーブルのユースケースに正規化のデメリットが上回る場面はあるか」を設計時に議論することをお勧めします。

### 読み取り専用の集計テーブル（マテリアライズドビュー）

集計が重い場合は、マテリアライズドビューで結果をキャッシュする方法も現場でよく使われます。

```sql
-- 商品カテゴリごとの月次売上サマリー（非正規化データの例）
CREATE MATERIALIZED VIEW monthly_sales_summary AS
SELECT
    p.category_id,
    DATE_TRUNC('month', o.ordered_at) AS month,
    SUM(oi.quantity * oi.unit_price) AS total_sales,
    COUNT(DISTINCT o.id) AS order_count
FROM order_items oi
JOIN orders o   ON oi.order_id = o.id
JOIN products p ON oi.product_id = p.id
GROUP BY p.category_id, DATE_TRUNC('month', o.ordered_at);

-- マテリアライズドビューを更新（新しいデータを反映）
REFRESH MATERIALIZED VIEW monthly_sales_summary;
```

---

## 8. よくあるミス

### ミス1: 主キーを複合キーにしすぎる

```sql
-- 悪い例：複合主キーが多すぎて、他のテーブルから参照しにくい
CREATE TABLE order_items (
    order_id   INTEGER,
    product_id INTEGER,
    shop_id    INTEGER,
    PRIMARY KEY (order_id, product_id, shop_id)
);
-- 他のテーブルからこの行を参照するには3つのカラムが必要

-- 良い例：サロゲートキー（代理キー）を導入する
CREATE TABLE order_items (
    id         BIGSERIAL PRIMARY KEY,
    order_id   BIGINT    NOT NULL REFERENCES orders(id),
    product_id BIGINT    NOT NULL REFERENCES products(id),
    shop_id    BIGINT    NOT NULL REFERENCES shops(id),
    UNIQUE (order_id, product_id, shop_id)  -- ビジネス上の一意制約は別途
);
```

### ミス2: 正規化を意識せずNULLを乱用する

```sql
-- 悪い例：オプションの情報をNULLで表現しすぎる
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255),  -- NULLの場合もあるのに意図が不明
    corporate_name  VARCHAR(100),  -- 法人の場合のみ
    department_name VARCHAR(100),  -- 法人の場合のみ
    position_title  VARCHAR(100)   -- 法人の場合のみ
);

-- 良い例：オプションの属性を別テーブルに分ける（1対0〜1の関係）
CREATE TABLE users (
    id    BIGSERIAL    PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE corporate_profiles (
    user_id        BIGINT       PRIMARY KEY REFERENCES users(id),
    corporate_name VARCHAR(100) NOT NULL,
    department     VARCHAR(100),
    position       VARCHAR(100)
);
```

### ミス3: 参照データを文字列でコピーしてしまう

```sql
-- 悪い例：カテゴリ名を直接保存する（更新異常が起きる）
CREATE TABLE products (
    id            BIGSERIAL    PRIMARY KEY,
    category_name VARCHAR(50)  NOT NULL,  -- カテゴリ名が変わったら全行更新が必要
    name          VARCHAR(100) NOT NULL
);

-- 良い例：IDで参照する
CREATE TABLE categories (
    id   BIGSERIAL   PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE products (
    id          BIGSERIAL    PRIMARY KEY,
    category_id BIGINT       NOT NULL REFERENCES categories(id),
    name        VARCHAR(100) NOT NULL
);
```

> **注意**  
> 「カテゴリ名は変わらないから大丈夫」という思い込みは危険です。ビジネスの変化に伴い、カテゴリ名は変わります。正規化された設計なら `categories` テーブルの1行を更新するだけで済みますが、非正規化された設計では何万行も更新が必要になります。

---

## 9. ポイント

- **繰り返しグループ（複数値を1カラムにカンマ区切りで持つなど）がないか（1NF）**
  - `tags: "A,B,C"` のような設計は検索・更新が困難になる
- **部分関数従属がないか（2NF）— 複合主キーを使う場合は特に確認**
  - 主キーの一部だけに依存するカラムは別テーブルに分割する
- **「意図的な非正規化」にコメントがあるか**
  - パフォーマンス上の理由でデノーマライズしている場合は、なぜ非正規化したかを明記する
- **JOINが多くなりすぎていないか（正規化しすぎの兆候）**
  - 1クエリで5テーブル以上JOINが必要になる場合は設計の見直しを検討

---

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| 正規化の目的 | 更新異常・挿入異常・削除異常を防ぐ |
| 更新異常 | 重複データの一部だけ更新されて矛盾が生じる |
| 挿入異常 | 主キー情報がないとデータを登録できない |
| 削除異常 | 削除したくないデータが一緒に消えてしまう |
| 1NF | 繰り返しグループをなくし、原子値のみにする |
| 2NF | 複合主キーへの部分関数従属を排除する |
| 3NF | 非キー属性間の推移関数従属を排除する |
| 非正規化 | 意図的な冗長化。パフォーマンスや履歴保持のために行う |
| よくあるミス | ENUMの多用・NULL乱用・文字列でのデータコピー |

---

## 練習問題

### 問題1: 第1正規形（1NF）の適用

> 参照：[3. 第1正規形（1NF）](#3-第1正規形1nf繰り返しグループの排除・原子値)

以下のテーブルは非正規形です。第1正規形に変換してください。

```
orders テーブル（非正規形）
| order_id | customer | products               |
|----------|----------|------------------------|
|        1 | 田中     | ノートPC, マウス       |
|        2 | 鈴木     | キーボード             |
```

<details>
<summary>回答を見る</summary>

**第1正規形（1NF）：セルに複数値を持たせない**

```sql
-- 1NF: 1セル1値
CREATE TABLE order_items (
  order_id    INTEGER NOT NULL,
  customer    TEXT NOT NULL,
  product     TEXT NOT NULL,
  PRIMARY KEY (order_id, product)
);

-- データ
-- order_id | customer | product
--        1 | 田中     | ノートPC
--        1 | 田中     | マウス
--        2 | 鈴木     | キーボード
```

**解説：** 1NF の条件は「各カラムが原子値（分割できない単一値）を持つ」ことです。`'ノートPC, マウス'` のようなカンマ区切りは1NF違反です。ただし、この状態ではまだ `customer` が `order_id` に依存しており、2NF・3NF への変換が続きます。

</details>

### 問題2: 第2正規形（2NF）と第3正規形（3NF）

> 参照：[4. 第2正規形（2NF）](#4-第2正規形2nf部分関数従属の排除) ・ [5. 第3正規形（3NF）](#5-第3正規形3nf推移関数従属の排除)

問題1の1NF テーブルを2NF、さらに3NFへと変換してください（注：`customer` は `order_id` に依存し、`product` だけには依存しない）。

<details>
<summary>回答を見る</summary>

**2NF への変換：部分関数従属を排除**

複合主キー `(order_id, product)` に対して `customer` は `order_id` だけに依存しているため分離します。

```sql
-- orders テーブル（order_id → customer）
CREATE TABLE orders (
  order_id INTEGER PRIMARY KEY,
  customer TEXT NOT NULL
);

-- order_items テーブル
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(order_id),
  product  TEXT NOT NULL,
  PRIMARY KEY (order_id, product)
);
```

**3NF への変換：推移関数従属を排除**

`customer` が氏名以外の情報（例：住所・メール）を持つ場合、それは customer に依存するため更に分離します。

```sql
CREATE TABLE customers (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  email    TEXT
);

CREATE TABLE orders (
  order_id    INTEGER PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id)
);
```

**解説：** 2NF は「複合主キーの一部にしか依存しないカラムを分離」、3NF は「主キー以外のカラムに依存するカラムをさらに分離」です。正規化を進めるほど更新異常が減りますが、JOIN が増えることとのバランスが重要です。

</details>

### 問題3: 非正規化の判断

> 参照：[7. 正規化のデメリットと非正規化](#7-正規化のデメリットと非正規化現場での判断)

以下のシナリオで、意図的な非正規化が適切かどうか判断してください。

> ECサイトの注文確認ページで「注文者名・商品名・購入時価格」を表示する。現在は `orders` → `customers` → `products` を毎回 JOIN して取得しているが、ページの表示が遅い。

<details>
<summary>回答を見る</summary>

**適切：注文時点の情報を非正規化して保持する**

```sql
CREATE TABLE order_items (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES orders(id),
  product_id      BIGINT NOT NULL REFERENCES products(id),
  -- 注文時点のスナップショット（非正規化）
  product_name    TEXT NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  quantity        INTEGER NOT NULL
);
```

**理由：**
- 商品名や価格は変更される可能性があるため、注文時点の値を保持することは業務的にも正しい（請求書の記録として）
- JOIN を減らしてパフォーマンスを改善できる
- これは「意図的な非正規化」であり、設計コメントに理由を記録しておく

**解説：** 非正規化は「パフォーマンスのため」と「業務的な履歴保持のため」の2種類があります。どちらの場合も、冗長化した理由をドキュメントやコメントに残すことが重要です。

</details>
