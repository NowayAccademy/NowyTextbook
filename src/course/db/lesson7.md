# ERDの読み書き
エンティティ関連図の記法を学び、要件からERDを描けるようにします

## 本章の目標

本章では以下を目標にして学習します。

- ERDとは何か、なぜ必要かを説明できること
- エンティティ・属性・カーディナリティの意味を説明できること
- IE記法（鳥の足記法）を使ってERDを読み取れること
- 簡単な要件からERDを描き起こせること
- 現場でのERDツールの使われ方を知ること

---

## 1. ERDとは何か（なぜ設計図が必要か）

**ERD（Entity Relationship Diagram / 実体関連図）** とは、データベースの構造を視覚的に表した設計図です。

建物を建てるとき、設計図なしに工事を始めると「壁が邪魔で配線できない」「後から間取りを変えるのが大工事になる」といった問題が起きます。データベースも同じで、設計図（ERD）なしに作り始めると：

- テーブル間の関係が不明確になる
- 後から構造変更が困難になる
- チームメンバーがデータの意味を共有できない

ERDを描くことで、これらの問題を事前に防げます。

### ERDに含まれる3つの要素

| 要素 | 意味 | データベース上での対応 |
| --- | --- | --- |
| **エンティティ（Entity）** | 管理したいモノや概念 | テーブル |
| **属性（Attribute）** | エンティティの特徴・情報 | カラム |
| **リレーション（Relationship）** | エンティティ間のつながり | 外部キー |

> **ポイント**  
> ERDは「データのことを知らない人にも理解してもらうための共通言語」です。エンジニアだけでなく、企画者やクライアントとの会話でも活躍します。

---

## 2. エンティティ（テーブル）・属性（カラム）の表記

### エンティティの書き方

ERDではエンティティを**長方形**で表します。長方形の中にテーブル名を書き、その下に属性（カラム）を列挙します。

```
+------------------+
|     users        |   ← エンティティ名（テーブル名）
+------------------+
| PK  id           |   ← 主キー（Primary Key）
|     email        |   ← 属性（カラム）
|     name         |
|     created_at   |
+------------------+
```

### 属性の種類と表記

| 記号 | 意味 |
| --- | --- |
| `PK` | 主キー（Primary Key）：行を一意に識別する |
| `FK` | 外部キー（Foreign Key）：他のテーブルを参照する |
| `UQ` | ユニーク制約（Unique）：重複不可 |
| `NN` | NOT NULL：空欄不可 |

### エンティティの例

```
+----------------------+       +----------------------+
|       users          |       |       orders         |
+----------------------+       +----------------------+
| PK  id               |       | PK  id               |
| UQ  email            |       | FK  user_id          |
|     name             |       |     status           |
|     is_active        |       |     total_price      |
|     created_at       |       |     ordered_at       |
+----------------------+       +----------------------+
```

---

## 3. カーディナリティ（1対1・1対多・多対多）

カーディナリティとは、「2つのエンティティ間に、どのくらいの数の関係があるか」を表します。

### 3種類のカーディナリティ

#### 1対1（One to One）

1人のユーザーは1つのプロフィールを持つ。1つのプロフィールは1人のユーザーに属する。

```
users ─────────────── user_profiles
（ユーザー）　　　　　（プロフィール）
  1                       1
```

実際の例：
- `users` テーブルと `user_profiles` テーブル
- `employees` テーブルと `employee_contracts` テーブル

#### 1対多（One to Many）

1人のユーザーは複数の注文を持てる。1つの注文は1人のユーザーにしか属せない。

```
users ──────────────< orders
（ユーザー）　　　　　（注文）
  1                    多
```

実際の例：
- `users` テーブルと `orders` テーブル
- `categories` テーブルと `products` テーブル

#### 多対多（Many to Many）

1人の学生は複数の授業を受けられる。1つの授業には複数の学生が受講できる。

```
students >────────────< courses
（学生）                （授業）
  多                     多
```

> **ポイント**  
> 多対多の関係はデータベースで直接表現できません。必ず**中間テーブル（関連テーブル）**を設けて「1対多 × 1対多」に分解します。

