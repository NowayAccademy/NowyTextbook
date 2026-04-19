# 多対多と中間テーブル
多対多の関係を中間テーブルで表現する設計パターンを学びます

## 本章の目標

本章では以下を目標にして学習します。

- 多対多の関係が発生する場面を説明できること
- 中間テーブルを使って多対多を正しく設計できること
- 中間テーブルにJOINを2回使って検索できること

## 1. 多対多とは何か

### 1対多との違い

これまでに学んだ「1対多」の関係は、例えば「1人の顧客が複数の注文を持つ」というものでした。

```
顧客 1 ─── N 注文
```

しかし現実のビジネスでは、**どちら側からも複数の関係が生まれる**ケースがあります。

```
注文 N ─── M 商品
（1つの注文に複数の商品／1つの商品が複数の注文に含まれる）
```

これを**多対多（N:M）**と呼びます。

### 身近な多対多の例

| 例 | 片方 | もう片方 | 説明 |
| --- | --- | --- | --- |
| ECサイト | 注文 | 商品 | 1注文で複数商品を購入、同じ商品が複数の注文に |
| 大学 | 学生 | 講座 | 1人の学生が複数の講座に登録、1つの講座に複数の学生が |
| ブログ | 記事 | タグ | 1記事に複数のタグ、1タグが複数の記事に付く |
| 組織 | ユーザー | 権限 | 1人のユーザーが複数の権限を持ち、1つの権限を複数人が持つ |

> **ポイント**  
> 多対多は「どちらの側から見ても複数」という関係です。日常のあらゆる場面に登場するので、見抜けるようになることが重要です。

## 2. 外部キーだけでは解決できない理由

### 試しに外部キーだけで設計してみる

「注文テーブルに商品IDを持たせればいい」と考えると、こうなります。

```sql
-- NG設計：1注文1商品しか持てない
CREATE TABLE orders (
  order_id    SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  product_id  INT NOT NULL  -- 1列にしか入らない
);
```

これでは1注文に1商品しか入れられません。

次に「複数列持たせればいい」と考えると…

```sql
-- NG設計：列が足りなくなる・NULLが増える
CREATE TABLE orders (
  order_id    SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  product_id_1 INT,
  product_id_2 INT,
  product_id_3 INT  -- 4つ以上買ったら？
);
```

これも限界があります。また「nullが多い」「商品数が決まらない」という問題が発生します。

### 逆方向（商品テーブルに注文IDを持たせる）も同様の問題がある

```sql
-- NG設計：同じ商品が別注文で何度も行として登場する
CREATE TABLE products (
  product_id  SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  order_id    INT  -- どの注文IDを持てばいい？
);
```

同じ商品を表す行が複数必要になってしまい、データが重複します。

> **注意**  
> 多対多を外部キーだけで解決しようとすると、必ずどこかに無理が出ます。「中間テーブルが必要」というサインです。

## 3. 中間テーブルの設計

### 中間テーブルとは

**中間テーブル（関連テーブル・ブリッジテーブル）**は、2つのテーブルの主キーを両方持ち、多対多の関係を「2つの1対多」に分解するテーブルです。

```
orders ─── 1:N ─── order_items ─── N:1 ─── products
```

### ECサイトの注文明細テーブル

```sql
-- 注文テーブル
CREATE TABLE orders (
  order_id    SERIAL PRIMARY KEY,
  customer_id INT NOT NULL,
  ordered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 商品テーブル
CREATE TABLE products (
  product_id  SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL
);

-- 中間テーブル（注文明細）
CREATE TABLE order_items (
  order_id   INT NOT NULL REFERENCES orders(order_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  PRIMARY KEY (order_id, product_id)  -- 複合主キー
);
```

複合主キー `(order_id, product_id)` を設定することで、**同じ注文に同じ商品が2行入ることを防ぎます**。

### 大学の受講登録テーブル

```sql
-- 学生テーブル
CREATE TABLE students (
  student_id SERIAL PRIMARY KEY,
  name       TEXT NOT NULL
);

-- 講座テーブル
CREATE TABLE courses (
  course_id SERIAL PRIMARY KEY,
  title     TEXT NOT NULL
);

-- 中間テーブル（受講登録）
CREATE TABLE course_enrollments (
  student_id INT NOT NULL REFERENCES students(student_id),
  course_id  INT NOT NULL REFERENCES courses(course_id),
  PRIMARY KEY (student_id, course_id)
);
```

