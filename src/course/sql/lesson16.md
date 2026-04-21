# ウィンドウ関数
OVER句・ROW_NUMBER・RANK・LAG/LEAD・集計OVERでデータを分析します

## 本章の目標

本章では以下を目標にして学習します。

- ウィンドウ関数とGROUP BYの違いを説明できること
- PARTITION BY・ORDER BY in OVERを使って分析クエリを書けること
- ROW_NUMBER・RANK・DENSE_RANKで順位付けができること
- LAG・LEADで前後の行の値を参照できること
- SUM/AVG OVERで累計・移動平均を計算できること
- ROWSフレーム指定で集計範囲を細かく指定できること

---

## 1. ウィンドウ関数とは（GROUP BYとの違い）

### ウィンドウ関数の概念

**ウィンドウ関数**は、「**各行を残しながら**、その行の周辺（ウィンドウ）の情報を使って計算する」関数です。

GROUP BYとの最大の違いは**行数が減らない**ことです：
- `GROUP BY` → グループごとに1行に集約される（行が減る）
- `ウィンドウ関数` → すべての行が残り、各行に集計結果が付け加わる

```sql
-- テーブル準備
CREATE TABLE sales_data (
    id          INT PRIMARY KEY,
    staff_name  TEXT,
    department  TEXT,
    sale_amount INT,
    sale_date   DATE
);

INSERT INTO sales_data VALUES
    (1,  '田中', '東京', 50000, '2024-01-10'),
    (2,  '鈴木', '東京', 80000, '2024-01-15'),
    (3,  '佐藤', '大阪', 60000, '2024-01-20'),
    (4,  '伊藤', '大阪', 45000, '2024-01-25'),
    (5,  '田中', '東京', 70000, '2024-02-05'),
    (6,  '鈴木', '東京', 55000, '2024-02-10'),
    (7,  '佐藤', '大阪', 90000, '2024-02-15'),
    (8,  '伊藤', '大阪', 30000, '2024-02-20'),
    (9,  '田中', '東京', 40000, '2024-03-05'),
    (10, '鈴木', '東京', 95000, '2024-03-10');

-- GROUP BY: 部署ごとに集約（行が減る）
SELECT department, SUM(sale_amount) AS total
FROM sales_data
GROUP BY department;

-- ウィンドウ関数: 各行が残り、合計が付く（行が減らない）
SELECT
    staff_name,
    department,
    sale_amount,
    SUM(sale_amount) OVER (PARTITION BY department) AS dept_total
FROM sales_data;
```

> **ポイント**  
> ウィンドウ関数はSELECT句の中に `関数名() OVER (...)` の形で書きます。OVER句が「どの範囲（ウィンドウ）で計算するか」を指定します。

---

## 2. OVER句の基本（パーティションとオーダー）

### OVER句の構文

```sql
関数名() OVER (
    PARTITION BY 列名    -- グループ分け（省略可）
    ORDER BY 列名        -- ウィンドウ内の並び順（省略可）
    ROWS BETWEEN ...     -- フレーム範囲（省略可）
)
```

```sql
-- OVER()だけ（全行を対象）
SELECT
    staff_name,
    sale_amount,
    SUM(sale_amount) OVER () AS grand_total  -- 全行の合計
FROM sales_data;

-- PARTITION BY だけ（グループ内合計）
SELECT
    staff_name,
    department,
    sale_amount,
    SUM(sale_amount) OVER (PARTITION BY department) AS dept_total
FROM sales_data;

-- ORDER BY だけ（累計）
SELECT
    id,
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (ORDER BY sale_date) AS running_total
FROM sales_data;
```

---

## 3. PARTITION BY（グループ分け、GROUP BYとの違い）

### PARTITION BYの働き

`PARTITION BY` はウィンドウ関数のグループ分けを指定します。GROUP BYとは異なり、行数は減りません。

```sql
-- 各行の売上と、その部署の平均売上を並べて表示
SELECT
    staff_name,
    department,
    sale_amount,
    AVG(sale_amount) OVER (PARTITION BY department) AS dept_avg,
    sale_amount - AVG(sale_amount) OVER (PARTITION BY department) AS diff_from_avg
FROM sales_data
ORDER BY department, sale_amount DESC;
```