```
students ──────< student_courses >────── courses
（学生）        （受講記録：中間テーブル）   （授業）
  1                    多対多                  1
```

---

## 4. IE記法（鳥の足記法）の読み方

**IE記法（Information Engineering記法）** は別名「鳥の足記法」とも呼ばれ、現場で最もよく使われるERDの記法です。線の端の形で関係の種類を表します。

### IE記法の記号

| 記号 | 意味 | イメージ |
| --- | --- | --- |
| `│` （縦棒） | ちょうど1つ（必須） | 1本の線 |
| `○` （丸） | 0個（任意） | 丸＝ゼロ |
| `<` （カラス足） | 多数 | 鳥の足のように広がる |

### 組み合わせの意味

| 記号の組み合わせ | 読み方 | 意味 |
| --- | --- | --- |
| `│─│` | 1対1（必須-必須） | 必ずどちらも1つ存在 |
| `│─○` | 1対0または1（必須-任意） | 片方は必須、もう片方は任意 |
| `│─<` | 1対多（必須-多） | 左は1つ必須、右は複数 |
| `○─<` | 0または1対多（任意-多） | 左は0か1、右は複数 |
| `│─<` と `○─<` | よく使われるパターン | 1対多の関係 |

### 具体的な読み方の例

```
users ──│───○< orders
```

この記法は左から右に読むと：
- `users` 側の `│` : 注文は必ず1人のユーザーに属する（必須）
- `orders` 側の `○<` : 1人のユーザーは0件以上の注文を持てる（0以上）

つまり「1人のユーザーは0件以上の注文を持てる。1つの注文は必ず1人のユーザーに属する」という関係です。

---

## 5. ERDを読む練習（ECサイトの例）

以下はECサイトのERDです。テキストで表現します。

```
+------------------+     +------------------+     +------------------+
|     users        |     |     orders       |     |   order_items    |
+------------------+     +------------------+     +------------------+
| PK  id           |     | PK  id           |     | PK  id           |
|     email        |1   *|FK  user_id       |1   *|FK  order_id      |
|     name         |─────|     status       |─────|FK  product_id    |
|     created_at   |     |     total_price  |     |     quantity     |
+------------------+     |     ordered_at   |     |     unit_price   |
                         +------------------+     +------------------+
                                                           |*
                                                           |
                                                           |1
                                                  +------------------+
                                                  |    products      |
                                                  +------------------+
                                                  | PK  id           |
                                                  |FK  category_id   |
                                                  |     name         |
                                                  |     price        |
                                                  +------------------+
                                                           |*
                                                           |
                                                           |1
                                                  +------------------+
                                                  |   categories     |
                                                  +------------------+
                                                  | PK  id           |
                                                  |     name         |
                                                  +------------------+
```

### このERDの読み取り

- `users` と `orders` : 1人のユーザーは複数の注文を持てる（1対多）
- `orders` と `order_items` : 1つの注文は複数の注文明細を持てる（1対多）
- `products` と `order_items` : 1つの商品は複数の注文明細に含まれ得る（1対多）
- `categories` と `products` : 1つのカテゴリは複数の商品を含める（1対多）

> **ポイント**  
> `order_items` は `orders` と `products` の中間テーブルでもあります。「どの注文でどの商品を何個買ったか」を記録します。単純なIDの組み合わせだけでなく、`quantity`（数量）や `unit_price`（購入時の単価）など、その注文時点の情報も持っていることに注目してください。

---

## 6. ERDを書く練習（要件から起こす手順）

要件からERDを描く手順を、「図書館の貸出管理システム」を例に説明します。

### 要件

- 本を管理する。本には著者・タイトル・ISBNがある
- 会員が本を借りられる。会員には名前・メールアドレスがある
- 貸出には貸出日・返却予定日・実際の返却日がある
- 1人の会員が同時に複数の本を借りられる
- 同じ本の複数の蔵書（コピー）がある

### 手順1: エンティティを洗い出す

要件の中から「管理したいモノ」を見つけます。

- 本（books）
- 著者（authors）
- 蔵書（book_copies）：同じ本の複数コピー
- 会員（members）
- 貸出（loans）

