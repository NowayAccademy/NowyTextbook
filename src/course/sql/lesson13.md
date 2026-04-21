# サブクエリ
スカラーサブクエリ・FROM句サブクエリ・相関サブクエリを使いこなします

## 本章の目標

本章では以下を目標にして学習します。

- サブクエリの種類（スカラー・インラインビュー・相関）を理解できること
- WHERE句でサブクエリを使って条件を動的に指定できること
- FROM句にサブクエリを書いて派生テーブルとして利用できること
- 相関サブクエリでEXISTSを使った効率的な絞り込みができること
- サブクエリとJOINの使い分けを判断できること

---

## 1. サブクエリとは（クエリの中のクエリ）

### サブクエリの基本概念

**サブクエリ**（副問い合わせ）とは、SQLの中に別のSQLを「入れ子」にして書く手法です。外側のクエリを**メインクエリ（外部クエリ）**、内側のクエリを**サブクエリ（内部クエリ）**と呼びます。

身近な例で例えると、「先月の平均売上より多く売った営業担当者を教えて」という質問は、まず「先月の平均売上を計算する」→「その値より大きい人を探す」という2ステップになります。この2ステップを一つのSQLにまとめたものがサブクエリです。

```sql
-- テーブル準備
CREATE TABLE sales (
    id          INT PRIMARY KEY,
    staff_name  TEXT,
    amount      INT,
    sale_date   DATE
);

INSERT INTO sales VALUES
    (1, '田中', 50000, '2024-03-01'),
    (2, '鈴木', 80000, '2024-03-05'),
    (3, '田中', 30000, '2024-03-10'),
    (4, '佐藤', 120000, '2024-03-15'),
    (5, '鈴木', 40000, '2024-03-20'),
    (6, '佐藤', 90000, '2024-03-25');

-- 平均売上額より大きい取引を取得
SELECT staff_name, amount
FROM sales
WHERE amount > (SELECT AVG(amount) FROM sales);  -- これがサブクエリ
```

> **ポイント**  
> サブクエリは `( )` の中に書きます。内側のクエリが先に実行され、その結果を外側のクエリが利用します。

---

## 2. スカラーサブクエリ（1行1列を返す）

### スカラーサブクエリとは

**スカラーサブクエリ**は、**必ず1行1列（ひとつの値）**を返すサブクエリです。数値や文字列のような「スカラー値」を返すため、列の値と直接比較したり、SELECT句に書いたりできます。

```sql
-- SELECT句にスカラーサブクエリを書く例
-- 各取引の金額と全体平均を一緒に表示
SELECT
    staff_name,
    amount,
    (SELECT AVG(amount) FROM sales) AS avg_amount,
    amount - (SELECT AVG(amount) FROM sales) AS diff_from_avg
FROM sales
ORDER BY amount DESC;
```

```sql
-- WHERE句でスカラーサブクエリを比較演算子と組み合わせる
-- 最大売上額と同じ金額の取引を取得
SELECT staff_name, amount
FROM sales
WHERE amount = (SELECT MAX(amount) FROM sales);
```

> **注意**  
> スカラーサブクエリが2行以上を返すとエラーになります。`MAX`、`MIN`、`AVG`、`COUNT`、`SUM` などの集計関数を使うか、`LIMIT 1` を付けて確実に1行にしましょう。

---

## 3. WHERE句のサブクエリ（IN/NOT IN との組み合わせ）

### INと組み合わせて複数値と比較する

スカラーサブクエリは1値との比較でしたが、**IN**を使うと「サブクエリが返す複数の値のいずれかに一致する行」を取得できます。

```sql
-- 商品テーブルと注文テーブル
CREATE TABLE products (
    product_id   INT PRIMARY KEY,
    product_name TEXT,
    category     TEXT
);

CREATE TABLE order_items (
    item_id    INT PRIMARY KEY,
    product_id INT,
    quantity   INT
);

INSERT INTO products VALUES
    (1, 'りんご', '果物'),
    (2, 'みかん', '果物'),
    (3, 'にんじん', '野菜'),
    (4, 'キャベツ', '野菜'),
    (5, 'バナナ', '果物');

INSERT INTO order_items VALUES
    (1, 1, 3), (2, 3, 5), (3, 5, 2);

-- 注文されたことがある商品の情報を取得
SELECT product_id, product_name
FROM products
WHERE product_id IN (
    SELECT product_id FROM order_items
);
```

### NOT INで「存在しない」ものを検索

