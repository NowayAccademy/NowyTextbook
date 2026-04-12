# 主キーと外部キー
データを一意に識別し、テーブル間の関係を保証する仕組みを学びます

## 本章の目標

本章では以下を目標にして学習します。

- 主キー（PRIMARY KEY）の概念と必要性を説明できること
- 外部キー（FOREIGN KEY）を使ってテーブル間の関係を定義できること
- ON DELETE / ON UPDATE の挙動の違いを説明し、適切に選択できること

## 1. 主キー（PRIMARY KEY）の概念と必要性

### 主キーとは何か

テーブルの中の各レコードを「一意に識別」するためのカラム（または複数カラムの組み合わせ）を **主キー（PRIMARY KEY）** と呼びます。

学校の出席番号と同じイメージです。クラスの中で「出席番号3番」と言えば必ず1人に決まります。名前だと同姓同名がいて特定できない場合があります。

```sql
-- 主キーがないテーブルの問題
-- 同じ名前のレコードが2件あると、どちらを指しているか分からない
SELECT * FROM users WHERE name = '田中太郎';
-- → 複数件ヒットしてしまう可能性がある

-- 主キーがあれば一意に特定できる
SELECT * FROM users WHERE id = 1;
-- → 必ず0件か1件
```

### 主キーの2つのルール

主キーには以下のルールがあります。

1. **重複禁止（UNIQUE）**：同じ値が2件存在できない
2. **NULL禁止（NOT NULL）**：主キーには必ず値が入っていなければならない

```sql
-- 主キーの定義例
CREATE TABLE users (
    id        INTEGER      PRIMARY KEY,  -- 重複・NULLが自動で禁止される
    name      VARCHAR(100) NOT NULL,
    email     VARCHAR(255) NOT NULL
);

-- 主キー重複のエラー例（実行すると失敗する）
INSERT INTO users (id, name, email) VALUES (1, '田中太郎', 'tanaka@example.com');
INSERT INTO users (id, name, email) VALUES (1, '鈴木一郎', 'suzuki@example.com');
-- ERROR: duplicate key value violates unique constraint "users_pkey"

-- NULLのエラー例（実行すると失敗する）
INSERT INTO users (id, name, email) VALUES (NULL, '佐藤花子', 'sato@example.com');
-- ERROR: null value in column "id" violates not-null constraint
```

> **ポイント**  
> `PRIMARY KEY` 制約を付けると、データベースは自動的に「重複チェック」と「NULLチェック」を行います。アプリ側でチェックしなくても、DB側で守られるのが大きな利点です。
> ただ、現場では「なぜ登録できずにエラーが発生したのか。」を発見するために、「重複チェック」はアプリ側でも行うのが基本となっています。

### 自動採番（SERIAL）

毎回手動でIDを指定するのは大変なので、PostgreSQLでは `SERIAL` 型を使って自動でIDを採番できます。

```sql
-- SERIALを使った主キー定義（PostgreSQL）
CREATE TABLE users (
    id        SERIAL       PRIMARY KEY,  -- 1, 2, 3... と自動で採番
    name      VARCHAR(100) NOT NULL,
    email     VARCHAR(255) NOT NULL
);

-- idを指定せずINSERTできる
INSERT INTO users (name, email) VALUES ('田中太郎', 'tanaka@example.com');
INSERT INTO users (name, email) VALUES ('佐藤花子', 'sato@example.com');

-- 結果確認
SELECT * FROM users;
--  id |  name  |        email
-- ----+--------+---------------------
--   1 | 田中太郎 | tanaka@example.com
--   2 | 佐藤花子 | sato@example.com
```

> **ポイント**  
> `SERIAL` は PostgreSQL の便利な型です。内部的にはシーケンスオブジェクトが作られ、そこから次の番号が自動で払い出されます。