### 手順2: 各エンティティの属性を定義する

```sql
-- 著者テーブル
CREATE TABLE authors (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 本テーブル
CREATE TABLE books (
    id         BIGSERIAL    PRIMARY KEY,
    author_id  BIGINT       NOT NULL REFERENCES authors(id),
    title      VARCHAR(255) NOT NULL,
    isbn       VARCHAR(13)  NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 蔵書テーブル（同じ本の複数コピー）
CREATE TABLE book_copies (
    id         BIGSERIAL    PRIMARY KEY,
    book_id    BIGINT       NOT NULL REFERENCES books(id),
    status     VARCHAR(20)  NOT NULL DEFAULT 'available'
                            CHECK (status IN ('available', 'borrowed', 'retired')),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 会員テーブル
CREATE TABLE members (
    id         BIGSERIAL    PRIMARY KEY,
    email      VARCHAR(255) NOT NULL UNIQUE,
    name       VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 貸出テーブル
CREATE TABLE loans (
    id              BIGSERIAL   PRIMARY KEY,
    member_id       BIGINT      NOT NULL REFERENCES members(id),
    book_copy_id    BIGINT      NOT NULL REFERENCES book_copies(id),
    borrowed_at     DATE        NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE        NOT NULL,
    returned_at     DATE        -- NULL = 未返却
);
```

### 手順3: リレーションを確認する

- `authors` と `books` : 1対多（1人の著者は複数の本を書ける）
- `books` と `book_copies` : 1対多（1冊の本に複数の蔵書がある）
- `members` と `loans` : 1対多（1人の会員は複数回貸し出せる）
- `book_copies` と `loans` : 1対多（1冊の蔵書は何度も貸し出される）

> **ポイント**  
> ERDを描くときは「動詞でリレーションを確認する」と整理しやすいです。「著者は本を書く」「会員は蔵書を借りる」のように、エンティティの間に動詞を入れてみましょう。関係がしっくりこない場合、エンティティの切り方が間違っている可能性があります。

---

## 7. 現場での使われ方

### 主要なERDツール

| ツール | 特徴 | 向いている場面 |
| --- | --- | --- |
| **draw.io** | 無料・ブラウザで使える・GitHubと連携可 | 小〜中規模チーム |
| **A5:SQL Mk-2** | 無料・ER図からDDL生成・逆生成も可能 | Windowsで使う場面 |
| **dbdiagram.io** | コードでER図を書ける・共有が簡単 | リモートチーム |
| **Lucidchart** | 高機能・共同編集可能 | エンタープライズ |
| **DBeaver** | DBクライアントとしてもER図生成もできる | 既存DBの可視化 |

### 逆リバースエンジニアリング（既存DBからERD生成）

現場では既存のDBからERDを生成するケースもよくあります。

```sql
-- PostgreSQLで既存テーブルのカラム情報を確認
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 外部キー制約の確認
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name  AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

> **ポイント**  
> 現場に入ったとき、まず既存DBのERDを生成してシステム全体を把握するのが定番の手順です。ドキュメントが古くなっていても、DBは最新状態なので、DBから逆生成するERDが最も信頼できます。

> **現場メモ**  
> 「ERDは最初に作ったまま更新されていない」というプロジェクトは非常に多いです。新機能を追加するたびにERDを更新する習慣がないと、ドキュメントとDBの実態が乖離していきます。そのため「ERDよりもDBのスキーマが正」という運用にならざるを得ないことがよくあります。現場では「ERDが古い/ない場合は DBeaver や A5:SQL で逆リバースして最初に把握する」が鉄則です。また、新機能の設計レビューでは「コードを見る前にERDを見る」ことで、設計の問題（重複データ、外部キーの抜け、テーブルの責務が混在しているなど）を早期に発見できます。

---

## 8. よくある間違い

### 間違い1: エンティティの粒度が粗すぎる

**悪い例：** 1つのテーブルに詰め込みすぎ

```sql
-- 注文と注文明細を1テーブルに詰め込んでいる（悪い）
CREATE TABLE orders (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT,
    product1_id   BIGINT,
    product1_qty  INTEGER,
    product2_id   BIGINT,
    product2_qty  INTEGER,
    product3_id   BIGINT,
    product3_qty  INTEGER
    -- 商品が4つ以上になったら？→ カラムを追加するしかない
);
```

**良い例：** 1対多に分解する

```sql
CREATE TABLE orders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL
);