```sql
-- 一度も注文されていない商品を取得
SELECT product_id, product_name
FROM products
WHERE product_id NOT IN (
    SELECT product_id FROM order_items
);
```

> **注意**  
> `NOT IN` はサブクエリの結果にNULLが含まれると**すべての行がFALSE**になり、結果が0件になります。NULLが入る可能性がある列に `NOT IN` を使う場合は `NOT EXISTS` か `LEFT JOIN + IS NULL` を使いましょう。  
> 安全な書き方: `WHERE product_id NOT IN (SELECT product_id FROM order_items WHERE product_id IS NOT NULL)`

---

## 4. FROM句のサブクエリ（インラインビュー・派生テーブル）

### FROM句にサブクエリを書く

FROM句にサブクエリを書くと、その結果を「一時的なテーブル」として扱えます。これを**インラインビュー**または**派生テーブル**と呼びます。複雑な集計を段階的に行いたいときに便利です。

```sql
-- ステップ1: スタッフ別合計を計算
-- ステップ2: その合計に対してさらに条件を絞る

SELECT
    staff_summary.staff_name,
    staff_summary.total_amount
FROM (
    -- 内側: スタッフ別の合計を計算
    SELECT
        staff_name,
        SUM(amount) AS total_amount
    FROM sales
    GROUP BY staff_name
) AS staff_summary  -- 派生テーブルにはエイリアスが必須！
WHERE staff_summary.total_amount > 100000
ORDER BY staff_summary.total_amount DESC;
```

### なぜFROM句サブクエリが必要か

```sql
-- 悪い例: 集計結果に対して条件を使おうとしてエラー
-- SELECT staff_name, SUM(amount) AS total
-- FROM sales
-- WHERE total > 100000  -- エラー! WHEREはSELECTより先に処理される
-- GROUP BY staff_name;

-- 正しい例1: HAVINGを使う
SELECT staff_name, SUM(amount) AS total
FROM sales
GROUP BY staff_name
HAVING SUM(amount) > 100000;

-- 正しい例2: FROM句サブクエリを使う
SELECT * FROM (
    SELECT staff_name, SUM(amount) AS total
    FROM sales
    GROUP BY staff_name
) sub
WHERE total > 100000;
```

> **ポイント**  
> PostgreSQLでは、FROM句のサブクエリには必ずエイリアス（AS sub など）をつける必要があります。名前をつけないとエラーになります。

---

## 5. 相関サブクエリ（外側のクエリを参照する）

### 相関サブクエリとは

これまでのサブクエリは内側だけで完結していましたが、**相関サブクエリ**は**外側のクエリの値を参照して実行される**サブクエリです。外側の各行に対してサブクエリが1回ずつ実行されます。

```sql
-- 各スタッフの最高売上額を取得する相関サブクエリ
SELECT
    s1.staff_name,
    s1.amount,
    s1.sale_date
FROM sales s1
WHERE s1.amount = (
    -- 外側のs1.staff_nameを参照している（相関）
    SELECT MAX(s2.amount)
    FROM sales s2
    WHERE s2.staff_name = s1.staff_name  -- ここで外側を参照
)
ORDER BY s1.staff_name;
```

**結果イメージ**

| staff_name | amount | sale_date  |
|------------|--------|------------|
| 佐藤       | 120000 | 2024-03-15 |
| 田中       | 50000  | 2024-03-01 |
| 鈴木       | 80000  | 2024-03-05 |

> **ポイント**  
> 相関サブクエリは「外側の行を1行ずつチェックするたびに内側のクエリを実行する」イメージです。外側に100万行あれば内側も100万回実行される可能性があるため、パフォーマンスに注意が必要です。

---

## 6. 相関サブクエリとEXISTS

### EXISTSの使い方

**EXISTS**は「サブクエリが1件以上の結果を返すか」をチェックする演算子です。`IN` と似た用途ですが、実際の値ではなく「存在するかどうか」だけを確認するため、効率的に動作することが多いです。

```sql
-- 注文された商品を取得（EXISTSを使う）
SELECT p.product_id, p.product_name
FROM products p
WHERE EXISTS (
    SELECT 1  -- 何を返しても良い（1か*が慣例）
    FROM order_items oi
    WHERE oi.product_id = p.product_id  -- 外側を参照
);
```

### NOT EXISTS

```sql
-- 一度も注文されていない商品を取得（NOT EXISTS）
SELECT p.product_id, p.product_name
FROM products p
WHERE NOT EXISTS (
    SELECT 1
    FROM order_items oi
    WHERE oi.product_id = p.product_id
);
```

### INとEXISTSの比較

