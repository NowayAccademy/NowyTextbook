# GROUP BY と HAVING
GROUP BYでグループ集計し、HAVINGでグループに条件を絞り込みます

## 本章の目標

本章では以下を目標にして学習します。

- GROUP BY を使って、特定の列ごとにデータをグループ化できること
- SELECT に書ける列のルールを理解できること
- 複数列での GROUP BY ができること
- HAVING を使ってグループに条件を付けられること
- WHERE と HAVING の違い・実行順序を説明できること
- NULL がグループ化でどう扱われるかを理解できること
- 実務でよく使う月次集計・カテゴリ別集計ができること

---

## 1. GROUP BY とは

GROUP BY は、テーブルのデータを「ある列の値が同じもの同士」でひとまとめ（グループ化）する機能です。

### 身近な例で理解する

たとえばスーパーのレシートをイメージしてください。  
「野菜」「果物」「肉」というカテゴリごとに、それぞれの合計金額を出したい場合が GROUP BY の出番です。

もし GROUP BY がなければ、すべての商品を1つの合計に足すしかありません。  
GROUP BY を使うことで「カテゴリ別」「都道府県別」「月別」などの内訳を出せます。

以下のサンプルテーブルを本章全体で使います。

```sql
-- 商品注文テーブル
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER,
    category    TEXT,
    prefecture  TEXT,
    amount      INTEGER,
    order_date  DATE,
    status      TEXT
);

INSERT INTO orders (customer_id, category, prefecture, amount, order_date, status) VALUES
(101, '野菜', '東京',  1200, '2024-01-05', '完了'),
(102, '果物', '大阪',   800, '2024-01-10', '完了'),
(101, '肉類', '東京',  3500, '2024-01-15', '完了'),
(103, '野菜', '東京',   950, '2024-02-03', '完了'),
(102, '果物', '大阪',  2500, '2024-02-08', '完了'),
(104, '肉類', NULL,    5000, '2024-02-12', '完了'),
(101, '野菜', '東京',  1800, '2024-03-01', '完了'),
(105, '果物', '名古屋', 1100, '2024-03-15', 'キャンセル'),
(103, '肉類', '東京',  4200, '2024-03-20', '完了');
```

---

## 2. GROUP BY の基本構文

```sql
SELECT グループ化する列, 集計関数(...)
FROM テーブル名
GROUP BY グループ化する列;
```

### 例：カテゴリ別の合計金額

```sql
SELECT
    category,
    SUM(amount) AS total_amount
FROM orders
GROUP BY category;
```

実行結果のイメージ：

| category | total_amount |
|----------|-------------|
| 果物     | 4400        |
| 肉類     | 12700       |
| 野菜     | 3950        |

> **ポイント**  
> GROUP BY を使うと、テーブル全体が「category ごとのグループ」に分割され、  
> 各グループに対して集計関数（SUM, COUNT, AVG など）が適用されます。

---

## 3. GROUP BY と SELECT の関係

GROUP BY を使う場合、SELECT に書ける列には制限があります。

### ルール：SELECT に書ける列

1. GROUP BY に指定した列
2. 集計関数（SUM, COUNT, AVG, MAX, MIN など）を使った式

### NG 例：GROUP BY に指定していない列を SELECT に書く

```sql
-- これはエラーになる
SELECT
    category,
    customer_id,   -- ← GROUP BY に含まれていないためエラー
    SUM(amount)
FROM orders
GROUP BY category;
```

エラーメッセージ例：
```
ERROR: column "orders.customer_id" must appear in the GROUP BY clause
or be used in an aggregate function
```

### なぜエラーになるのか？

「野菜カテゴリ」には customer_id が 101, 103, 101 と複数あります。  
グループ化すると1行に圧縮されますが、どの customer_id を返せばよいか DB は判断できません。  
そのため、GROUP BY 対象外の列を SELECT に書くとエラーになります。

> **注意**  
> PostgreSQL は他の DB（MySQL など）より厳密です。  
> MySQL では GROUP BY 非対象列でもエラーにならないケースがありますが、  
> 意図しない値が返ってくる危険があるため、必ず GROUP BY に含めるか集計関数を使いましょう。

