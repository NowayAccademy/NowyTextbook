# JOIN応用
FULL OUTER JOIN・CROSS JOIN・複数テーブルのJOIN・自己結合を学びます

## 本章の目標

本章では以下を目標にして学習します。

- FULL OUTER JOINを使って両テーブルの全行を取得できること
- CROSS JOINで全組み合わせを生成できること
- 3テーブル以上を結合したクエリを書けること
- 自己結合で親子・上司部下のような階層関係を表現できること
- アンチジョインでどちらかのテーブルにしかないレコードを見つけられること

---

## 1. FULL OUTER JOIN（両テーブルの全行を取得）

### FULL OUTER JOINとは

INNER JOINは「両方のテーブルに存在する行」だけを返します。LEFT JOINは「左テーブルの全行 + 右テーブルにマッチした行」を返します。  
では「**両方のテーブルの全行**」を取得したい場合はどうするか？それが **FULL OUTER JOIN** です。

イメージとしては「左のテーブルにしかない行も、右のテーブルにしかない行も、すべてひとまとめにして返す」という結合です。マッチしなかった側はNULLで埋められます。

```sql
-- テーブル準備
CREATE TABLE employees (
    id   INT PRIMARY KEY,
    name TEXT
);

CREATE TABLE departments (
    id          INT PRIMARY KEY,
    dept_name   TEXT,
    employee_id INT
);

INSERT INTO employees VALUES (1, '田中'), (2, '鈴木'), (3, '佐藤');
INSERT INTO departments VALUES (10, '開発', 1), (20, '営業', 2), (30, '総務', NULL);

-- FULL OUTER JOIN
SELECT
    e.id        AS emp_id,
    e.name      AS emp_name,
    d.dept_name
FROM employees e
FULL OUTER JOIN departments d ON e.id = d.employee_id;
```

**結果イメージ**

| emp_id | emp_name | dept_name |
|--------|----------|-----------|
| 1      | 田中     | 開発      |
| 2      | 鈴木     | 営業      |
| 3      | 佐藤     | NULL      |
| NULL   | NULL     | 総務      |

> **ポイント**  
> FULL OUTER JOINでは「どちらか一方にしかない行」がNULLを含んで返ります。佐藤は部署に割り当てられておらず、総務は担当社員がいないことが一目でわかります。

---

## 2. FULL OUTER JOINの使い所（差分確認）

### データの差分チェックに使う

FULL OUTER JOINの最も実用的な使い方は、**2つのテーブル間の差分を確認する**ことです。例えば「マスタテーブルと実績テーブルを比べて、どちらかにしか存在しないレコードを見つける」といった場面で活躍します。

```sql
-- 左テーブルにしかない行（部署に割り当てられていない社員）を取得
SELECT e.id, e.name
FROM employees e
FULL OUTER JOIN departments d ON e.id = d.employee_id
WHERE d.employee_id IS NULL AND e.id IS NOT NULL;

-- 右テーブルにしかない行（担当社員のいない部署）を取得
SELECT d.dept_name
FROM employees e
FULL OUTER JOIN departments d ON e.id = d.employee_id
WHERE e.id IS NULL AND d.id IS NOT NULL;
```

### 実際のユースケース

- 本番DB と バックアップDB の差分チェック
- 古い顧客マスタと新しい顧客マスタの突き合わせ
- 注文テーブルと請求テーブルの未消込チェック

> **ポイント**  
> FULL OUTER JOINは「どちらかにしか存在しない行」を浮かび上がらせるのに便利です。WHERE句でNULL判定を組み合わせることで、片側のみのレコードを絞り込めます。

---

## 3. CROSS JOIN（直積、全組み合わせ）

### CROSS JOINとは

CROSS JOINは「テーブルAの全行」×「テーブルBの全行」のすべての組み合わせを返します。数学でいう「直積（デカルト積）」です。

ON句や結合条件を書かない点が他のJOINと大きく異なります。