**結果イメージ**

| staff_name | department | sale_amount | dept_avg | diff_from_avg |
|------------|-----------|-------------|---------|----------------|
| 鈴木       | 東京      | 95000       | 66000   | +29000         |
| 鈴木       | 東京      | 80000       | 66000   | +14000         |
| 田中       | 東京      | 70000       | 66000   | +4000          |
| 田中       | 東京      | 50000       | 66000   | -16000         |
| 田中       | 東京      | 40000       | 66000   | -26000         |
| 鈴木       | 東京      | 55000       | 66000   | -11000         |

> **ポイント**  
> `PARTITION BY department` は「部署ごとに別々にウィンドウを作る」指定です。東京チームの中だけで計算、大阪チームの中だけで計算という具合に、グループを分けて計算します。

---

## 4. ORDER BY in OVER（ウィンドウ内の順序）

### ウィンドウ内で順序が重要な計算

```sql
-- 日付順で各スタッフの売上を並べたときの累計（スタッフ別）
SELECT
    staff_name,
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS running_total_per_staff
FROM sales_data
ORDER BY staff_name, sale_date;
```

> **ポイント**  
> OVER句内の `ORDER BY` はウィンドウ内での並び順を指定します。クエリ全体のORDER BYとは別物です。ウィンドウ内のORDER BYを省略すると、`SUM` や `AVG` などは全行を対象に計算されます。

---

## 5. ROW_NUMBER（一意な連番）

### ROW_NUMBERの使い方

`ROW_NUMBER()` は各行に重複なしの連番を振ります。同じ値でも別々の番号が付くのが特徴です。

```sql
-- 全行に連番
SELECT
    ROW_NUMBER() OVER (ORDER BY sale_amount DESC) AS row_num,
    staff_name,
    sale_amount
FROM sales_data;

-- 部署ごとに連番を振り直す
SELECT
    staff_name,
    department,
    sale_amount,
    ROW_NUMBER() OVER (
        PARTITION BY department
        ORDER BY sale_amount DESC
    ) AS rank_in_dept
FROM sales_data
ORDER BY department, rank_in_dept;
```

### ROW_NUMBERで上位N件を取得する

```sql
-- 部署ごとに売上上位2件を取得
WITH ranked AS (
    SELECT
        staff_name,
        department,
        sale_amount,
        ROW_NUMBER() OVER (
            PARTITION BY department
            ORDER BY sale_amount DESC
        ) AS rn
    FROM sales_data
)
SELECT staff_name, department, sale_amount
FROM ranked
WHERE rn <= 2
ORDER BY department, rn;
```

> **ポイント**  
> ウィンドウ関数はWHERE句で直接フィルタできません。サブクエリやCTEでウィンドウ関数を実行してから、外側のWHEREで絞り込みます。

> **現場メモ**  
> `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` + CTEで上位N件を取る、というパターンは実務で非常によく使います。「カテゴリごとに売上トップ3の商品を取り出す」「ユーザーごとに最新のログだけ取る」などの要件は、GROUP BY + サブクエリで書くと複雑になりますが、ROW_NUMBERを使うとシンプルに表現できます。筆者が初めてこのパターンを覚えたとき「こんな書き方があったのか」と感動しました。特に「各グループの最新レコードを1件だけ取る」（ROW_NUMBER = 1でフィルタ）は頻出パターンとして覚えておくと面接でも役立ちます。

---

## 6. RANK（同率順位あり、飛び番あり）

### RANKの特徴

`RANK()` は同じ値に同じ順位を付け、次の順位を飛ばします（1, 1, 3, 4 のように）。

```sql
SELECT
    staff_name,
    sale_amount,
    RANK() OVER (ORDER BY sale_amount DESC) AS rank
FROM sales_data
ORDER BY rank;
```

| staff_name | sale_amount | rank |
|------------|-------------|------|
| 鈴木       | 95000       | 1    |
| 佐藤       | 90000       | 2    |
| 鈴木       | 80000       | 3    |
| 田中       | 70000       | 4    |
| 佐藤       | 60000       | 5    |
| 鈴木       | 55000       | 6    |
| 田中       | 50000       | 7    |
| 伊藤       | 45000       | 8    |
| 田中       | 40000       | 9    |
| 伊藤       | 30000       | 10   |

