# 集計関数
COUNT・SUM・AVG・MAX・MINの使い方とNULLの扱いを学びます

## 本章の目標

本章では以下を目標にして学習します。

- COUNT・SUM・AVG・MAX・MIN の各集計関数を正しく使えること
- NULL が集計に与える影響を理解し、意図した通りの集計ができること
- COUNT(*) と COUNT(列名) の違いを説明できること
- FILTER 句を使って条件付き集計ができること
- 集計関数が WHERE 句では使えない理由を理解していること

---

## 1. 集計関数とは

集計関数（Aggregate Function）は、複数の行を1つの値にまとめる関数です。  
「全商品の合計金額」「平均年齢」「最大値・最小値」などを計算するために使います。

以下の `orders` テーブルを例に使います。

| id | customer_id | product | amount | status | order_date |
|----|-------------|---------|--------|--------|------------|
| 1 | 101 | りんご | 1500 | 完了 | 2024-01-05 |
| 2 | 102 | バナナ | 800 | 完了 | 2024-01-10 |
| 3 | 101 | みかん | NULL | キャンセル | 2024-01-15 |
| 4 | 103 | ぶどう | 3000 | 完了 | 2024-02-03 |
| 5 | 102 | いちご | 2500 | 完了 | 2024-02-08 |
| 6 | 104 | メロン | 5000 | 完了 | 2024-02-12 |
| 7 | 101 | スイカ | 4000 | 完了 | 2024-03-01 |

### 集計関数を使わないクエリ（行ごとにデータを返す）

```sql
SELECT id, customer_id, amount FROM orders;
-- 7行返ってくる
```

### 集計関数を使ったクエリ（全行を1行に集約する）

```sql
SELECT SUM(amount) AS total_amount FROM orders;
-- 1行だけ返ってくる
```

> **ポイント**  
> 集計関数は複数の行を1行に「圧縮」します。  
> GROUP BY を使わない場合は、テーブル全体が1つのグループとして扱われます。

---

## 2. COUNT(*) vs COUNT(列名)

### COUNT(*) — すべての行数をカウント

```sql
-- NULL を含む全行をカウント
SELECT COUNT(*) AS total_rows FROM orders;
-- 結果: 7
```

`COUNT(*)` はテーブルの全行数を返します。NULL の有無に関係なくカウントします。

### COUNT(列名) — 指定した列が NULL でない行数をカウント

```sql
-- amountがNULLでない行数をカウント
SELECT COUNT(amount) AS non_null_amount FROM orders;
-- 結果: 6（id=3 の amount が NULL なのでカウントされない）
```

`COUNT(列名)` は NULL を除いてカウントします。

### 比較の例

```sql
SELECT
    COUNT(*)      AS 全行数,              -- 7
    COUNT(amount) AS amount非NULL件数     -- 6
FROM orders;
```

| 全行数 | amount非NULL件数 |
|--------|----------------|
| 7 | 6 |

> **注意**  
> テーブルの全件数を取得したい場合は `COUNT(*)` を使いましょう。  
> `COUNT(id)` でも同じ結果になることが多いですが、  
> 意図が明確な `COUNT(*)` の方が好まれます。

---

## 3. SUM / AVG / MAX / MIN の基本

### SUM — 合計

```sql
-- 全注文の合計金額
SELECT SUM(amount) AS total_amount FROM orders;
-- 結果: 16800 (NULL は無視される)
```

### AVG — 平均

```sql
-- 全注文の平均金額
SELECT AVG(amount) AS avg_amount FROM orders;
-- 結果: 2800 (16800 ÷ 6件、NULLの1件は除外)
```

### MAX — 最大値

```sql
-- 最も高い注文金額
SELECT MAX(amount) AS max_amount FROM orders;
-- 結果: 5000

-- 最新の注文日
SELECT MAX(order_date) AS latest_order FROM orders;
-- 結果: 2024-03-01
```

### MIN — 最小値

```sql
-- 最も安い注文金額
SELECT MIN(amount) AS min_amount FROM orders;
-- 結果: 800

-- 最も古い注文日
SELECT MIN(order_date) AS oldest_order FROM orders;
-- 結果: 2024-01-05
```

### まとめて使う

```sql
SELECT
    COUNT(*)      AS 注文件数,
    SUM(amount)   AS 合計金額,
    AVG(amount)   AS 平均金額,
    MAX(amount)   AS 最高金額,
    MIN(amount)   AS 最低金額
FROM orders;
```

---

## 4. NULL が集計に与える影響

集計関数は NULL を無視します。