```sql
-- 色テーブル
CREATE TABLE colors (color TEXT);
INSERT INTO colors VALUES ('赤'), ('青'), ('緑');

-- サイズテーブル
CREATE TABLE sizes (size TEXT);
INSERT INTO sizes VALUES ('S'), ('M'), ('L');

-- CROSS JOINで全組み合わせを生成
SELECT
    c.color,
    s.size
FROM colors c
CROSS JOIN sizes s;
```

**結果（3 × 3 = 9行）**

| color | size |
|-------|------|
| 赤    | S    |
| 赤    | M    |
| 赤    | L    |
| 青    | S    |
| 青    | M    |
| 青    | L    |
| 緑    | S    |
| 緑    | M    |
| 緑    | L    |

> **注意**  
> テーブルが大きい場合、CROSS JOINの結果行数は「行数A × 行数B」になります。1万行 × 1万行 = 1億行になるため、意図せず実行すると大変なことになります。使う際は必ず件数を確認してから実行しましょう。

> **現場メモ**  
> CROSS JOINを意図せず発生させてしまう「古いSQL記法」に注意が必要です。`FROM table_a, table_b WHERE a.id = b.id` という書き方はCROSS JOINと等価で、WHERE句の条件をうっかり外すと全行の組み合わせが返ります。筆者がレガシーコードを保守していたとき、開発者がWHERE句を誤って削除してしまい、数万行 × 数万行のカーテシアン積が発生してDBに高負荷がかかった経験があります。現在は `INNER JOIN ... ON ...` と明示的に書くスタイルが標準です。古い記法を見かけたら、レビューで現代的な書き方へのリライトを提案することをお勧めします。

---

## 4. CROSS JOINの使い所（カレンダー生成等）

### カレンダーの生成

CROSS JOINは「すべての組み合わせが欲しい」場面で重宝します。代表的なのがカレンダーの生成です。

```sql
-- 月のテーブルを生成してCROSS JOINでカレンダーを作る
WITH months AS (
    SELECT generate_series(1, 12) AS month
),
days AS (
    SELECT generate_series(1, 31) AS day
)
SELECT month, day
FROM months
CROSS JOIN days
ORDER BY month, day
LIMIT 30; -- 確認用に30行だけ表示
```

### 商品と倉庫の在庫マスタ生成

```sql
-- 全商品 × 全倉庫の組み合わせで在庫マスタの雛形を作る
CREATE TABLE products (product_id INT, product_name TEXT);
CREATE TABLE warehouses (warehouse_id INT, location TEXT);

INSERT INTO products VALUES (1, 'りんご'), (2, 'みかん'), (3, 'ぶどう');
INSERT INTO warehouses VALUES (101, '東京倉庫'), (102, '大阪倉庫');

SELECT
    p.product_id,
    p.product_name,
    w.warehouse_id,
    w.location,
    0 AS stock_count  -- 初期在庫は0
FROM products p
CROSS JOIN warehouses w
ORDER BY p.product_id, w.warehouse_id;
```

> **ポイント**  
> CROSS JOINは「マスタデータとマスタデータを掛け合わせて初期データを作る」用途でよく使われます。ゲームのキャラクター × 装備の組み合わせ一覧、時間帯 × 曜日のシフト雛形なども同様です。

---

## 5. 3テーブル以上のJOIN（順序と可読性）

### 複数テーブルのJOIN

実務では3つ以上のテーブルを結合することが頻繁にあります。JOINは左から順番に処理されていくイメージです。

```sql
-- テーブル準備
CREATE TABLE orders (
    order_id    INT PRIMARY KEY,
    customer_id INT,
    product_id  INT,
    quantity    INT
);

CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    customer_name TEXT
);

CREATE TABLE products_master (
    product_id   INT PRIMARY KEY,
    product_name TEXT,
    price        INT
);

INSERT INTO customers VALUES (1, '山田商店'), (2, '鈴木ショップ');
INSERT INTO products_master VALUES (10, 'りんご', 150), (20, 'みかん', 100);
INSERT INTO orders VALUES (1, 1, 10, 5), (2, 1, 20, 3), (3, 2, 10, 2);

-- 3テーブルを結合して注文一覧を取得
SELECT
    o.order_id,
    c.customer_name,
    p.product_name,
    o.quantity,
    p.price * o.quantity AS total_price
FROM orders o
INNER JOIN customers c         ON o.customer_id = c.customer_id
INNER JOIN products_master p   ON o.product_id  = p.product_id
ORDER BY o.order_id;
```