```sql
-- IN を使う場合（小規模データには問題ない）
SELECT product_name
FROM products
WHERE product_id IN (SELECT product_id FROM order_items);

-- EXISTS を使う場合（大規模データにはEXISTSの方が速いことが多い）
SELECT p.product_name
FROM products p
WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.product_id);
```

> **ポイント**  
> `EXISTS` は「1件でも見つかったらTRUE」と判定するため、最初にマッチした時点でサブクエリの実行を止めます。これが `IN` より速くなる理由のひとつです。また、NULL問題もないため安全です。

---

## 7. サブクエリとJOINの使い分け

### どちらを使うべきか

```sql
-- サブクエリで書く例
SELECT staff_name, amount
FROM sales
WHERE amount > (SELECT AVG(amount) FROM sales);

-- JOINで書く例（集計をJOINで使う）
SELECT s.staff_name, s.amount
FROM sales s
INNER JOIN (
    SELECT AVG(amount) AS avg_amount FROM sales
) avg_sales ON s.amount > avg_sales.avg_amount;
```

### 使い分けの指針

| 状況 | 推奨 |
|------|------|
| 単純な存在チェック | EXISTS/NOT EXISTS |
| 集計値との比較 | スカラーサブクエリ |
| 複数の列が必要な結合 | JOIN |
| 結果セットを結合して新しい列が欲しい | JOIN |
| 可読性重視の複雑なクエリ | CTE（WITH句）|

```sql
-- JOINで書いた方が読みやすい例
-- 顧客名と注文数を一緒に取得
SELECT
    c.customer_name,
    COUNT(o.order_id) AS order_count
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_name;

-- サブクエリで書くと複雑になる例（同じ結果）
SELECT
    c.customer_name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS order_count
FROM customers c;
```

> **ポイント**  
> 「JOIN + GROUP BY」と「相関サブクエリ」は同じ結果を返せることが多いです。一般的にJOINの方がパフォーマンス面で優れていますが、相関サブクエリの方が直感的に読める場合もあります。実行計画（EXPLAIN）で比較するのが確実です。

> **現場メモ**  
> 「サブクエリかJOINか」という迷いは現場でもよく出ます。筆者の判断基準は「結果の列が増えるかどうか」です。右テーブルの列も取り出したい場合はJOIN、単に絞り込みや集計値との比較だけならサブクエリ、という切り分けで大体うまくいきます。また、相関サブクエリは「読みやすいけど遅い」の代表例です。`SELECT COUNT(*) FROM orders WHERE customer_id = c.id` のような相関サブクエリを顧客テーブルの全行に対して実行すると、顧客が10万人いれば10万回クエリが走るN+1問題が起きます。「相関サブクエリを見たらEXPLAINで実行回数を確認する」を習慣にしてください。

---

## 8. サブクエリのパフォーマンス注意点

### 相関サブクエリは行数が多いと遅くなる

```sql
-- パフォーマンスが悪い例: 100万行のテーブルに相関サブクエリを使う
-- SELECT staff_name, amount
-- FROM sales s1
-- WHERE amount = (SELECT MAX(amount) FROM sales s2 WHERE s2.staff_name = s1.staff_name);
-- → 外側の行数分だけ内側が実行される

-- 改善例: ウィンドウ関数を使う（lesson13で詳しく学ぶ）
SELECT
    staff_name,
    amount
FROM (
    SELECT
        staff_name,
        amount,
        MAX(amount) OVER (PARTITION BY staff_name) AS max_amount
    FROM sales
) sub
WHERE amount = max_amount;
```

### EXPLAINでクエリの実行計画を確認する

```sql
-- 実行計画を確認（どのように実行されるかを表示）
EXPLAIN
SELECT staff_name, amount
FROM sales
WHERE amount > (SELECT AVG(amount) FROM sales);

-- より詳細な情報（実際に実行して時間も計測）
EXPLAIN ANALYZE
SELECT staff_name, amount
FROM sales
WHERE amount > (SELECT AVG(amount) FROM sales);
```

> **ポイント**  
> `EXPLAIN ANALYZE` は実際にクエリを実行して実時間を計測します。本番環境の大テーブルに対してはまず `EXPLAIN`（実行しない）で計画だけ確認しましょう。