```sql
-- サンプルデータ: amount は (1500, 800, NULL, 3000, 2500, 5000, 4000)

SELECT COUNT(*)      FROM orders;  -- 7（NULLも含む）
SELECT COUNT(amount) FROM orders;  -- 6（NULLを除く）
SELECT SUM(amount)   FROM orders;  -- 16800（NULLを除いた合計）
SELECT AVG(amount)   FROM orders;  -- 2800（16800 ÷ 6、NULLを除いた平均）
SELECT MAX(amount)   FROM orders;  -- 5000
SELECT MIN(amount)   FROM orders;  -- 800
```

### AVG の NULL 除外に注意

AVG の分母は「NULL でない行数」です。これが意図と合わない場合は修正が必要です。

```sql
-- 実際の AVG（NULLを除いた平均）：16800 ÷ 6 = 2800
SELECT AVG(amount) FROM orders;

-- NULL を 0 として計算した平均：16800 ÷ 7 = 2400
SELECT AVG(COALESCE(amount, 0)) FROM orders;
```

どちらが正しいかはビジネス要件によります。  
「キャンセルされた注文は0円として平均を計算してほしい」なら後者です。

> **注意**  
> NULL を除いた AVG が正しいのか、NULL を 0 として計算した AVG が正しいのかは  
> 要件を確認しましょう。黙って NULL を無視すると集計の意味が変わることがあります。

> **現場メモ**  
> 月次レポートで「平均購入金額」を算出していたところ、あるキャンペーン後から数値が急に上振れしました。調べると、キャンペーンでキャンセル注文が増えて `amount` がNULLになった行が多数発生していました。`AVG(amount)` はNULLを除外するため、分母（注文件数）が実態より少なく計算されていました。本来は「キャンセル分も含めた平均」を求めたかったので、`AVG(COALESCE(amount, 0))` に修正しました。集計クエリを書く前には「NULLの行をどう扱うか」を必ずステークホルダーに確認する習慣が必要です。

---

## 5. COUNT(DISTINCT 列名)

`DISTINCT` を `COUNT` の中に使うと、重複を排除した件数を取得できます。

```sql
-- 注文した顧客の数（重複なし）
SELECT COUNT(DISTINCT customer_id) AS unique_customers FROM orders;
-- 結果: 4（customer_id: 101, 102, 103, 104）
-- COUNT(*) なら 7

-- 購入された商品の種類数
SELECT COUNT(DISTINCT product) AS unique_products FROM orders;
-- 結果: 7（全商品が異なる）
```

### COUNT(*) との比較

```sql
SELECT
    COUNT(*)                    AS 全注文件数,     -- 7
    COUNT(DISTINCT customer_id) AS ユニーク顧客数  -- 4
FROM orders;
```

> **ポイント**  
> 「何人のユーザーがアクセスしたか」「何種類の商品が売れたか」のような  
> 「ユニーク件数」を数えたい場合に `COUNT(DISTINCT 列名)` を使います。

---

## 6. 複数の集計を1つのクエリで

1つの SELECT 文で複数の集計結果を取得できます。

```sql
SELECT
    COUNT(*)                    AS 総注文数,
    COUNT(amount)               AS 金額が入力された注文数,
    COUNT(DISTINCT customer_id) AS 注文した顧客数,
    SUM(amount)                 AS 総売上,
    ROUND(AVG(amount), 0)       AS 平均注文金額,
    MAX(amount)                 AS 最高注文金額,
    MIN(amount)                 AS 最低注文金額,
    MAX(order_date)             AS 最新注文日,
    MIN(order_date)             AS 最古注文日
FROM orders;
```

このように1クエリで必要な集計値をまとめて取得できます。

---

## 7. WHERE と組み合わせた集計

`WHERE` で行を絞り込んでから集計できます。

```sql
-- 「完了」ステータスの注文のみ集計
SELECT
    COUNT(*) AS 完了注文数,
    SUM(amount) AS 完了注文合計
FROM orders
WHERE status = '完了';

-- 2024年2月の注文のみ集計
SELECT
    COUNT(*) AS 2月注文数,
    SUM(amount) AS 2月合計
FROM orders
WHERE order_date >= '2024-02-01'
  AND order_date < '2024-03-01';

-- 特定の顧客の集計
SELECT
    COUNT(*) AS 注文回数,
    SUM(amount) AS 合計購入額
FROM orders
WHERE customer_id = 101;
```

> **ポイント**  
> WHERE は集計前にフィルタリングします。集計対象の行を限定したい場合は  
> WHERE を使います。集計後にフィルタリングしたい場合は HAVING を使います（次章）。

---

## 8. 集計関数は WHERE には使えない（HAVING が必要な理由）

集計関数（SUM, COUNT など）を WHERE 句に書くとエラーになります。

```sql
-- エラー：WHERE には集計関数を使えない
SELECT customer_id, SUM(amount) AS total
FROM orders
WHERE SUM(amount) > 5000;  -- ERROR: aggregate functions are not allowed in WHERE
```

なぜ使えないのかというと、SQLの実行順序に理由があります。