### 可読性のためのコツ

```sql
-- 長くなる場合はCTEを使うと読みやすい（詳細はlesson11参照）
WITH order_details AS (
    SELECT
        o.order_id,
        o.customer_id,
        o.product_id,
        o.quantity
    FROM orders o
)
SELECT
    od.order_id,
    c.customer_name,
    p.product_name,
    od.quantity,
    p.price * od.quantity AS total_price
FROM order_details od
INNER JOIN customers c         ON od.customer_id = c.customer_id
INNER JOIN products_master p   ON od.product_id  = p.product_id;
```

> **ポイント**  
> JOINを重ねるときは「どのテーブルが中心か」を意識してください。中心テーブル（ここではorders）をFROMに置き、そこから関連テーブルをJOINしていくと論理的に読みやすくなります。

> **現場メモ**  
> 実務では4〜5テーブルを結合するクエリも珍しくありませんが、JOINが3つを超えたあたりからコードの見通しが急激に悪くなります。そのタイミングで「CTEに分割できないか」を検討することをお勧めします。筆者が経験したケースでは、5テーブルJOINのクエリが「なぜこの結果になるのか誰もわからない」状態になっていて、CTEに分割したところバグが2つ見つかったことがありました。またPostgreSQLのプランナーはJOINの順序を最適化しますが、複雑すぎると最適化に失敗して遅いプランを選ぶことがあります。EXPLAINで確認しながら、必要に応じてCTEを使って中間結果を明示的に作るとパフォーマンスが改善することがあります。

---

## 6. 自己結合（同じテーブルを2回JOINする）

### 自己結合とは

**自己結合**とは、同じテーブルを「2つの別テーブルのように見なして」結合する手法です。必ずエイリアス（別名）を付けることで区別します。

```sql
-- 社員テーブル（manager_idは上司の社員IDを指す）
CREATE TABLE staff (
    id         INT PRIMARY KEY,
    name       TEXT,
    manager_id INT  -- NULLの場合は最上位
);

INSERT INTO staff VALUES
    (1, '社長',   NULL),
    (2, '部長A',  1),
    (3, '部長B',  1),
    (4, '課長C',  2),
    (5, '課長D',  2),
    (6, '一般E',  4);

-- 社員とその上司名を取得する自己結合
SELECT
    e.id        AS emp_id,
    e.name      AS emp_name,
    m.name      AS manager_name
FROM staff e
LEFT JOIN staff m ON e.manager_id = m.id
ORDER BY e.id;
```

**結果**

| emp_id | emp_name | manager_name |
|--------|----------|--------------|
| 1      | 社長     | NULL         |
| 2      | 部長A    | 社長         |
| 3      | 部長B    | 社長         |
| 4      | 課長C    | 部長A        |
| 5      | 課長D    | 部長A        |
| 6      | 一般E    | 課長C        |

> **ポイント**  
> 自己結合では必ず別々のエイリアス（e, mなど）を付けてください。同じテーブルを「社員として」と「上司として」の2役で使うイメージです。

---

## 7. 自己結合の使い所（親子関係、上司・部下）

### カテゴリの親子関係

```sql
-- カテゴリテーブル（parent_idで親カテゴリを参照）
CREATE TABLE categories (
    id        INT PRIMARY KEY,
    name      TEXT,
    parent_id INT
);

INSERT INTO categories VALUES
    (1, '食品',     NULL),
    (2, '野菜',     1),
    (3, '果物',     1),
    (4, 'にんじん', 2),
    (5, 'りんご',   3);

-- 各カテゴリとその親カテゴリ名を取得
SELECT
    c.name       AS category,
    p.name       AS parent_category
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.id
ORDER BY c.id;
```

### 同じ部署の社員を横に並べる