> **現場メモ**  
> サブクエリのパフォーマンス問題で最も典型的なのは「相関サブクエリのN+1」と「IN句に大量の値を渡す」の2パターンです。EXPLAINでは「Subquery Scan」や「Nested Loop」が繰り返し現れたら要注意です。筆者が経験した案件で、顧客一覧を返すAPIが5秒以上かかっていた原因は、SELECT句の中に `(SELECT COUNT(*) FROM orders WHERE customer_id = c.id)` という相関サブクエリが入っており、顧客数分だけSQLが走っていたためでした。LEFT JOIN + GROUP BYに書き換えたところ0.1秒以下になりました。このパターンはORMのlazyloadingでも同じ問題として現れます（N+1問題）。

---

## 9. よくあるミス（列数・行数のミスマッチ）

### ミス1: スカラーサブクエリが複数行を返す

```sql
-- 悪い例: サブクエリが複数行を返すとエラー
-- SELECT staff_name
-- FROM sales
-- WHERE amount = (SELECT amount FROM sales WHERE staff_name = '田中');
-- エラー: subquery returns more than one row

-- 正しい例: INを使う
SELECT staff_name
FROM sales
WHERE amount IN (SELECT amount FROM sales WHERE staff_name = '田中');

-- または集計関数を使う
SELECT staff_name
FROM sales
WHERE amount = (SELECT MAX(amount) FROM sales WHERE staff_name = '田中');
```

### ミス2: 列数のミスマッチ

```sql
-- 悪い例: IN のサブクエリで複数列を返している
-- SELECT * FROM products WHERE product_id IN (SELECT product_id, quantity FROM order_items);
-- エラー: subquery has too many columns

-- 正しい例: 1列だけ返す
SELECT * FROM products WHERE product_id IN (SELECT product_id FROM order_items);
```

### ミス3: FROM句サブクエリのエイリアス忘れ

```sql
-- 悪い例: エイリアスなし
-- SELECT * FROM (SELECT staff_name, SUM(amount) FROM sales GROUP BY staff_name);
-- エラー: subquery in FROM must have an alias

-- 正しい例: エイリアスをつける
SELECT *
FROM (
    SELECT staff_name, SUM(amount) AS total FROM sales GROUP BY staff_name
) AS staff_summary;
```

### ミス4: NOT INのNULL問題

```sql
-- これがNULLを含むと全件除外される危険な書き方
-- SELECT * FROM products WHERE product_id NOT IN (SELECT manager_id FROM staff);
-- manager_idにNULLが含まれると結果が0件になる!

-- 安全な書き方
SELECT * FROM products
WHERE product_id NOT IN (
    SELECT manager_id FROM staff WHERE manager_id IS NOT NULL
);

-- またはNOT EXISTSを使う
SELECT p.* FROM products p
WHERE NOT EXISTS (
    SELECT 1 FROM staff s WHERE s.manager_id = p.product_id
);
```

> **注意**  
> `NOT IN` のNULL問題は非常に見落としやすいバグの原因です。NULL含む列への `NOT IN` は必ず `NOT EXISTS` または `LEFT JOIN + IS NULL` に置き換える習慣をつけましょう。

---

## 10. ポイント

- **相関サブクエリを SELECT 句や WHERE 句に使っている場合、N+1 になっていないか**
  - 外側の行数分だけ内側が実行される → JOIN + GROUP BY への書き換えを検討
- **NOT IN のサブクエリに NULL が混入する可能性はないか**
  - NULL があると結果が 0 件になる → NOT EXISTS か LEFT JOIN + IS NULL を推奨
- **FROM 句サブクエリ（インラインビュー）が複雑になっていないか**
  - 3 段以上のネストは CTE に書き換えると可読性が上がる
- **スカラーサブクエリが「1行のみ返る保証」があるか**
  - 複数行返る可能性があればエラーになる → LIMIT 1 か集計関数で対応
- **サブクエリを使っている箇所で EXPLAIN ANALYZE による確認はしたか**

---

## 11. まとめ

| テーマ | 要点 |
| --- | --- |
| サブクエリとは | SQLの中に書く別のSQL。内側から先に実行される |
| スカラーサブクエリ | 1行1列を返す。SELECT句やWHERE句の比較演算子と組み合わせる |
| WHERE + IN | サブクエリが返す複数値との一致確認。NULLに注意 |
| FROM句サブクエリ | 派生テーブルとして扱う。必ずエイリアスをつける |
| 相関サブクエリ | 外側の行の値を参照する。行数が多いと遅くなる |
| EXISTS / NOT EXISTS | 存在チェックに使う。NULLに強く、INより効率的なことが多い |
| JOIN vs サブクエリ | 列が必要ならJOIN、存在チェックはEXISTS、複雑ならCTE |
| よくあるミス | 複数行返却・列数不一致・エイリアス忘れ・NOT INのNULL問題 |