CREATE TABLE order_items (
    id         BIGSERIAL PRIMARY KEY,
    order_id   BIGINT    NOT NULL REFERENCES orders(id),
    product_id BIGINT    NOT NULL,
    quantity   INTEGER   NOT NULL CHECK (quantity > 0)
);
```

### 間違い2: エンティティの粒度が細かすぎる

**悪い例：** 住所を細かく分けすぎてクエリが複雑になる

```sql
-- 過剰に分割した例（用途によっては正しい場合もある）
CREATE TABLE prefectures (id BIGSERIAL PRIMARY KEY, name VARCHAR(10));
CREATE TABLE cities      (id BIGSERIAL PRIMARY KEY, prefecture_id BIGINT, name VARCHAR(50));
CREATE TABLE districts   (id BIGSERIAL PRIMARY KEY, city_id BIGINT, name VARCHAR(50));
-- ユーザーの住所を取得するだけで3テーブルのJOINが必要になる
```

**良い例（一般的なECサイトの場合）：**

```sql
CREATE TABLE user_addresses (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id),
    postal_code  VARCHAR(8)   NOT NULL,
    prefecture   VARCHAR(10)  NOT NULL,
    city         VARCHAR(50)  NOT NULL,
    address_line TEXT         NOT NULL
);
```

### 間違い3: 中間テーブルの属性を忘れる

```sql
-- 悪い例：学生と授業の多対多を単純に中間テーブルにした
CREATE TABLE student_courses (
    student_id BIGINT REFERENCES students(id),
    course_id  BIGINT REFERENCES courses(id)
);