```sql
-- 同じ部署に所属する社員のペアを取得（重複排除）
SELECT
    a.name AS employee_a,
    b.name AS employee_b
FROM staff a
INNER JOIN staff b ON a.manager_id = b.manager_id
WHERE a.id < b.id  -- 重複ペアを防ぐ（A,BとB,Aが両方出ないように）
ORDER BY a.name;
```

> **ポイント**  
> 自己結合で「同じグループ内の組み合わせ」を作る場合、`a.id < b.id` のような条件で重複ペアを防ぐのが定石です。

---

## 8. アンチジョイン（LEFT JOIN + WHERE IS NULL）

### アンチジョインとは

アンチジョインは「**テーブルAにあってテーブルBにはない**レコードを取得する」手法です。「まだ注文していない顧客」「商品が割り当てられていない社員」などを見つけるのに使います。

```sql
-- 注文履歴のない顧客を取得するアンチジョイン
SELECT
    c.customer_id,
    c.customer_name
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_id IS NULL;  -- JOINしてもマッチしなかった行
```

### NOT INを使った書き方との比較

```sql
-- NOT IN を使う方法（NULLに注意）
SELECT customer_id, customer_name
FROM customers
WHERE customer_id NOT IN (
    SELECT customer_id FROM orders
);

-- NOT EXISTS を使う方法
SELECT c.customer_id, c.customer_name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id
);
```

> **注意**  
> `NOT IN` はサブクエリ内にNULLが含まれると期待通りに動作しません（結果が0件になることがあります）。安全性の面では **LEFT JOIN + IS NULL** か **NOT EXISTS** を使う方が推奨されます。

> **現場メモ**  
> `NOT IN` のNULLハマりは、経験豊富なエンジニアでも油断すると踏む落とし穴です。「対象外の顧客を除いて集計」というバッチ処理を書いたとき、`NOT IN` のサブクエリに `NULL` が1件混入しただけで結果が「0件」になるバグが本番データで発生し、「集計結果がおかしい」という報告が来てから気づいた経験があります。`NOT IN` のサブクエリは `WHERE xxx IS NOT NULL` を付けて NULL を明示的に除外するか、最初から `NOT EXISTS` か `LEFT JOIN + IS NULL` を使う習慣をつけることを強くお勧めします。面接でも「NOT INのNULLについて説明してください」という質問が出ることがあります。

---

## 9. JOINの実行順序のイメージ

### SQLの論理的な処理順序

SQLは書いた順に実行されるのではなく、内部的に決まった順序で処理されます：

```
1. FROM（どのテーブルを使うか）
2. JOIN（テーブルを結合）
3. WHERE（行を絞り込む）
4. GROUP BY（グループ化）
5. HAVING（グループを絞り込む）
6. SELECT（列を選択）
7. ORDER BY（並び替え）
8. LIMIT（件数を制限）
```

```sql
-- 実行順序を意識して読むと理解しやすい例
SELECT
    c.customer_name,           -- 6. この列を選ぶ
    SUM(p.price * o.quantity)  -- 6. 合計を計算
FROM orders o                  -- 1. ordersを起点に
INNER JOIN customers c ON o.customer_id = c.customer_id  -- 2. 顧客と結合
INNER JOIN products_master p ON o.product_id = p.product_id  -- 2. 商品と結合
WHERE o.quantity > 2           -- 3. 数量2以上に絞る
GROUP BY c.customer_name       -- 4. 顧客名でグループ化
HAVING SUM(p.price * o.quantity) > 500  -- 5. 合計500以上に絞る
ORDER BY SUM(p.price * o.quantity) DESC  -- 7. 降順で並べる
LIMIT 10;                      -- 8. 10件に絞る
```

> **ポイント**  
> JOIN後に WHERE で絞り込まれます。そのため「JOINしてから条件を絞る」と「ON句に条件を書く」では、LEFT JOINの場合に結果が変わることがあります。意図を明確にするためにも、結合条件はON句、フィルタ条件はWHERE句に分けて書くのが基本です。

---

## 10. よくあるミスと対処法

### ミス1: カーテシアン積の発生（意図しないCROSS JOIN）