---

## 練習問題

以下のテーブルを使って解いてください。

```sql
CREATE TABLE IF NOT EXISTS sales (
  id         INTEGER PRIMARY KEY,
  staff_name TEXT    NOT NULL,
  amount     INTEGER NOT NULL,
  sale_date  DATE    NOT NULL
);
DELETE FROM sales;
INSERT INTO sales (id, staff_name, amount, sale_date) VALUES
  (1, '田中',  50000, '2024-03-01'),
  (2, '鈴木',  80000, '2024-03-05'),
  (3, '田中',  30000, '2024-03-10'),
  (4, '佐藤', 120000, '2024-03-15'),
  (5, '鈴木',  40000, '2024-03-20'),
  (6, '佐藤',  90000, '2024-03-25');

CREATE TABLE IF NOT EXISTS products (
  product_id   INTEGER PRIMARY KEY,
  product_name TEXT    NOT NULL,
  category     TEXT    NOT NULL
);
DELETE FROM products;
INSERT INTO products (product_id, product_name, category) VALUES
  (1, 'りんご',   '果物'),
  (2, 'みかん',   '果物'),
  (3, 'にんじん', '野菜'),
  (4, 'キャベツ', '野菜'),
  (5, 'バナナ',   '果物');

CREATE TABLE IF NOT EXISTS order_items (
  item_id    INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  quantity   INTEGER NOT NULL
);
DELETE FROM order_items;
INSERT INTO order_items (item_id, product_id, quantity) VALUES
  (1, 1, 3),
  (2, 3, 5),
  (3, 5, 2);
```

### 問題1: スカラーサブクエリで平均以上を絞り込む

> 参照：[2. スカラーサブクエリ（1行1列を返す）](#2-スカラーサブクエリ1行1列を返す)

`sales` テーブルから、全体の平均 `amount` より大きい取引の `staff_name` と `amount` を取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT staff_name, amount
FROM sales
WHERE amount > (SELECT AVG(amount) FROM sales);
```

**解説：** `(SELECT AVG(amount) FROM sales)` がスカラーサブクエリです。内側のクエリで全体平均を計算し、その値を外側の WHERE 句の比較に使います。スカラーサブクエリは1行1列を返す必要があり、`AVG` などの集計関数と組み合わせるのが典型パターンです。

</details>

### 問題2: IN と EXISTS で注文済み商品を取得

> 参照：[3. WHERE句のサブクエリ（IN/NOT IN との組み合わせ）](#3-where句のサブクエリinnot-in-との組み合わせ) ・ [6. 相関サブクエリとEXISTS](#6-相関サブクエリとexists)

`products` テーブルから、`order_items` に1件以上登録されている商品の `product_name` を IN を使って取得してください。また、同じ結果を EXISTS でも書いてみてください。

<details>
<summary>回答を見る</summary>

```sql
-- IN を使う場合
SELECT product_name
FROM products
WHERE product_id IN (
    SELECT product_id FROM order_items
);

-- EXISTS を使う場合
SELECT p.product_name
FROM products p
WHERE EXISTS (
    SELECT 1
    FROM order_items oi
    WHERE oi.product_id = p.product_id
);
```

**解説：** `IN` は「サブクエリが返す値リストのいずれかに一致するか」を確認します。`EXISTS` は「サブクエリが1件以上返すか」を確認します。どちらも同じ結果（りんご・にんじん・バナナ）を返しますが、`EXISTS` は最初にマッチした時点で検索を止めるため、大量データでは効率的です。

</details>

### 問題3: FROM句サブクエリでスタッフ別合計を絞り込む

> 参照：[4. FROM句のサブクエリ（インラインビュー・派生テーブル）](#4-from句のサブクエリインラインビュー・派生テーブル)

`sales` テーブルをスタッフ別に合計し、合計 `amount` が 100,000 円以上のスタッフのみを取得してください（FROM句のサブクエリを使って）。

<details>
<summary>回答を見る</summary>

```sql
SELECT staff_name, total_amount
FROM (
    SELECT staff_name, SUM(amount) AS total_amount
    FROM sales
    GROUP BY staff_name
) AS staff_summary
WHERE total_amount >= 100000;
```

**解説：** `WHERE` 句には集計関数を直接書けません（`WHERE SUM(amount) >= ...` はエラー）。FROM句にサブクエリを書いて派生テーブルを作り、外側の `WHERE` で絞り込むのが典型的な解決策です。派生テーブルには必ず `AS staff_summary` のようなエイリアスをつける必要があります。

</details>