> **現場メモ**  
> MySQLからPostgreSQLに移行したプロジェクトで、MySQLでは動いていたSQLが大量にエラーになりました。原因のほとんどが「GROUP BY非対象列をSELECTしていた」問題でした。MySQLのデフォルト設定では曖昧なGROUP BYを許容していたため、移行して初めて問題が発覚した形です。実はMySQLでも `ONLY_FULL_GROUP_BY` モードを有効にすると同様にエラーになります。「MySQLで動いていたから正しい」は間違いで、意図しない代表値が返っていた可能性があります。PostgreSQLの厳しさはバグを防いでくれるので、エラーが出たときは修正の機会と捉えましょう。

---

## 4. 複数列の GROUP BY

複数の列を組み合わせてグループ化できます。

### 例：都道府県 × カテゴリ別の集計

```sql
SELECT
    prefecture,
    category,
    COUNT(*)        AS order_count,
    SUM(amount)     AS total_amount,
    AVG(amount)     AS avg_amount
FROM orders
GROUP BY prefecture, category
ORDER BY prefecture, category;
```

実行結果のイメージ：

| prefecture | category | order_count | total_amount | avg_amount |
|------------|----------|-------------|-------------|------------|
| NULL       | 肉類     | 1           | 5000        | 5000.00    |
| 大阪       | 果物     | 2           | 3300        | 1650.00    |
| 名古屋     | 果物     | 1           | 1100        | 1100.00    |
| 東京       | 肉類     | 2           | 7700        | 3850.00    |
| 東京       | 野菜     | 3           | 3950        | 1316.67    |

> **ポイント**  
> GROUP BY に複数列を指定すると、「列1の値 + 列2の値」の組み合わせが同じ行が  
> ひとまとめになります。組み合わせの数だけ結果行が返ります。

---

## 5. HAVING でグループに条件をつける

WHERE は個々の行に条件をつけますが、**HAVING はグループ化した後の結果に条件をつけます**。

### 構文

```sql
SELECT グループ化する列, 集計関数(...)
FROM テーブル名
GROUP BY グループ化する列
HAVING 集計関数に対する条件;
```

### 例：合計金額が 3000 円以上のカテゴリのみ表示

```sql
SELECT
    category,
    SUM(amount) AS total_amount
FROM orders
GROUP BY category
HAVING SUM(amount) >= 3000;
```

実行結果：

| category | total_amount |
|----------|-------------|
| 肉類     | 12700       |
| 果物     | 4400        |

> **ポイント**  
> HAVING には集計関数を使った条件を書きます。  
> 「グループの合計が〇〇以上」「グループの件数が〇件以上」という絞り込みに使います。

---

## 6. WHERE vs HAVING の違い（実行順序）

WHERE と HAVING は似ていますが、適用されるタイミングが異なります。

### SQL の実行順序

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
```

図で整理すると：

```
1. FROM orders          -- テーブル全体を読み込む
2. WHERE status = '完了' -- 個々の行を絞り込む（集計前）
3. GROUP BY category    -- グループ化する
4. HAVING SUM(...) >= X -- グループを絞り込む（集計後）
5. SELECT ...           -- 結果列を選ぶ
6. ORDER BY ...         -- 並び替える
```

### 実例：WHERE と HAVING を組み合わせる

```sql
-- キャンセルを除いた上で、合計が 3000 円以上のカテゴリを取得
SELECT
    category,
    COUNT(*)        AS order_count,
    SUM(amount)     AS total_amount
FROM orders
WHERE status = '完了'         -- まず行を絞り込む（集計前）
GROUP BY category
HAVING SUM(amount) >= 3000    -- グループを絞り込む（集計後）
ORDER BY total_amount DESC;
```

> **注意**  
> HAVING に集計関数以外の条件（例：`HAVING category = '野菜'`）を書くことは可能ですが、  
> そのような条件は WHERE に書く方が効率的です。  
> DB は WHERE を先に処理してから GROUP BY するため、不要な行を早めに除外できます。

> **現場メモ**  
> `HAVING category = '野菜'` のように、集計関数を使わない条件をHAVINGに書いているコードをレビューで時々見かけます。動きはしますが、パフォーマンス上は損です。WHEREで先に絞り込めば、GROUP BYが処理する行数が減ります。特に数百万行のテーブルではその差が顕著に出ます。HAVING は「集計関数に対する条件」だけに使う、という使い分けを意識してください。また、HAVING内で同じ集計式を何度も書く場合、CTEやサブクエリでまとめると可読性とパフォーマンスが改善することもあります。

### WHERE と HAVING を間違える例

```sql
-- NG：集計関数は WHERE に書けない
SELECT category, SUM(amount)
FROM orders
WHERE SUM(amount) >= 3000   -- エラー！集計関数は WHERE に使えない
GROUP BY category;