```sql
-- ON句を書き忘れると全行 × 全行になってしまう
-- 悪い例
SELECT * FROM orders, customers;  -- これは古い記法でCROSS JOINと同じ！

-- 正しい例
SELECT * FROM orders o
INNER JOIN customers c ON o.customer_id = c.customer_id;
```

### ミス2: LEFT JOINのWHERE条件で意図せずINNER JOINになる

```sql
-- 悪い例: WHERE句に右テーブルの条件を書くとINNER JOINと同じになる
SELECT c.customer_name, o.order_id
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.quantity > 2;  -- NULLの行は除外されてしまう！

-- 良い例: 右テーブルの条件はON句に書く（または意図してINNER JOINに変える）
SELECT c.customer_name, o.order_id
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
                   AND o.quantity > 2;  -- ON句に書くとNULL行が残る
```

> **現場メモ**  
> 「注文履歴のない顧客も含めてレポートを作りたい」と依頼されてLEFT JOINで書いたのに、WHERE句に右テーブルの条件を書いてしまって「注文した顧客しか出ない」バグは頻出です。筆者がPRレビューで最もよく指摘するのがこのパターンです。コードを書いたエンジニア自身も「LEFT JOINを使ったから大丈夫」と思い込んでいることが多く、テストデータに「注文履歴なし顧客」を入れていないと発見が遅れます。LEFT JOINを使う際は「右テーブルがNULLになるケースのテストデータ」を必ず用意してください。

### ミス3: 自己結合でエイリアスをつけ忘れる

```sql
-- 悪い例: エイリアスなしだとどちらのテーブルか不明
-- SELECT id, name FROM staff JOIN staff ON manager_id = id;  -- エラー

-- 正しい例
SELECT e.id, e.name, m.name AS manager_name
FROM staff e
LEFT JOIN staff m ON e.manager_id = m.id;
```

### ミス4: FULL OUTER JOINとUNIONの混同

```sql
-- FULL OUTER JOINはUNIONとは別物
-- UNION: 行を縦に結合する（同じ列構造が必要）
-- FULL OUTER JOIN: テーブルを横に結合する（列が増える）

-- 正しく使い分けること
SELECT id, name FROM employees
UNION
SELECT id, name FROM contractors;  -- 縦に結合

-- 横に結合するならFULL OUTER JOIN
SELECT e.name AS employee, c.name AS contractor
FROM employees e
FULL OUTER JOIN contractors c ON e.id = c.id;
```

> **注意**  
> JOINの種類（INNER/LEFT/RIGHT/FULL/CROSS）を間違えると、取得できる行数が大きく変わります。実行前に「何行返ってくるはずか」を頭の中でイメージする習慣をつけましょう。

---

## 11. ポイント

JOINを使ったSQLのコードレビューで確認するポイントをまとめます。

### INNER JOIN vs LEFT JOIN の選択

- **「右テーブルにデータが必ずある保証があるか」を確認する**
  - 保証がなければ LEFT JOIN を使うべき。INNER JOIN だとデータが欠ける
- **LEFT JOIN を使ったのに WHERE 句で右テーブルの条件を書いていないか**
  - `WHERE right_table.col = x` を書くと INNER JOIN と同じ効果になる
  - 右テーブルへのフィルタ条件は `ON` 句に書く

### パフォーマンスと可読性

- **JOIN が 3 つ以上になっていたら CTE への分割を検討する**
  - 複雑な JOIN は読みにくく、プランナーの最適化に失敗することがある
- **CROSS JOIN が意図的かどうか確認する**
  - `FROM a, b` という古い記法で ON 条件がない場合、意図しない CROSS JOIN になっていることがある
- **自己結合のエイリアスが意味のある名前になっているか**
  - `e`（employee）, `m`（manager）など、役割がわかるエイリアスをつける

### アンチジョイン

- **`NOT IN` のサブクエリに NULL が混入する可能性がないか**
  - NULL が含まれると結果が 0 件になるバグが起きる
  - `NOT EXISTS` か `LEFT JOIN + WHERE IS NULL` を推奨
- **アンチジョインを使う場面で、単に「一致しない行を取りたい」だけか**
  - `NOT IN` に大量データのサブクエリを渡すとパフォーマンスが悪くなる場合がある