> **ポイント**  
> `RANK()` は同値の場合に同じ順位を付け、次の順位番号を飛ばします。「1位が2人いたら、次は3位」というスポーツの順位付けと同じ挙動です。

---

## 7. DENSE_RANK（同率順位あり、飛び番なし）

### DENSE_RANKの特徴

`DENSE_RANK()` は同じ値に同じ順位を付けますが、飛び番を作りません（1, 1, 2, 3 のように）。

```sql
-- RANK と DENSE_RANK の違いを比較
SELECT
    staff_name,
    sale_amount,
    RANK()       OVER (ORDER BY sale_amount DESC) AS rank_num,
    DENSE_RANK() OVER (ORDER BY sale_amount DESC) AS dense_rank_num,
    ROW_NUMBER() OVER (ORDER BY sale_amount DESC) AS row_num
FROM sales_data
ORDER BY sale_amount DESC;
```

| 比較項目 | ROW_NUMBER | RANK | DENSE_RANK |
|----------|------------|------|------------|
| 同値の扱い | 別の番号 | 同じ番号（飛び番あり） | 同じ番号（飛び番なし） |
| 例（同値2件後） | 1, 2, 3 | 1, 1, 3 | 1, 1, 2 |
| 用途 | ページネーション・重複なし連番 | スポーツ順位 | カテゴリ分類・層別 |

> **ポイント**  
> どれを使うか迷ったら：重複なし連番 → `ROW_NUMBER`、同率があるスポーツ順位 → `RANK`、飛び番なしのグループ分け → `DENSE_RANK` と覚えましょう。

---

## 8. LAG（前の行の値を参照）

### LAGで前の行を見る

`LAG()` は現在の行から「N行前の値」を取得します。前月比較や前日比較によく使われます。

```sql
-- 各スタッフの売上と前回売上の比較
SELECT
    staff_name,
    sale_date,
    sale_amount,
    LAG(sale_amount, 1) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS prev_amount,
    sale_amount - LAG(sale_amount, 1) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS change_from_prev
FROM sales_data
ORDER BY staff_name, sale_date;
```

**結果（田中の例）**

| staff_name | sale_date  | sale_amount | prev_amount | change_from_prev |
|------------|------------|-------------|-------------|------------------|
| 田中       | 2024-01-10 | 50000       | NULL        | NULL             |
| 田中       | 2024-02-05 | 70000       | 50000       | +20000           |
| 田中       | 2024-03-05 | 40000       | 70000       | -30000           |

```sql
-- LAGの第3引数でNULLの代替値を指定できる
SELECT
    staff_name,
    sale_date,
    sale_amount,
    LAG(sale_amount, 1, 0) OVER (  -- 前行がない場合は0を返す
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS prev_amount
FROM sales_data;
```

> **ポイント**  
> `LAG(列名, N, デフォルト値)` の形で使います。Nを省略すると1行前（デフォルト1）。デフォルト値を省略するとNULLが返ります。

---

## 9. LEAD（次の行の値を参照）

### LEADで次の行を見る

`LEAD()` は `LAG()` の逆で、現在の行から「N行後の値」を取得します。

```sql
-- 次回の売上予定との比較
SELECT
    staff_name,
    sale_date,
    sale_amount,
    LEAD(sale_amount, 1) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS next_amount,
    LEAD(sale_date, 1) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
    ) AS next_sale_date
FROM sales_data
ORDER BY staff_name, sale_date;
```

> **ポイント**  
> `LAG` は過去を見る（前行）、`LEAD` は未来を見る（次行）です。株価チャートの「前日比」や「翌日予測との差」を計算するのによく使われます。

---

## 10. SUM OVER（累計・移動合計）

### 累計の計算

```sql
-- 日付順の売上累計
SELECT
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (
        ORDER BY sale_date
    ) AS cumulative_total
FROM sales_data
ORDER BY sale_date;

-- 部署別の売上累計
SELECT
    department,
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (
        PARTITION BY department
        ORDER BY sale_date
    ) AS dept_cumulative
FROM sales_data
ORDER BY department, sale_date;
```