-- 良い例：中間テーブルにも意味のある属性を持たせる
CREATE TABLE student_courses (
    id          BIGSERIAL   PRIMARY KEY,
    student_id  BIGINT      NOT NULL REFERENCES students(id),
    course_id   BIGINT      NOT NULL REFERENCES courses(id),
    enrolled_at DATE        NOT NULL DEFAULT CURRENT_DATE,
    grade       VARCHAR(2),  -- 成績
    UNIQUE (student_id, course_id)  -- 重複受講防止
);
```

> **ポイント**  
> 中間テーブルは「2つのエンティティのつながり」そのものをエンティティと見なします。「いつ申し込んだか」「結果はどうだったか」など、その関係固有の情報を持つことが多いです。

---

## 9. ポイント

- **多対多の関係が中間テーブルで表現されているか**
  - ERD で直接多対多になっている場合は設計の見直しが必要
- **1対1の関係で別テーブルに分けた理由が明確か**
  - 「なんとなく分けた」ではなく、NULL が多い列を分離するなど明確な理由があるか
- **外部キー制約が ERD の関係線と一致しているか**
  - DDL を見て ERD の関係が制約として表現されているか確認
- **ERD が最新の DB スキーマと一致しているか**
  - 「ERD は DB のスキーマから逆リバース生成が可能な状態を維持する」が理想

---

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| ERDとは | データベース構造を視覚化した設計図。共通言語として機能する |
| エンティティ | 管理したいモノ・概念 → テーブルに対応 |
| 属性 | エンティティの特徴 → カラムに対応 |
| 1対1 | 双方に高々1つの関係。専用テーブルを分けるときに使う |
| 1対多 | 最も一般的な関係。外部キーで表現 |
| 多対多 | 中間テーブルで「1対多 × 1対多」に分解する |
| IE記法 | 鳥の足記法。○（0）│（1）<（多）の組み合わせで表現 |
| ERDツール | draw.io・A5:SQL Mk-2・dbdiagram.io が現場でよく使われる |
| よくある間違い | 粒度が粗すぎる（詰め込み）・細かすぎる・中間テーブルの属性忘れ |

---

## 練習問題

### 問題1: ERD の読み取り

> 参照：[3. カーディナリティ](#3-カーディナリティ1対1・1対多・多対多) ・ [4. IE記法の読み方](#4-ie記法鳥の足記法の読み方)

以下の ERD の記述を読んで、テーブル間の関係を日本語で説明してください。

```
users ||--o{ orders : "places"
orders ||--|{ order_items : "contains"
products ||--o{ order_items : "included in"
```

<details>
<summary>回答を見る</summary>

- **users → orders**：1人のユーザーは0件以上の注文を持つ（ユーザーは注文なしでも存在できる）
- **orders → order_items**：1件の注文は1件以上の注文明細を持つ（注文には必ず最低1つの商品が含まれる）
- **products → order_items**：1つの商品は0件以上の注文明細に含まれる（一度も売れていない商品が存在できる）

**解説：** IE記法では `||`（必ず1）、`o{`（0以上）、`|{`（1以上）の組み合わせでカーディナリティを表します。`orders ||--|{` は「注文は必ず1件以上の明細を持つ」という業務ルールを表現しています。

</details>

### 問題2: ERD の作成

> 参照：[6. ERDを書く練習](#6-erdを書く練習要件から起こす手順)

以下の要件から ER 図（テーブル名・カラム名・関係）を設計してください。

> ブログシステム：ユーザーが記事を投稿できる。記事にはタグを複数付けられる。ユーザーは記事にコメントできる。

<details>
<summary>回答を見る</summary>

**テーブル設計：**

```
users
- id (PK)
- name
- email

articles
- id (PK)
- user_id (FK → users.id)  -- 投稿者
- title
- body
- created_at

tags
- id (PK)
- name

article_tags（中間テーブル）
- article_id (FK → articles.id)
- tag_id (FK → tags.id)
- PK: (article_id, tag_id)

comments
- id (PK)
- article_id (FK → articles.id)
- user_id (FK → users.id)  -- コメント投稿者
- body
- created_at
```

**関係：**
- users 1 --< articles（1人が複数記事を書く）
- users 1 --< comments（1人が複数コメントを書く）
- articles 1 --< comments（1記事に複数コメント）
- articles >--< tags（多対多：中間テーブル article_tags）

**解説：** 多対多（記事 ↔ タグ）は中間テーブルで表現します。コメントは「記事」と「書いたユーザー」の両方に外部キーを持つため、両方への FK が必要です。

</details>

### 問題3: ERD の問題点の指摘

> 参照：[8. よくある間違い](#8-よくある間違い)

以下のテーブル設計の問題点を指摘してください。

```sql
CREATE TABLE orders (
  id           BIGSERIAL PRIMARY KEY,
  customer_name TEXT,        -- 顧客名を直接保存
  customer_email TEXT,       -- 顧客メールを直接保存
  product_name TEXT,         -- 商品名を直接保存
  product_price INTEGER,     -- 商品価格を直接保存
  quantity      INTEGER
);
```

<details>
<summary>回答を見る</summary>

**問題点：**

1. **顧客情報の冗長化**：同じ顧客が複数回注文すると `customer_name` が何度も重複保存される。顧客のメールアドレスが変わっても過去の注文データは更新されない（更新異常）

2. **商品情報の冗長化**：商品の価格が変更されても過去の注文レコードは古い価格のまま（これは意図的な履歴保持と解釈する場合もあるが、設計として明示が必要）

3. **外部キーがない**：顧客や商品を削除しても注文テーブルに不整合データが残る

**改善版の方針：**
```sql
-- customers, products テーブルを別に持ち、外部キーで参照
-- 注文時の価格は order_items に unit_price として保持（履歴として必要）
CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id),
  product_id  BIGINT NOT NULL REFERENCES products(id),
  unit_price  NUMERIC(10,2) NOT NULL,  -- 注文時点の価格を記録
  quantity    INTEGER NOT NULL
);
```

**解説：** テーブルを正規化して顧客・商品を独立したテーブルに分離します。注文時点の価格だけは `order_items` に履歴として保持することが多いです（商品テーブルの現在価格と別に管理）。

</details>