---

## 12. まとめ

| テーマ | 要点 |
| --- | --- |
| FULL OUTER JOIN | 両テーブルの全行を返す。マッチしない側はNULLになる |
| FULL OUTER JOINの用途 | 2テーブル間の差分確認・突き合わせ |
| CROSS JOIN | 全行の組み合わせ（直積）を返す。件数に注意 |
| CROSS JOINの用途 | カレンダー生成・マスタの組み合わせ雛形作成 |
| 複数テーブルのJOIN | 中心テーブルをFROMに置き、左から順にJOINを重ねる |
| 自己結合 | 同じテーブルを2回使う。必ずエイリアスをつける |
| 自己結合の用途 | 親子関係・上司部下・同グループのペア生成 |
| アンチジョイン | LEFT JOIN + WHERE IS NULL で「片方にしかない行」を取得 |
| 実行順序 | FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT |
| よくあるミス | ON句忘れ・LEFT JOINのWHERE条件・エイリアス忘れ |

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
  (1, '田中',  85000, '2024-01-10'),
  (2, '鈴木', 120000, '2024-01-15'),
  (3, '田中',  60000, '2024-02-01'),
  (4, '佐藤',  95000, '2024-02-10'),
  (5, '鈴木',  40000, '2024-02-20');

CREATE TABLE IF NOT EXISTS products (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL
);
DELETE FROM products;
INSERT INTO products (id, name) VALUES
  (1, 'りんご'), (2, 'みかん'), (3, 'にんじん'), (4, 'バナナ');

CREATE TABLE IF NOT EXISTS order_items (
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity   INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
DELETE FROM order_items;
INSERT INTO order_items (order_id, product_id, quantity) VALUES
  (1, 1, 3), (1, 3, 2),
  (2, 2, 5), (2, 4, 1),
  (3, 1, 1);
```

### 問題1: スカラーサブクエリで平均以上を取得

> 参照：[1. FULL OUTER JOIN](#1-full-outer-join両テーブルの全行を取得)

`sales` テーブルで、`amount` が全体の平均以上の行を取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT staff_name, amount
FROM sales
WHERE amount >= (SELECT AVG(amount) FROM sales);
```

**解説：** `(SELECT AVG(amount) FROM sales)` はスカラーサブクエリで、単一の値（全体平均）を返します。外側の WHERE でその値と比較します。平均は 80000 になるので田中85000・鈴木120000・佐藤95000が該当します。

</details>

### 問題2: FROM サブクエリで担当者別集計を絞り込み

> 参照：[8. アンチジョイン](#8-アンチジョインleft-join-where-is-null)

担当者ごとの合計売上を集計し、そのうち合計が 150000 以上の担当者だけを取得してください（FROM 句にサブクエリを使ってください）。

<details>
<summary>回答を見る</summary>

```sql
SELECT staff_name, total_amount
FROM (
  SELECT staff_name, SUM(amount) AS total_amount
  FROM sales
  GROUP BY staff_name
) AS staff_totals
WHERE total_amount >= 150000;
```

**解説：** FROM 句のサブクエリ（インラインビュー）は一時的な仮想テーブルとして扱われます。エイリアス（`staff_totals`）が必須です。内側で GROUP BY して集計し、外側で HAVING の代わりに WHERE で絞ります。鈴木（160000）のみが該当します。

</details>

### 問題3: EXISTS で条件一致の確認

> 参照：[1. FULL OUTER JOIN](#1-full-outer-join両テーブルの全行を取得)

`order_items` に1件以上購入実績のある `products` の `name` を EXISTS を使って取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT name
FROM products AS p
WHERE EXISTS (
  SELECT 1
  FROM order_items AS oi
  WHERE oi.product_id = p.id
);
```

**解説：** `EXISTS (サブクエリ)` はサブクエリが1行でも返せば真です。`SELECT 1` は実際の値ではなく「行が存在するか」だけを確認するため定番の書き方です。相関サブクエリで外側の `p.id` を参照しているのがポイントです。`IN` でも書けますが、EXISTS は行が見つかった時点で走査を止めるため効率的です。

</details>