> **メモ**  
> 「INTEGER（SERIAL）かBIGINT（BIGSERIAL）かUUIDか」はチームでよく議論になるテーマです。ログテーブルや高トラフィックなシステムでは、最初から `BIGSERIAL` を使うことを強く推奨します。一方、UUIDは「マイクロサービスで複数DBをマージするとき」や「APIのURLにIDを出すときに連番を予測されたくない」場合に有効です。ただしUUIDはインデックスが大きくなりJOINが遅くなる傾向があるため、パフォーマンスが重要なシステムでは慎重に検討してください。

## 2. 複合主キー（いつ使うか）

### 複合主キーとは

複数のカラムを組み合わせて主キーとするものを **複合主キー（Composite Primary Key）** と呼びます。

典型的な例は「中間テーブル（多対多の関係を表すテーブル）」です。

```sql
-- ユーザーとタグの関係を表す中間テーブル
-- 「user_id=1, tag_id=5」という組み合わせが主キー
CREATE TABLE user_tags (
    user_id    INTEGER   NOT NULL,
    tag_id     INTEGER   NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tag_id)  -- 複合主キー
);

-- 同じ組み合わせは1件しか登録できない
INSERT INTO user_tags (user_id, tag_id) VALUES (1, 5);
INSERT INTO user_tags (user_id, tag_id) VALUES (1, 5);
-- ERROR: duplicate key value violates unique constraint "user_tags_pkey"

-- ただし user_id=1, tag_id=6 は問題なく登録できる
INSERT INTO user_tags (user_id, tag_id) VALUES (1, 6);  -- OK
```

### 複合主キーを使う判断基準

| 状況 | 推奨 |
| --- | --- |
| 単純なエンティティ（ユーザー、商品など） | 単一の自動採番ID（SERIAL）を使う |
| 2つのエンティティの関係（中間テーブル） | 複合主キー または 独立したIDを追加する |
| 自然キー（コード値など）が必ず一意な場合 | 自然キーを主キーにすることもある |

> **メモ**  
> 複合主キーを多用すると外部キーの定義が複雑になります。中間テーブル以外では、独立したSERIAL型のIDを主キーにする方が扱う場合もあります。その一方で独立したIDを追加した場合、

## 3. 外部キー（FOREIGN KEY）の概念

### 参照整合性とは

**外部キー（FOREIGN KEY）** は、あるテーブルのカラムが別のテーブルの主キーを参照することを保証する制約です。  
この仕組みを **参照整合性（Referential Integrity）** と呼びます。

身近な例：図書館の「貸出記録」には必ず実在する「本」と「会員」の組み合わせしか登録できないようにする制約です。存在しない会員IDで貸出記録を作れないようにします。

```sql
-- 親テーブル（参照される側）
CREATE TABLE customers (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- 子テーブル（参照する側）
CREATE TABLE orders (
    id          SERIAL  PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    amount      INTEGER NOT NULL,
    order_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
    -- customer_id は customers テーブルの id を参照する
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- 存在しない customer_id を指定するとエラーになる
INSERT INTO orders (customer_id, amount) VALUES (999, 5000);
-- ERROR: insert or update on table "orders" violates foreign key constraint
-- DETAIL: Key (customer_id)=(999) is not present in table "customers".
```

> **ポイント**  
> 外部キーは「子テーブルが親テーブルに存在しないIDを参照できない」ことを保証します。これにより「孤立したデータ（どのユーザーのものかわからない注文）」が生まれません。

### 外部キー制約の正しい使い方

```sql
-- データを正しく入れる例
INSERT INTO customers (name) VALUES ('田中太郎');   -- id=1 が採番される
INSERT INTO orders (customer_id, amount) VALUES (1, 5000);  -- OK：id=1のcustomerが存在する
INSERT INTO orders (customer_id, amount) VALUES (1, 3000);  -- OK：同一顧客に複数注文可能
```

## 4. ON DELETE / ON UPDATE の挙動

### 参照先が変更・削除されたときの動作