```
実行順序：
1. FROM    → テーブルを読む
2. WHERE   → 行を絞り込む（この時点ではまだ集計されていない）
3. GROUP BY → グループ化する
4. 集計関数 → 集計する
5. HAVING  → グループに条件をつける（集計後なのでここで使える）
6. SELECT  → 返す列を決める
7. ORDER BY → 並べ替える
8. LIMIT   → 件数を制限する
```

WHERE が実行される時点では、まだ集計が行われていません。  
集計後の値に条件を付けたい場合は HAVING を使います（次章で詳しく学びます）。

```sql
-- 正しい：集計後にフィルタリングするには HAVING を使う
SELECT customer_id, SUM(amount) AS total
FROM orders
GROUP BY customer_id
HAVING SUM(amount) > 5000;
```

> **注意**  
> `WHERE` に集計関数を使おうとすると必ずエラーになります。  
> 「グループの合計が〜以上」という条件は必ず `HAVING` を使います。

---

## 9. FILTER 句（PostgreSQL、条件付き集計）

PostgreSQL では `FILTER(WHERE 条件)` を集計関数に追加して条件付き集計ができます。  
CASE 式より簡潔に書けます。

### 構文

```sql
集計関数(引数) FILTER(WHERE 条件)
```

### 基本的な使い方

```sql
-- ステータス別の件数を1行で集計
SELECT
    COUNT(*) AS 全件数,
    COUNT(*) FILTER(WHERE status = '完了') AS 完了件数,
    COUNT(*) FILTER(WHERE status = 'キャンセル') AS キャンセル件数,
    SUM(amount) FILTER(WHERE status = '完了') AS 完了金額合計
FROM orders;
```

### CASE 式との比較

```sql
-- CASE を使った書き方（古い方法）
SELECT
    COUNT(*) AS 全件数,
    SUM(CASE WHEN status = '完了' THEN 1 ELSE 0 END) AS 完了件数,
    SUM(CASE WHEN status = '完了' THEN amount ELSE 0 END) AS 完了金額合計
FROM orders;

-- FILTER を使った書き方（PostgreSQL推奨）
SELECT
    COUNT(*) AS 全件数,
    COUNT(*) FILTER(WHERE status = '完了') AS 完了件数,
    SUM(amount) FILTER(WHERE status = '完了') AS 完了金額合計
FROM orders;
```

> **ポイント**  
> `FILTER` は SQL:2003 標準の構文です。PostgreSQL 9.4 以降で使えます。  
> CASE を使った書き方より意図が明確で読みやすくなります。

> **現場メモ**  
> `FILTER` 句はPostgreSQLを使っているなら積極的に採用したい機能です。以前は `SUM(CASE WHEN status = '完了' THEN amount ELSE 0 END)` のような書き方をしていましたが、条件が増えるとCASE式が入れ子になって読みにくくなっていました。`FILTER` を知ってからはコードレビューで「これはFILTER句で書けますよ」と提案するようになりました。新規コードはFILTER句に統一することで可読性が上がります。ただしMySQL等に移植するときはFILTER句が使えないので注意が必要です。

---

## 10. よくあるミスと対処法

### ミス1: COUNT(*) と COUNT(列名) を混同する

```sql
-- 「NULLを除いた件数」が欲しいのに COUNT(*) を使う
SELECT COUNT(*) FROM orders WHERE status = '完了';
-- NULLは既にWHEREで絞られているので問題ないが、意図を意識しよう

-- NULL を含む列の件数なら COUNT(列名) を使う
SELECT COUNT(amount) FROM orders;  -- amountがNULLの行は除外
```

### ミス2: AVG の分母を誤解する

```sql
-- 「全7件の平均」を期待しているが、NULLが除外されて6件の平均になる
SELECT AVG(amount) FROM orders;  -- 2800 (16800/6)

-- 全7件を分母にしたい場合
SELECT SUM(amount) / COUNT(*) FROM orders;  -- 2400 (16800/7)
-- ただしこれだと整数除算になる可能性があるので
SELECT SUM(COALESCE(amount, 0)) / COUNT(*) FROM orders;
```

### ミス3: 集計結果に NULL が返ってくる

```sql
-- 集計対象が0件の場合、SUM/AVGはNULLを返す（COUNTは0を返す）
SELECT SUM(amount) FROM orders WHERE customer_id = 999;
-- 結果: NULL（対象行が0件）

-- NULLを0として扱いたい場合
SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE customer_id = 999;
-- 結果: 0
```

### ミス4: WHERE に集計関数を書いてしまう

```sql
-- エラー
SELECT customer_id FROM orders WHERE COUNT(*) > 3;

-- 正しい（GROUP BY + HAVING を使う）
SELECT customer_id, COUNT(*) AS cnt FROM orders
GROUP BY customer_id
HAVING COUNT(*) > 3;
```