### 移動合計（直近N件の合計）

```sql
-- 直近3件の売上合計（スタッフ別）
SELECT
    staff_name,
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (
        PARTITION BY staff_name
        ORDER BY sale_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW  -- 直近3行（2個前〜現在）
    ) AS rolling_3_sum
FROM sales_data
ORDER BY staff_name, sale_date;
```

> **ポイント**  
> `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` は「2行前から現在行まで」を意味します。移動合計や移動平均の計算に使います。

---

## 11. AVG OVER（移動平均）

### 移動平均の計算

```sql
-- 全期間の累計平均
SELECT
    sale_date,
    sale_amount,
    AVG(sale_amount) OVER (
        ORDER BY sale_date
    ) AS cumulative_avg
FROM sales_data
ORDER BY sale_date;

-- 直近3件の移動平均
SELECT
    staff_name,
    sale_date,
    sale_amount,
    ROUND(
        AVG(sale_amount) OVER (
            PARTITION BY staff_name
            ORDER BY sale_date
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        )
    ) AS moving_avg_3
FROM sales_data
ORDER BY staff_name, sale_date;

-- 部署別の売上構成比（%）
SELECT
    staff_name,
    department,
    sale_amount,
    ROUND(
        100.0 * sale_amount / SUM(sale_amount) OVER (PARTITION BY department),
        1
    ) AS pct_of_dept
FROM sales_data
ORDER BY department, pct_of_dept DESC;
```

> **ポイント**  
> `100.0 * sale_amount / SUM(sale_amount) OVER (PARTITION BY department)` で部署内の構成比（割合）を計算できます。GROUP BYを使わず、各行に割合が付くのがウィンドウ関数の強みです。

---

## 12. ROWS / RANGE フレーム指定

### フレームとは

フレームとは「ウィンドウ内でどの行まで計算対象にするか」を細かく指定する仕組みです。

```sql
-- フレーム指定の構文
OVER (
    PARTITION BY ...
    ORDER BY ...
    ROWS BETWEEN [開始位置] AND [終了位置]
    -- または
    RANGE BETWEEN [開始位置] AND [終了位置]
)
```

| フレーム位置 | 意味 |
|------------|------|
| `UNBOUNDED PRECEDING` | パーティションの先頭行 |
| `N PRECEDING` | 現在行のN行前 |
| `CURRENT ROW` | 現在の行 |
| `N FOLLOWING` | 現在行のN行後 |
| `UNBOUNDED FOLLOWING` | パーティションの最終行 |

```sql
-- 様々なフレーム指定の例
SELECT
    sale_date,
    sale_amount,

    -- 先頭から現在行までの累計
    SUM(sale_amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_sum,

    -- 前1行・現在行・後1行の合計（中心移動合計）
    SUM(sale_amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS centered_sum,

    -- パーティション全体の合計
    SUM(sale_amount) OVER (
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS total_sum

FROM sales_data
ORDER BY sale_date;
```

### ROWS vs RANGE

```sql
-- ROWS: 物理的な行数でフレームを決める
-- RANGE: ORDER BY列の値の範囲でフレームを決める（同値は同じフレームに入る）

-- 同日の売上が複数ある場合の違い
SELECT
    sale_date,
    sale_amount,
    SUM(sale_amount) OVER (ORDER BY sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rows_sum,
    SUM(sale_amount) OVER (ORDER BY sale_date RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS range_sum
FROM sales_data
ORDER BY sale_date;
-- 同じ日付が複数あると、RANGEはその日付の全行を同じフレームとして扱う
```

> **ポイント**  
> 日時が重複しないデータなら `ROWS` と `RANGE` の結果は同じです。重複がある場合は `ROWS` の方が挙動が予測しやすいです。通常は `ROWS` を使いましょう。

---

## 13. よくあるミス

### ミス1: WHERE句でウィンドウ関数の結果を直接フィルタしようとする