> **ポイント**  
> 中間テーブルの主キーは「2つのテーブルの外部キーを組み合わせた複合主キー」にするのが基本です。これにより重複登録を防げます。

## 4. 中間テーブルに追加属性を持たせる

中間テーブルは「繋ぎ役」だけでなく、**その関係特有の情報**を持てます。

### 数量・単価を持つ注文明細

```sql
CREATE TABLE order_items (
  order_id      INT NOT NULL REFERENCES orders(order_id),
  product_id    INT NOT NULL REFERENCES products(product_id),
  quantity      INT NOT NULL CHECK (quantity > 0),   -- 数量
  unit_price    NUMERIC(10, 2) NOT NULL,              -- 購入時の単価（商品価格が後で変わっても記録が残る）
  PRIMARY KEY (order_id, product_id)
);

-- データ挿入例
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
VALUES
  (1, 101, 2, 1200.00),  -- 注文1に商品101を2個、1200円で購入
  (1, 205, 1,  800.00),  -- 注文1に商品205を1個、800円で購入
  (2, 101, 3, 1200.00);  -- 注文2に商品101を3個
```

> **ポイント**  
> `unit_price`（購入時の単価）を中間テーブルに持たせているのは重要な設計です。商品の価格は後で変わる可能性があります。購入時の価格を記録しておかないと、過去の注文の金額が変わってしまいます。

### 受講登録日・成績を持つ受講テーブル

```sql
CREATE TABLE course_enrollments (
  student_id   INT NOT NULL REFERENCES students(student_id),
  course_id    INT NOT NULL REFERENCES courses(course_id),
  enrolled_at  DATE NOT NULL DEFAULT CURRENT_DATE,  -- 登録日
  grade        CHAR(1),                              -- 成績（A/B/C/D/F）
  PRIMARY KEY (student_id, course_id)
);
```

> **ポイント**  
> 中間テーブルに日付や金額などの「関係の属性」を持たせることで、より豊かなデータモデルになります。

## 5. 多対多の検索パターン（JOINを2回使う）

### 基本的なJOIN2回のパターン

多対多のデータを検索するには、中間テーブルを介して2回JOINします。

```sql
-- 注文IDが1の注文に含まれる商品名と数量を取得
SELECT
  p.name       AS 商品名,
  oi.quantity  AS 数量,
  oi.unit_price AS 単価
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
WHERE oi.order_id = 1;
```

```sql
-- 顧客名、注文日、購入商品名、数量を一覧表示
SELECT
  c.name         AS 顧客名,
  o.ordered_at   AS 注文日,
  p.name         AS 商品名,
  oi.quantity    AS 数量,
  oi.unit_price  AS 単価
FROM orders o
JOIN customers c   ON o.customer_id = c.customer_id
JOIN order_items oi ON o.order_id   = oi.order_id
JOIN products p    ON oi.product_id  = p.product_id
ORDER BY o.ordered_at DESC;
```

### 逆方向：ある商品を購入した顧客一覧

```sql
-- 商品ID=101を購入したことがある顧客を表示
SELECT DISTINCT
  c.customer_id,
  c.name AS 顧客名
FROM products p
JOIN order_items oi ON p.product_id = oi.product_id
JOIN orders o       ON oi.order_id  = o.order_id
JOIN customers c    ON o.customer_id = c.customer_id
WHERE p.product_id = 101;
```

### 集計を組み合わせる

```sql
-- 各商品の総販売数と総売上を集計
SELECT
  p.name             AS 商品名,
  SUM(oi.quantity)   AS 総販売数,
  SUM(oi.quantity * oi.unit_price) AS 総売上
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.product_id, p.name
ORDER BY 総売上 DESC;
```

> **ポイント**  
> 多対多の検索では「中間テーブルを起点にJOINするか、どちらかのメインテーブルを起点にするか」を意識すると書きやすくなります。

## 6. 多対多の現場パターン

### タグ機能

ブログやEC、社内システムでよく見られるタグ機能も多対多です。