-- OK：HAVING を使う
SELECT category, SUM(amount)
FROM orders
GROUP BY category
HAVING SUM(amount) >= 3000;
```

---

## 7. NULL のグループ化

GROUP BY を使うとき、NULL 値はどう扱われるでしょうか？

### NULL は1つのグループになる

```sql
SELECT
    prefecture,
    COUNT(*)    AS order_count,
    SUM(amount) AS total_amount
FROM orders
GROUP BY prefecture;
```

実行結果：

| prefecture | order_count | total_amount |
|------------|-------------|-------------|
| NULL       | 1           | 5000        |
| 大阪       | 2           | 3300        |
| 名古屋     | 1           | 1100        |
| 東京       | 5           | 16650       |

NULL を持つ行はすべて「NULL グループ」として1つにまとめられます。

> **ポイント**  
> NULL は「値が不明」という意味ですが、GROUP BY では「NULL = NULL」として同じグループに  
> まとめます。これは通常の比較（NULL = NULL は FALSE）と異なる動作です。

### NULL グループを除外したい場合

```sql
SELECT
    prefecture,
    SUM(amount) AS total_amount
FROM orders
WHERE prefecture IS NOT NULL    -- WHERE で NULL を除外
GROUP BY prefecture;
```

---

## 8. GROUP BY + ORDER BY の組み合わせ

GROUP BY の結果は、デフォルトでは順序が保証されません。  
ORDER BY を使って明示的に並び替えましょう。

```sql
-- 合計金額の降順で並べる
SELECT
    category,
    SUM(amount)  AS total_amount,
    COUNT(*)     AS order_count
FROM orders
GROUP BY category
ORDER BY total_amount DESC;   -- 集計結果の列名（エイリアス）で並び替えも可
```

```sql
-- 列番号で ORDER BY する書き方（短く書けるが可読性が下がる）
SELECT
    category,
    SUM(amount) AS total_amount
FROM orders
GROUP BY category
ORDER BY 2 DESC;   -- SELECT の2番目の列で並び替え
```

> **ポイント**  
> ORDER BY には SELECT で定義したエイリアス（`total_amount` など）が使えます。  
> これは ORDER BY の評価が SELECT より後だからです。  
> 一方、WHERE と HAVING では SELECT エイリアスは使えません（評価順が先のため）。

---

## 9. 実務でよく使う集計パターン

### 月次集計

```sql
-- 月別の注文件数と合計金額
SELECT
    DATE_TRUNC('month', order_date) AS month,
    COUNT(*)                        AS order_count,
    SUM(amount)                     AS total_amount
FROM orders
WHERE status = '完了'
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

実行結果のイメージ：

| month      | order_count | total_amount |
|------------|-------------|-------------|
| 2024-01-01 | 3           | 5450        |
| 2024-02-01 | 3           | 8450        |
| 2024-03-01 | 2           | 6000        |

```sql
-- 年月を "2024-01" 形式の文字列で表示したい場合
SELECT
    TO_CHAR(order_date, 'YYYY-MM') AS year_month,
    COUNT(*)                       AS order_count,
    SUM(amount)                    AS total_amount
FROM orders
WHERE status = '完了'
GROUP BY TO_CHAR(order_date, 'YYYY-MM')
ORDER BY year_month;
```

### カテゴリ別集計（構成比も出す）

```sql
-- カテゴリ別の売上と全体に占める割合
SELECT
    category,
    SUM(amount)                                     AS total_amount,
    ROUND(
        SUM(amount) * 100.0 / SUM(SUM(amount)) OVER (),
        1
    )                                               AS ratio_pct
FROM orders
WHERE status = '完了'
GROUP BY category
ORDER BY total_amount DESC;
```

> **ポイント**  
> `SUM(SUM(amount)) OVER ()` はウィンドウ関数を組み合わせた書き方です。  
> 全カテゴリの合計金額をウィンドウ関数で求めることで、1つの SELECT で構成比まで計算できます。  
> ウィンドウ関数の詳細は別章で扱います。

### 上位 N グループを取得する