```sql
-- 悪い例: WHERE句でウィンドウ関数を使うとエラー
-- SELECT staff_name, ROW_NUMBER() OVER (ORDER BY sale_amount DESC) AS rn
-- FROM sales_data
-- WHERE rn <= 3;  -- エラー! WHEREの時点ではウィンドウ関数未計算

-- 正しい例: CTEかサブクエリを使う
WITH ranked AS (
    SELECT
        staff_name,
        sale_amount,
        ROW_NUMBER() OVER (ORDER BY sale_amount DESC) AS rn
    FROM sales_data
)
SELECT staff_name, sale_amount
FROM ranked
WHERE rn <= 3;
```

### ミス2: PARTITION BY なしで全体に適用される

```sql
-- 意図: 部署ごとの連番
-- 間違い: PARTITION BY を忘れると全体で1つの連番になる
SELECT
    staff_name,
    department,
    -- 間違い（全体で連番）
    ROW_NUMBER() OVER (ORDER BY sale_amount DESC) AS wrong_rn,
    -- 正しい（部署ごとに連番）
    ROW_NUMBER() OVER (PARTITION BY department ORDER BY sale_amount DESC) AS correct_rn
FROM sales_data;
```

### ミス3: ORDER BY の向きを間違える

```sql
-- 累計の計算: ORDER BYの順序によって結果が変わる
SELECT
    sale_date,
    sale_amount,
    -- 日付昇順の累計（正しい：古い順に積み上げ）
    SUM(sale_amount) OVER (ORDER BY sale_date ASC) AS asc_cumulative,
    -- 日付降順の累計（新しい順に積み上げ）
    SUM(sale_amount) OVER (ORDER BY sale_date DESC) AS desc_cumulative
FROM sales_data
ORDER BY sale_date;
```

### ミス4: GROUP BY と ウィンドウ関数を同時に使うときの注意

```sql
-- GROUP BY で集約した後にウィンドウ関数を使う場合
-- ウィンドウ関数はGROUP BY後の結果に対して動作する
SELECT
    department,
    SUM(sale_amount) AS dept_total,
    -- 全部署合計に対する割合（GROUP BY後の行に対してウィンドウ関数が動く）
    ROUND(
        100.0 * SUM(sale_amount) / SUM(SUM(sale_amount)) OVER (),
        1
    ) AS pct_of_all
FROM sales_data
GROUP BY department;
```

> **注意**  
> `SUM(SUM(sale_amount)) OVER ()` のように集計関数をネストして書くのは特殊な構文ですが、GROUP BY後の結果に対してウィンドウ関数を適用する有効な書き方です。

---

## 14. ポイント

- **ROW_NUMBER / RANK の使い分けが要件と合っているか**
  - 同率を同じ順位にしたいなら RANK / DENSE_RANK。一意な連番が必要なら ROW_NUMBER
- **ウィンドウ関数の結果を WHERE 句で直接フィルタしようとしていないか**
  - ウィンドウ関数は WHERE で使えない → CTE かサブクエリで囲んでから外側で絞る
- **PARTITION BY の有無が要件（グループ内 vs 全体）と一致しているか**
  - PARTITION BY なしは全行が1つのウィンドウ。意図して使っているかを確認
- **LAG / LEAD で前後の行を参照するとき、ORDER BY が正しい列・方向になっているか**
  - ORDER BY の列や DESC/ASC を間違えると前後関係が逆になる
- **累計・移動平均で ROWS フレーム指定が適切か**
  - `UNBOUNDED PRECEDING` と `CURRENT ROW` の組み合わせが意図通りか確認

---

## 15. まとめ

| テーマ | 要点 |
| --- | --- |
| ウィンドウ関数とは | 行数を減らさず、各行に集計結果を付けて返す関数 |
| GROUP BYとの違い | GROUP BYは行を集約（減る）、ウィンドウ関数は行が残る |
| OVER句 | ウィンドウ（計算範囲）を指定する。PARTITION BY / ORDER BY / フレームを指定 |
| PARTITION BY | グループ分け（GROUP BYと似ているが行は減らない）|
| ROW_NUMBER | 重複なしの連番。同値でも別の番号 |
| RANK | 同値に同じ順位、飛び番あり（1,1,3）|
| DENSE_RANK | 同値に同じ順位、飛び番なし（1,1,2）|
| LAG / LEAD | 前/後の行の値を参照。前月比・翌日比に使う |
| SUM OVER | 累計・移動合計。ORDER BYとフレームで範囲を制御 |
| AVG OVER | 移動平均・累計平均。グラフの平滑化に使う |
| ROWSフレーム | `ROWS BETWEEN N PRECEDING AND M FOLLOWING` で範囲指定 |
| よくあるミス | WHERE句での直接フィルタ不可・PARTITION BY忘れ |