```sql
-- タグテーブル
CREATE TABLE tags (
  tag_id SERIAL PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE
);

-- 記事テーブル
CREATE TABLE articles (
  article_id SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL
);

-- 中間テーブル
CREATE TABLE article_tags (
  article_id INT NOT NULL REFERENCES articles(article_id) ON DELETE CASCADE,
  tag_id     INT NOT NULL REFERENCES tags(tag_id)         ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- タグ名で記事を絞り込む
SELECT a.title
FROM articles a
JOIN article_tags at ON a.article_id = at.article_id
JOIN tags t          ON at.tag_id    = t.tag_id
WHERE t.name = 'PostgreSQL';
```

### 権限管理（RBAC: Role-Based Access Control）

```sql
-- ユーザーテーブル
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email   TEXT NOT NULL UNIQUE
);

-- 権限（ロール）テーブル
CREATE TABLE roles (
  role_id SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE  -- 例：admin, editor, viewer
);

-- 中間テーブル（ユーザーとロールの紐付け）
CREATE TABLE user_roles (
  user_id    INT NOT NULL REFERENCES users(user_id),
  role_id    INT NOT NULL REFERENCES roles(role_id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by INT REFERENCES users(user_id),  -- 誰が権限を付与したか
  PRIMARY KEY (user_id, role_id)
);

-- あるユーザーが持つ権限を確認
SELECT r.name AS 権限名
FROM user_roles ur
JOIN roles r ON ur.role_id = r.role_id
WHERE ur.user_id = 42;
```

> **ポイント**  
> 権限管理テーブルは「誰がいつ誰に権限を付与したか」という監査情報（`granted_at`, `granted_by`）を中間テーブルに持たせると、セキュリティ要件を満たしやすくなります。

> **現場メモ**  
> 多対多の設計でよく起きるのが「最初はシンプルな中間テーブルだったのに、後から属性を追加し続けた結果、中間テーブルがメインテーブル化する」パターンです。例えば、当初 `(user_id, role_id)` のみだった権限テーブルに、`expires_at`（有効期限）、`granted_by`（付与者）、`reason`（理由）、`is_temporary`（一時的フラグ）と増え続け、もはや「権限付与イベント」という独自エンティティになっていたというケースを経験しました。これ自体は正しい設計進化ですが、「中間テーブルにPKが必要になってきた」と感じたときは「この関係自体がエンティティとして独立すべきか」を設計レビューで議論することをお勧めします。

## 7. よくある設計ミス

### ミス1: 中間テーブルに独自のサロゲートキーを付けて複合主キーを使わない

```sql
-- 微妙な設計（よく見るが問題がある）
CREATE TABLE order_items (
  id         SERIAL PRIMARY KEY,  -- 独自ID
  order_id   INT NOT NULL,
  product_id INT NOT NULL
  -- 複合主キーがないので同じ(order_id, product_id)の組が複数行入れられる
);

-- 正しい設計
CREATE TABLE order_items (
  order_id   INT NOT NULL REFERENCES orders(order_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  quantity   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id)  -- 重複を防ぐ複合主キー
);
```

> **注意**  
> サロゲートキーのみで複合主キーを使わないと、同じ商品を同じ注文に2行以上入れてしまうバグの原因になります。

### ミス2: 外部キー制約を付けない

```sql
-- NG: 制約なしだと孤立した行が生まれる
CREATE TABLE order_items (
  order_id   INT,   -- 参照整合性なし
  product_id INT,   -- 参照整合性なし
  quantity   INT
);

-- OK: REFERENCES で参照整合性を保証する
CREATE TABLE order_items (
  order_id   INT NOT NULL REFERENCES orders(order_id)   ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(product_id),
  quantity   INT NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id)
);
```

`ON DELETE CASCADE` をつけておくと、注文が削除されたときに明細も自動で削除されます。

### ミス3: 購入時の単価を商品テーブルから参照しようとする

商品テーブルの `price` を参照して金額を計算すると、後から価格が変更されたとき過去の注文金額が変わってしまいます。中間テーブルに `unit_price` を記録することが正しい設計です。

### ミス4: 多対多を見落として1対多で設計してしまう

「今は1つしか選ばないから…」と1対多で設計すると、後で要件が変わったときの改修コストが大きくなります。将来的に多対多になりそうな関係は最初から中間テーブルで設計しましょう。