外部キー制約では、参照先（親テーブル）のレコードが更新・削除されたとき、参照元（子テーブル）をどう扱うかを指定できます。

```sql
-- ON DELETE と ON UPDATE の指定例
CREATE TABLE orders (
    id          SERIAL  PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    amount      INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON DELETE CASCADE    -- 親が削除されたら子も削除
        ON UPDATE CASCADE    -- 親のIDが変更されたら子も追従
);
```

### 各オプションの動作比較

| オプション | 動作 | 使いどころ |
| --- | --- | --- |
| **CASCADE** | 親が削除/更新されると、子も自動で削除/更新される | 親がなくなれば子も不要な場合（注文詳細など） |
| **RESTRICT** | 子が存在する場合、親の削除/更新を禁止する | 親を消すとデータが壊れる場合 |
| **NO ACTION** | RESTRICTと同様（デフォルト）。トランザクション終了時にチェックされる | デフォルト動作でよい場合 |
| **SET NULL** | 親が削除/更新されると、子の外部キーをNULLにする | 親がなくても子は残したい場合（担当者が退職しても注文記録を残す） |
| **SET DEFAULT** | 親が削除/更新されると、子の外部キーをデフォルト値にする | まれに使われる |

```sql
-- CASCADE の例：注文を削除したら注文明細も消える
CREATE TABLE order_items (
    id       SERIAL  PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product  VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

INSERT INTO orders (customer_id, amount) VALUES (1, 5000);   -- orders.id = 1
INSERT INTO order_items (order_id, product) VALUES (1, 'りんご');
INSERT INTO order_items (order_id, product) VALUES (1, 'バナナ');

-- orders の id=1 を削除すると、order_items の関連レコードも自動削除される
DELETE FROM orders WHERE id = 1;
-- order_items の2件も同時に削除される（COUNTが0になる）

-- SET NULL の例：担当者が削除されてもタスクは残す
CREATE TABLE tasks (
    id          SERIAL  PRIMARY KEY,
    assignee_id INTEGER,  -- NULL許容（担当者なしの状態を許す）
    title       VARCHAR(255) NOT NULL,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);
-- ユーザーが削除されると assignee_id が NULL になる（タスク自体は残る）
```

> **注意**  
> `ON DELETE CASCADE` は便利ですが、意図せず大量のデータを削除してしまうリスクがあります。本番環境での使用は慎重に検討してください。特に重要なデータには `RESTRICT` を使い、アプリ側で削除前の確認を行う設計が安全です。

## 5. 1対多・多対多の関係の概念

### 1対多（One-to-Many）

最も一般的な関係です。「1人のユーザーが複数の注文を持てる」ような関係です。

```
customers（1）  ──────────<  orders（多）
     id                         customer_id → customers.id
```

```sql
-- 1対多の実装：子テーブルに外部キーを持たせる
CREATE TABLE customers (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE orders (
    id          SERIAL  PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    amount      INTEGER NOT NULL
);

-- 田中さんの注文を全件取得する
SELECT o.id, o.amount
FROM orders o
WHERE o.customer_id = 1;
```

### 多対多（Many-to-Many）

「1人の学生が複数の授業を受けられ、1つの授業を複数の学生が受けられる」ような関係です。  
直接表現できないため、**中間テーブル（連関エンティティ）** を使います。

```
students（多） ── student_courses（中間テーブル） ── courses（多）
    id              student_id → students.id           id
                    course_id  → courses.id
```

```sql
-- 多対多の実装：中間テーブルを使う
CREATE TABLE students (
    id   SERIAL       PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id    SERIAL       PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);

-- 中間テーブル
CREATE TABLE student_courses (
    student_id  INTEGER NOT NULL REFERENCES students(id),
    course_id   INTEGER NOT NULL REFERENCES courses(id),
    enrolled_at DATE    NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (student_id, course_id)  -- 複合主キー
);

-- 学生ID=1が受けている授業の一覧を取得
SELECT c.id, c.title, sc.enrolled_at
FROM student_courses sc
JOIN courses c ON c.id = sc.course_id
WHERE sc.student_id = 1;
```