---

## 練習問題

以下のテーブルを使って解いてください。

```sql
CREATE TABLE IF NOT EXISTS sales_data (
  id          INTEGER PRIMARY KEY,
  staff_name  TEXT    NOT NULL,
  department  TEXT    NOT NULL,
  sale_amount INTEGER NOT NULL,
  sale_date   DATE    NOT NULL
);
DELETE FROM sales_data;
INSERT INTO sales_data (id, staff_name, department, sale_amount, sale_date) VALUES
  (1, '田中', '営業1課',  85000, '2024-01-10'),
  (2, '鈴木', '営業1課', 120000, '2024-01-15'),
  (3, '佐藤', '営業2課',  95000, '2024-01-20'),
  (4, '田中', '営業1課',  60000, '2024-02-01'),
  (5, '鈴木', '営業1課',  40000, '2024-02-10'),
  (6, '山田', '営業2課', 110000, '2024-02-15'),
  (7, '佐藤', '営業2課',  75000, '2024-02-20');
```

### 問題1: 部署別合計と全体合計を同時に取得

> 参照：[3. PARTITION BY](#3-partition-byグループ分けgroup-byとの違い) ・ [10. SUM OVER](#10-sum-over累計・移動合計)

各行に「自分の部署の合計売上」と「全体の合計売上」を並べて表示してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT
  staff_name,
  department,
  sale_amount,
  SUM(sale_amount) OVER (PARTITION BY department) AS dept_total,
  SUM(sale_amount) OVER ()                         AS grand_total
FROM sales_data;
```

**解説：** `PARTITION BY department` で部署ごとの合計、`OVER ()` でウィンドウ全体の合計を計算します。GROUP BY と異なり元の行数を保ちながら集計値を付け加えられます。個々のレコードの部署内シェア（`sale_amount / dept_total`）などの計算に便利です。

</details>

### 問題2: 3件移動平均

> 参照：[12. ROWS / RANGE フレーム指定](#12-rows-range-フレーム指定)

`sale_date` 順で、直前2件と現在行の3件移動平均を計算してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT
  sale_date,
  staff_name,
  sale_amount,
  AVG(sale_amount) OVER (
    ORDER BY sale_date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) AS moving_avg_3
FROM sales_data
ORDER BY sale_date;
```

**解説：** `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` は「現在行を含む直前2行」のフレームを指定します。先頭付近は対象行数が少ないため、1行目は1件平均、2行目は2件平均になります。データの平滑化（グラフのノイズ除去）に使われるパターンです。

</details>

### 問題3: 部署内トップの売上のみ抽出

> 参照：[5. ROW_NUMBER](#5-rownumber一意な連番) ・ [2. OVER句の基本](#2-over句の基本パーティションとオーダー)

各部署で `sale_amount` が最も高い行だけを取得してください（ウィンドウ関数と CTE を組み合わせて）。

<details>
<summary>回答を見る</summary>

```sql
WITH ranked AS (
  SELECT
    staff_name,
    department,
    sale_amount,
    ROW_NUMBER() OVER (
      PARTITION BY department
      ORDER BY sale_amount DESC
    ) AS rn
  FROM sales_data
)
SELECT staff_name, department, sale_amount
FROM ranked
WHERE rn = 1;
```

**解説：** ウィンドウ関数は WHERE 句に直接使えないため、CTE または サブクエリで先に順位を付けてから外側で絞ります。`ROW_NUMBER()` を使うと同額でも1行だけ選べます（`RANK()` だと同額が複数返ります）。これは「グループ内の最新1件を取る」などの現場頻出パターンです。

</details>