## 8. ポイント

- **多対多の関係に中間テーブルが用意されているか**
  - 外部キーだけで多対多を表現しようとしていないか確認
- **中間テーブルに複合 PRIMARY KEY が設定されているか**
  - 不必要なサロゲートキーを追加する前に複合 PK を検討する
- **中間テーブルに ON DELETE CASCADE の設定が要件と合っているか**
  - 親が消えたとき中間テーブルのレコードも消えるべきか確認
- **購入・注文など「その時点の状態を保持すべき」データが中間テーブルにスナップショットされているか**
  - 単価・名前など変わりうる値は中間テーブルにコピーして保持する
- **「今は1対多で十分」な関係が将来的に多対多になりうるか議論したか**

---

## 9. まとめ

| テーマ | 要点 |
| --- | --- |
| 多対多とは | どちら側からも「複数」の関係（注文と商品、学生と講座など） |
| 外部キーだけでは無理 | 列を増やすか行を重複させるしかなく、どちらも破綻する |
| 中間テーブル | 2つのテーブルの外部キーを持ち、多対多を「2つの1対多」に分解する |
| 複合主キー | `PRIMARY KEY (a_id, b_id)` で重複行を防ぐ |
| 追加属性 | 中間テーブルに数量・単価・日付など「関係の属性」を持たせられる |
| JOIN2回 | 中間テーブルを経由して2回JOINすることで両テーブルを結合できる |
| 現場パターン | タグ機能、権限管理（RBAC）などで頻繁に登場する |

---

## 練習問題

### 問題1: 中間テーブルの設計

> 参照：[3. 中間テーブルの設計](#3-中間テーブルの設計)

タグ機能を実装します。`articles`（記事）と `tags`（タグ）の多対多関係を中間テーブルで設計してください。同じ記事に同じタグが重複して付かないようにしてください。

<details>
<summary>回答を見る</summary>

```sql
CREATE TABLE articles (
  id         BIGSERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE article_tags (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
```

**解説：** 複合主キー `PRIMARY KEY (article_id, tag_id)` が重複防止の役割を果たします。`ON DELETE CASCADE` を付けることで、記事やタグを削除したとき中間テーブルのレコードも自動的に削除されます。

</details>

### 問題2: 中間テーブルを経由した JOIN

> 参照：[5. 多対多の検索パターン](#5-多対多の検索パターンjoinを2回使う)

`articles` と `tags` を `article_tags` 経由でJOINし、各記事のタイトルとそれに付いたタグ名一覧を取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT a.title, t.name AS tag_name
FROM articles AS a
JOIN article_tags AS at ON a.id = at.article_id
JOIN tags AS t ON at.tag_id = t.id
ORDER BY a.id, t.name;
```

**解説：** 多対多の取得は「articles → article_tags → tags」と2回 JOIN します。1つの記事に複数タグがあれば、記事のタイトルが複数行に繰り返されます（タグの数だけ行が出る）。アプリ側でグループ化するか、`STRING_AGG(t.name, ', ')` でタグを1列にまとめることもできます。

</details>

### 問題3: 中間テーブルへの属性追加

> 参照：[4. 中間テーブルに追加属性を持たせる](#4-中間テーブルに追加属性を持たせる) ・ [6. 多対多の現場パターン](#6-多対多の現場パターン)

権限管理システム（RBAC）を設計します。`users`・`roles`・`permissions` の3テーブルで以下を実現してください。

- ユーザーは複数のロールを持てる
- ロールは複数の権限を持てる
- ユーザーへのロール付与日時を記録したい

<details>
<summary>回答を見る</summary>

```sql
CREATE TABLE roles (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE  -- 'admin', 'editor', 'viewer' など
);

CREATE TABLE permissions (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE  -- 'articles:read', 'articles:write' など
);

-- ユーザー ↔ ロール（付与日時を属性として持つ）
CREATE TABLE user_roles (
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

-- ロール ↔ 権限
CREATE TABLE role_permissions (
  role_id       BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

**解説：** 中間テーブルに `granted_at` のような「関係の属性」を追加できるのが中間テーブルの強みです。ロール付与の取り消しは `user_roles` から DELETE、付与は INSERT するだけで済みます。RBACはWebアプリの権限管理の定番パターンです。

</details>