```sql
-- 売上上位3カテゴリを取得
SELECT
    category,
    SUM(amount) AS total_amount
FROM orders
GROUP BY category
ORDER BY total_amount DESC
LIMIT 3;
```

### 件数が X 以上のグループのみ取得（HAVING の実務活用）

```sql
-- 注文件数が2件以上の顧客を取得
SELECT
    customer_id,
    COUNT(*)    AS order_count,
    SUM(amount) AS total_amount
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 2
ORDER BY order_count DESC;
```

---

## 10. よくあるミスと対処法

### ミス1：SELECT に GROUP BY 対象外の列を入れる

```sql
-- NG：customer_id は GROUP BY に含まれていない
SELECT category, customer_id, SUM(amount)
FROM orders
GROUP BY category;
-- ERROR: column "orders.customer_id" must appear in the GROUP BY clause...
```

**対処法：** customer_id を GROUP BY に追加するか、集計関数（MAX, MIN など）で包む。

```sql
-- OK：GROUP BY に追加
SELECT category, customer_id, SUM(amount)
FROM orders
GROUP BY category, customer_id;

-- OK：集計関数で包む（例：最初の customer_id を代表値として取得）
SELECT category, MIN(customer_id) AS sample_customer_id, SUM(amount)
FROM orders
GROUP BY category;
```

### ミス2：HAVING に書くべき条件を WHERE に書く

```sql
-- NG：集計関数は WHERE に書けない
SELECT category, SUM(amount)
FROM orders
WHERE SUM(amount) > 1000
GROUP BY category;
-- ERROR: aggregate functions are not allowed in WHERE
```

**対処法：** HAVING に移す。

```sql
-- OK
SELECT category, SUM(amount)
FROM orders
GROUP BY category
HAVING SUM(amount) > 1000;
```

### ミス3：ORDER BY を GROUP BY より先に書く

```sql
-- NG：構文エラー
SELECT category, SUM(amount)
FROM orders
ORDER BY SUM(amount) DESC
GROUP BY category;
-- ERROR: syntax error at or near "GROUP"
```

**対処法：** GROUP BY → ORDER BY の順番を守る。

```sql
-- OK
SELECT category, SUM(amount) AS total_amount
FROM orders
GROUP BY category
ORDER BY total_amount DESC;
```

### ミス4：WHERE でエイリアスを使う

```sql
-- NG：WHERE は SELECT より先に評価されるため、エイリアスは使えない
SELECT category, SUM(amount) AS total_amount
FROM orders
WHERE total_amount > 1000   -- エラー！
GROUP BY category;
```

**対処法：** WHERE には元の列名や式を書く。集計後の絞り込みは HAVING を使う。

```sql
-- OK
SELECT category, SUM(amount) AS total_amount
FROM orders
GROUP BY category
HAVING SUM(amount) > 1000;
```

---

## 11. PRレビューのチェックポイント

- [ ] `SELECT` に `GROUP BY` 非対象の列を含めていないか
- [ ] `WHERE` に集計関数を使っていないか（`HAVING` に移す）
- [ ] `HAVING` に集計関数以外の条件を書いていないか（`WHERE` に移した方が効率的）
- [ ] `GROUP BY` の順序が `SELECT` → `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `ORDER BY` になっているか
- [ ] 月次集計などで `DATE_TRUNC` か `TO_CHAR` の選択が要件と合っているか（前者はTIMESTAMP型、後者はTEXT型を返す）
- [ ] NULL グループが結果に含まれることを考慮しているか（意図的に除外するなら `WHERE IS NOT NULL` を追加する）

---

## 12. まとめ

| テーマ | 要点 |
| --- | --- |
| GROUP BY の役割 | 指定列の値が同じ行をグループ化し、集計関数を適用する |
| SELECT できる列 | GROUP BY に指定した列、または集計関数を使った式のみ |
| 複数列の GROUP BY | カンマ区切りで複数列を指定。組み合わせが同じ行がまとまる |
| HAVING | グループ化・集計後に条件を絞り込む。集計関数が使える |
| 実行順序 | FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY |
| NULL のグループ化 | NULL は1つのグループとしてまとめられる |
| ORDER BY との組み合わせ | GROUP BY の後に ORDER BY を書く。エイリアスも使える |
| 月次集計 | DATE_TRUNC や TO_CHAR で日付をグループ化キーにする |
| よくあるミス | SELECT に非集計列を書く / HAVING に書くべき条件を WHERE に書く |