> **注意**  
> `SUM`・`COUNT` 等の集計関数は `SELECT` 句か `HAVING` 句でしか使えません。  
> `WHERE` 句に書くとエラーになります。

---

## 11. ポイント

- `AVG` を使う場合、NULLを除外した平均でよいか要件を確認しているか
- 集計結果が0件の場合に `SUM`・`AVG` が NULL を返すケースに `COALESCE` を適用しているか
- `COUNT(*)` と `COUNT(列名)` の使い分けが意図に合っているか
- 条件付き集計に `CASE` 式ではなく `FILTER` 句を使えないか（可読性向上）
- WHERE句で集計関数を使おうとしていないか（HAVING を使う）
- 金額集計でオーバーフローの可能性を考慮しているか（大量データ×高単価）

---

## 12. まとめ

| テーマ | 要点 |
|--------|------|
| 集計関数の基本 | 複数行を1つの値に集約する |
| COUNT(*) | NULL を含む全行数をカウント |
| COUNT(列名) | NULL を除いた行数をカウント |
| SUM | NULL を無視して合計を計算 |
| AVG | NULL を除外した平均を計算（分母に注意）|
| MAX / MIN | NULL を無視して最大値・最小値を返す |
| COUNT(DISTINCT) | 重複を排除した件数を取得 |
| NULL の影響 | 集計関数は NULL を無視する。意図を確認すること |
| WHERE と集計 | WHERE で行を絞り込んでから集計できる |
| WHERE には使えない | 集計結果への条件は HAVING を使う |
| FILTER 句 | 条件付き集計をシンプルに書ける（PostgreSQL）|

---

## 練習問題

以下のテーブルを使って解いてください。

```sql
CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  product     TEXT,
  amount      INTEGER NOT NULL,
  status      TEXT    NOT NULL,
  order_date  DATE    NOT NULL
);
DELETE FROM orders;
INSERT INTO orders (id, customer_id, product, amount, status, order_date) VALUES
  (1, 1, 'ノートPC',   98000, '完了',       '2024-01-05'),
  (2, 2, 'マウス',      3500, '完了',       '2024-01-10'),
  (3, 1, 'キーボード',  8000, 'キャンセル', '2024-01-12'),
  (4, 3, 'モニター',   42000, '完了',       '2024-02-01'),
  (5, 2, 'ノートPC',   98000, '完了',       '2024-02-05'),
  (6, 1, 'マウス',      3500, '完了',       '2024-02-20');
```

### 問題1: 顧客ごとの注文件数

> 参照：[1. 集計関数とは](#1-集計関数とは) ・ [2. COUNT(*) vs COUNT(列名)](#2-count-vs-count列名)

`customer_id` ごとの注文件数を、件数が多い順に取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT customer_id, COUNT(*) AS order_count
FROM orders
GROUP BY customer_id
ORDER BY order_count DESC;
```

**解説：** `GROUP BY customer_id` で顧客ごとにグループを作り、`COUNT(*)` で件数を数えます。`ORDER BY` では SELECT で付けたエイリアス名 `order_count` をそのまま使えます。

</details>

### 問題2: HAVING で絞り込み

> 参照：[3. SUM / AVG / MAX / MIN の基本](#3-sum-avg-max-min-の基本) ・ [4. NULL が集計に与える影響](#4-null-が集計に与える影響)

合計注文金額（`amount` の合計）が 100000 円以上の `customer_id` を取得してください。`status = 'キャンセル'` の注文は除外してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT customer_id, SUM(amount) AS total_amount
FROM orders
WHERE status <> 'キャンセル'
GROUP BY customer_id
HAVING SUM(amount) >= 100000;
```

**解説：** `WHERE` は集計前に行を絞り（キャンセル除外）、`HAVING` は集計後の結果を絞ります（合計10万円以上）。この実行順序を意識することが重要です：FROM → WHERE → GROUP BY → HAVING → SELECT。

</details>

### 問題3: 月別集計

> 参照：[2. COUNT(*) vs COUNT(列名)](#2-count-vs-count列名) ・ [4. NULL が集計に与える影響](#4-null-が集計に与える影響)

`order_date` の年月ごとに注文件数と合計金額を集計し、年月の昇順で表示してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT
  TO_CHAR(order_date, 'YYYY-MM') AS month,
  COUNT(*)                        AS order_count,
  SUM(amount)                     AS total_amount
FROM orders
GROUP BY TO_CHAR(order_date, 'YYYY-MM')
ORDER BY month ASC;
```

**解説：** `TO_CHAR(order_date, 'YYYY-MM')` で日付を年月文字列に変換してからグループ化します。`GROUP BY` にも同じ式を記述する必要があります（PostgreSQL では SELECT のエイリアスを GROUP BY に使えません）。

</details>