> **ポイント**  
> 多対多の関係は必ず中間テーブルを使います。中間テーブルには「その関係に紐づく追加の属性」（上記の `enrolled_at` など）を持たせることもできます。

## 6. よくあるミス（外部キー制約違反エラーの読み方）

### エラーパターン1：子テーブルへの挿入時に親が存在しない

```sql
-- エラー例
INSERT INTO orders (customer_id, amount) VALUES (999, 5000);

-- エラーメッセージ
-- ERROR:  insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey"
-- DETAIL: Key (customer_id)=(999) is not present in table "customers".

-- 読み方：
-- 「orders」テーブルへの挿入/更新が「orders_customer_id_fkey」制約に違反した
-- customer_id=999 が「customers」テーブルに存在しない
```

### エラーパターン2：子が存在する親を削除しようとした

```sql
-- エラー例
DELETE FROM customers WHERE id = 1;

-- エラーメッセージ
-- ERROR:  update or delete on table "customers" violates foreign key constraint
--         "orders_customer_id_fkey" on table "orders"
-- DETAIL: Key (id)=(1) is still referenced from table "orders".

-- 読み方：
-- 「customers」テーブルの削除/更新が「orders」テーブルの「orders_customer_id_fkey」制約に違反した
-- id=1 はまだ「orders」テーブルから参照されている
```

### エラーの対処法

```sql
-- 対処1：先に子テーブルのデータを削除してから親を削除する
DELETE FROM orders WHERE customer_id = 1;
DELETE FROM customers WHERE id = 1;

-- 対処2：CASCADEオプションを使っていれば親を削除するだけでよい
-- （事前に FOREIGN KEY ... ON DELETE CASCADE を設定している場合）
DELETE FROM customers WHERE id = 1;  -- ordersの関連レコードも自動削除
```

> **ポイント**  
> 外部キーエラーのメッセージには「どのテーブルの、どの制約に違反したか」が書かれています。`DETAIL` 行の「is not present」か「is still referenced」かで、「挿入エラー」か「削除エラー」かを判断できます。

## PRレビューのチェックポイント

- [ ] **すべてのテーブルに適切な主キーが設定されているか**
  - 複合主キーにすべきか、サロゲートキーにすべきかを要件に基づいて判断
- [ ] **SERIAL（INTEGER）を使っていて将来のデータ量に問題ないか**
  - ログテーブルや高トラフィックなシステムでは最初から BIGSERIAL を推奨
- [ ] **UUID を選んだ理由が明確か**
  - 「なんとなく」ではなく、分散システム・セキュリティ要件などの理由があるか
- [ ] **外部キーが適切に設定されているか（参照整合性の保証）**
  - アプリ側だけで整合性を保とうとしていないか
- [ ] **ON DELETE の設定が要件と一致しているか**
  - 親を削除したとき子はどうなるべきか（CASCADE / RESTRICT / SET NULL）を確認

---

## まとめ

| テーマ | 要点 |
| --- | --- |
| 主キー | レコードを一意に識別するカラム。重複・NULLが禁止される |
| SERIAL | 自動採番する整数型。IDを手動で指定しなくてよい |
| 複合主キー | 複数カラムの組み合わせで一意性を保証。中間テーブルでよく使う |
| 外部キー | 別テーブルの主キーを参照することで参照整合性を保証する |
| ON DELETE CASCADE | 親削除時に子も自動削除。使用は慎重に |
| ON DELETE RESTRICT | 子が存在する親の削除を禁止。データ保護に有効 |
| ON DELETE SET NULL | 親削除時に子の外部キーをNULLにする。関係を保ちつつ子を残したい場合 |
| 1対多 | 子テーブルに外部キーを持たせることで表現する |
| 多対多 | 中間テーブルを使って表現する |
