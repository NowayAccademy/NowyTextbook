# 関数と型変換
文字列・数値・日付時刻の組み込み関数とCAST型変換を使いこなします

## 本章の目標

本章では以下を目標にして学習します。

- 文字列・数値・日付の組み込み関数を使ってデータを加工できること
- CAST を使って異なるデータ型に変換できること
- TO_CHAR / TO_DATE / TO_TIMESTAMP で文字列とデータ型を相互変換できること
- WHERE 句で関数を使うとインデックスが効かなくなる理由を理解していること

---

## 1. 文字列関数

文字列を操作するための組み込み関数です。  
以下の `employees` テーブルを例に使います。

| id | first_name | last_name | email | notes |
|----|------------|-----------|-------|-------|
| 1 | 太郎 | 田中 | Tanaka@Example.COM | 　　 東京在住 　　 |
| 2 | 花子 | 鈴木 | SUZUKI@gmail.com | 大阪在住 |
| 3 | 次郎 | 佐藤 | sato@example.com | NULL |

### CONCAT / `||` — 文字列を連結する

```sql
-- CONCAT 関数（引数は何個でも可）
SELECT CONCAT(last_name, ' ', first_name) AS full_name FROM employees;

-- || 演算子（PostgreSQL推奨）
SELECT last_name || ' ' || first_name AS full_name FROM employees;
```

> **注意**  
> `||` は NULL が含まれると結果が NULL になります。  
> `CONCAT()` は NULL を空文字として扱います。挙動が異なるので注意してください。

```sql
-- || のNULL問題
SELECT 'hello' || NULL;       -- NULL（NULLが伝播する）
SELECT CONCAT('hello', NULL); -- 'hello'（NULLは無視される）
```

### LENGTH — 文字列の長さを返す

```sql
-- 文字数を取得
SELECT name, LENGTH(name) AS name_length FROM employees;

-- 「田中 太郎」なら 6（スペース含む）
-- PostgreSQLのLENGTHはバイト数ではなく文字数
```

### UPPER / LOWER — 大文字・小文字に変換

```sql
-- メールアドレスを小文字に統一して検索
SELECT id, LOWER(email) AS email FROM employees;

-- UPPER で大文字に変換
SELECT id, UPPER(first_name) AS first_name FROM employees;
```

### TRIM / LTRIM / RTRIM — 空白を除去する

```sql
-- 両端の空白を除去（TRIM）
SELECT TRIM(notes) AS notes FROM employees;

-- 左端の空白のみ除去（LTRIM）
SELECT LTRIM(notes) AS notes FROM employees;

-- 右端の空白のみ除去（RTRIM）
SELECT RTRIM(notes) AS notes FROM employees;

-- 特定の文字を除去（BTRIMで両端から指定文字を除去）
SELECT BTRIM('###hello###', '#') AS result;  -- 'hello'
```

### SUBSTRING — 文字列の一部を取り出す

```sql
-- SUBSTRING(文字列, 開始位置, 取り出す文字数)
-- 開始位置は1始まり

SELECT SUBSTRING('田中太郎', 3, 2) AS result;  -- '太郎'

-- メールアドレスの@より前の部分を取り出す（POSITION と組み合わせ）
SELECT SUBSTRING(email, 1, POSITION('@' IN email) - 1) AS username
FROM employees;
```

### POSITION — 部分文字列の位置を返す

```sql
-- '@' が何文字目にあるかを返す（見つからない場合は0）
SELECT POSITION('@' IN 'tanaka@example.com');  -- 7

-- 文字列内に特定の文字が含まれるか確認
SELECT email FROM employees
WHERE POSITION('@' IN email) > 0;
```

### REPLACE — 文字列を置換する

```sql
-- 電話番号のハイフンを除去
SELECT REPLACE('090-1234-5678', '-', '') AS phone;  -- '09012345678'

-- メールドメインを置換
SELECT REPLACE(email, '@example.com', '@newdomain.com') AS new_email
FROM employees;
```

### LPAD / RPAD — 文字列を左右に埋める

```sql
-- 商品コードを5桁にゼロ埋め
SELECT LPAD('123', 5, '0') AS code;   -- '00123'
SELECT RPAD('ABC', 5, '-') AS code;   -- 'ABC--'
```

> **ポイント**  
> LPAD は「数値IDを固定長の文字列に揃える」用途でよく使います。  
> `LPAD(id::TEXT, 8, '0')` で8桁のゼロ埋め文字列が作れます。

---

## 2. 数値関数

### ROUND — 四捨五入

```sql
-- 小数点以下を四捨五入
SELECT ROUND(3.14159, 2);   -- 3.14
SELECT ROUND(3.14159, 0);   -- 3.0
SELECT ROUND(2.5);           -- 3

-- 消費税込み価格を小数点以下で四捨五入
SELECT name, ROUND(price * 1.10, 0) AS price_with_tax FROM products;
```

### CEIL / CEILING — 切り上げ

```sql
SELECT CEIL(3.1);    -- 4
SELECT CEIL(3.9);    -- 4
SELECT CEIL(-3.1);   -- -3（負の数は注意）
```

### FLOOR — 切り捨て

```sql
SELECT FLOOR(3.9);   -- 3
SELECT FLOOR(3.1);   -- 3
SELECT FLOOR(-3.1);  -- -4（負の数は注意）
```

### ABS — 絶対値

```sql
SELECT ABS(-150);   -- 150
SELECT ABS(150);    -- 150

-- 予算との差額（絶対値で表示）
SELECT name, ABS(budget - actual) AS diff FROM projects;
```

### MOD — 余り

```sql
SELECT MOD(10, 3);  -- 1
SELECT MOD(15, 5);  -- 0

-- 偶数・奇数の判定
SELECT id, name
FROM products
WHERE MOD(id, 2) = 0;  -- IDが偶数の商品
```

### POWER — べき乗

```sql
SELECT POWER(2, 10);  -- 1024.0
SELECT POWER(3, 3);   -- 27.0
```

### SQRT — 平方根

```sql
SELECT SQRT(16);   -- 4.0
SELECT SQRT(2);    -- 1.4142135623730951
```

> **ポイント**  
> 金額計算では ROUND を必ず使いましょう。浮動小数点数の丸め誤差により  
> 計算結果が `0.9999999...` のような値になることがあります。  
> 金額を扱う場合は `NUMERIC` 型を使うと誤差が発生しません。

---

## 3. 日付・時刻関数

日付と時刻は業務システムで非常によく使います。

### 現在の日付・時刻を取得する

```sql
-- 現在の日付（時刻なし）
SELECT CURRENT_DATE;               -- 例: 2024-03-15

-- 現在の日時（タイムゾーンあり）
SELECT CURRENT_TIMESTAMP;          -- 例: 2024-03-15 10:30:00+09:00
SELECT NOW();                      -- CURRENT_TIMESTAMP と同じ

-- 現在の日時（タイムゾーンなし）
SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC';
```

### DATE_TRUNC — 日付を丸める

```sql
-- 時刻部分を切り捨てて「日」まで丸める
SELECT DATE_TRUNC('day', NOW());       -- 2024-03-15 00:00:00

-- 「月」まで丸める（月初にする）
SELECT DATE_TRUNC('month', NOW());     -- 2024-03-01 00:00:00

-- 「年」まで丸める
SELECT DATE_TRUNC('year', NOW());      -- 2024-01-01 00:00:00

-- 月次集計でよく使うパターン
SELECT
    DATE_TRUNC('month', order_date) AS month,
    SUM(amount) AS monthly_total
FROM orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month;
```

### DATE_PART / EXTRACT — 日付の一部を取り出す

```sql
-- 年・月・日・時・分・秒を取り出す
SELECT DATE_PART('year',  NOW());   -- 2024
SELECT DATE_PART('month', NOW());   -- 3
SELECT DATE_PART('day',   NOW());   -- 15
SELECT DATE_PART('hour',  NOW());   -- 10

-- EXTRACT（DATE_PART と同等）
SELECT EXTRACT(YEAR  FROM NOW());   -- 2024
SELECT EXTRACT(MONTH FROM NOW());   -- 3
SELECT EXTRACT(DOW   FROM NOW());   -- 曜日（0=日曜, 6=土曜）

-- 月別の集計（月の数値でGROUP BY）
SELECT
    DATE_PART('month', order_date) AS month,
    COUNT(*) AS order_count
FROM orders
GROUP BY DATE_PART('month', order_date)
ORDER BY month;
```

### AGE — 年齢・期間を計算する

```sql
-- 現在の日付から誕生日を引いて年齢を計算
SELECT AGE(NOW(), birthdate) AS age FROM employees;
-- 結果例: 28 years 3 mons 10 days

-- 整数の年齢のみ取り出す
SELECT DATE_PART('year', AGE(NOW(), birthdate)) AS age_years
FROM employees;
```

### interval 演算 — 日付の加算・減算

```sql
-- 今日から30日後
SELECT CURRENT_DATE + INTERVAL '30 days';

-- 3ヶ月前
SELECT NOW() - INTERVAL '3 months';

-- 1年後
SELECT CURRENT_DATE + INTERVAL '1 year';

-- 注文日から7日以内のものを取得
SELECT * FROM orders
WHERE order_date >= NOW() - INTERVAL '7 days';
```

> **ポイント**  
> INTERVAL の書き方は柔軟です。  
> `'30 days'`・`'30d'`・`'1 month 15 days'` などが使えます。

> **現場メモ**  
> 日付のINTERVAL計算はタイムゾーンの扱いでハマることがあります。`NOW() - INTERVAL '1 day'` は「現在のタイムゾーンで24時間前」を返しますが、サーバーのタイムゾーン設定と日本時間がずれていると予期しない結果になります。特に「今日のデータを取得する」という処理で `CURRENT_DATE` を使うと、UTCで動いているサーバーでは日本時間の0時〜9時のデータが「昨日」扱いになります。本番サーバーのタイムゾーン設定は必ず確認し、`AT TIME ZONE 'Asia/Tokyo'` を明示するか、アプリ側でUTCに変換してからSQLに渡す方針を統一しておくことが重要です。

---

## 4. CAST の構文（型変換）

`CAST` はデータ型を変換する関数です。

### 構文

```sql
-- CAST 関数
CAST(値 AS 型名)

-- :: 演算子（PostgreSQL独自の短縮形）
値::型名
```

### よく使う型変換

```sql
-- 文字列 → 整数
SELECT CAST('123' AS INTEGER);
SELECT '123'::INTEGER;

-- 整数 → 文字列
SELECT CAST(123 AS TEXT);
SELECT 123::TEXT;

-- 文字列 → 日付
SELECT CAST('2024-03-15' AS DATE);
SELECT '2024-03-15'::DATE;

-- 文字列 → 数値（小数）
SELECT CAST('3.14' AS NUMERIC);
SELECT '3.14'::NUMERIC;
```

### CAST の実用例

```sql
-- IDを文字列として連結
SELECT 'user_' || id::TEXT AS user_key FROM users;

-- 文字列として保存された数値で計算
SELECT CAST(price_text AS NUMERIC) * quantity AS total
FROM order_items;

-- 日付として比較
WHERE created_at::DATE = '2024-03-15'
```

> **注意**  
> 変換できない値を CAST するとエラーになります。  
> 例：`CAST('abc' AS INTEGER)` はエラー  
> エラーを避けたい場合は `TRY_CAST`（SQL Server）や `CASE + REGEXP_LIKE` を使います。  
> PostgreSQL では `REGEXP_LIKE` で数値かどうかを確認してから変換するか、  
> `TO_NUMBER` 系の関数を活用しましょう。

---

## 5. TO_CHAR（数値・日付を文字列にフォーマット）

`TO_CHAR` は数値や日付を指定したフォーマットの文字列に変換します。

### 日付のフォーマット

```sql
-- 日付を「YYYY年MM月DD日」形式に変換
SELECT TO_CHAR(NOW(), 'YYYY年MM月DD日');  -- '2024年03月15日'

-- 時刻を含む形式
SELECT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS');  -- '2024-03-15 10:30:00'

-- 曜日を含める
SELECT TO_CHAR(NOW(), 'YYYY-MM-DD (Day)');  -- '2024-03-15 (Friday)'

-- 月を英語で表示
SELECT TO_CHAR(NOW(), 'DD Mon YYYY');  -- '15 Mar 2024'
```

### よく使うフォーマット記号

| 記号 | 意味 | 例 |
|------|------|-----|
| `YYYY` | 4桁年 | 2024 |
| `MM` | 2桁月 | 03 |
| `DD` | 2桁日 | 15 |
| `HH24` | 24時間形式の時 | 10 |
| `MI` | 分 | 30 |
| `SS` | 秒 | 00 |
| `Day` | 曜日（英語）| Friday |

### 数値のフォーマット

```sql
-- カンマ区切りの数値
SELECT TO_CHAR(1234567, '9,999,999');  -- '1,234,567'

-- 小数点以下2桁
SELECT TO_CHAR(3.14159, 'FM999.99');   -- '3.14'

-- ゼロ埋め
SELECT TO_CHAR(42, '0000');            -- '0042'
```

---

## 6. TO_DATE / TO_TIMESTAMP（文字列を日付に変換）

文字列を日付型に変換します。

```sql
-- 文字列を DATE 型に変換
SELECT TO_DATE('2024年03月15日', 'YYYY年MM月DD日');
-- 結果: 2024-03-15

SELECT TO_DATE('15/03/2024', 'DD/MM/YYYY');
-- 結果: 2024-03-15

-- 文字列を TIMESTAMP 型に変換
SELECT TO_TIMESTAMP('2024-03-15 10:30:00', 'YYYY-MM-DD HH24:MI:SS');
-- 結果: 2024-03-15 10:30:00

-- 日本語形式の日付文字列を変換
SELECT TO_DATE('20240315', 'YYYYMMDD');
-- 結果: 2024-03-15
```

> **ポイント**  
> CSVや外部システムから取り込んだ日付文字列は形式が様々です。  
> `TO_DATE` を使えばどんな形式の文字列でも日付型に変換できます。

---

## 7. 関数の注意点（WHERE 句でのインデックス問題）

WHERE 句で列に関数を適用すると、その列のインデックスが効かなくなります。

```sql
-- インデックスが効かない（列に関数を適用している）
SELECT * FROM employees
WHERE LOWER(email) = 'tanaka@example.com';

-- インデックスが効かない（列を加工している）
SELECT * FROM orders
WHERE DATE_TRUNC('month', order_date) = '2024-03-01';

-- インデックスが効かない（型変換）
WHERE created_at::DATE = '2024-03-15';
```

### 対処法1: 比較する値の方を変換する

```sql
-- 列はそのまま、比較する値の方を変換する
-- 前提：email 列には小文字で保存されている
SELECT * FROM employees
WHERE email = LOWER('TANAKA@EXAMPLE.COM');

-- order_date に対して範囲指定にする
SELECT * FROM orders
WHERE order_date >= '2024-03-01'
  AND order_date < '2024-04-01';
```

### 対処法2: 関数インデックスを作成する

```sql
-- LOWER(email) に対してインデックスを作成する
CREATE INDEX idx_employees_email_lower ON employees(LOWER(email));

-- これで以下のクエリでインデックスが効くようになる
SELECT * FROM employees WHERE LOWER(email) = 'tanaka@example.com';
```

> **注意**  
> WHERE 句の列に関数を使うとインデックスが効かず、テーブルスキャンが発生します。  
> データ量が増えると大幅にパフォーマンスが低下します。  
> 頻繁に検索する条件では、列を加工せずに済む設計か関数インデックスを検討しましょう。

> **現場メモ**  
> ユーザー検索機能でメールアドレスの大文字小文字を無視したいという要件があり、`WHERE LOWER(email) = LOWER($1)` と書かれたコードがPRに上がってきました。テスト環境では動いていましたが、本番は100万ユーザーいたためリリース後すぐにスロークエリアラートが飛びました。`email` 列にインデックスがあったにも関わらず `LOWER()` で囲んだことで使われていませんでした。対処法は2つあります。「メールアドレスはINSERT時に必ず小文字化する」か「`CREATE INDEX idx_lower_email ON users(LOWER(email))` で関数インデックスを作る」かのどちらか。私のチームではメールは保存時に小文字化する規約にして対処しました。

---

## 8. よくあるミスと対処法

### ミス1: 整数を期待しているのに浮動小数点が返る

```sql
-- ROUND の結果は NUMERIC 型
SELECT ROUND(3.14, 0);   -- 3.0 （整数に見えるが小数型）

-- 整数に変換したい場合
SELECT ROUND(3.14, 0)::INTEGER;  -- 3
```

### ミス2: 文字列連結で NULL が混入する

```sql
-- first_name が NULL の場合、結果全体が NULL になる
SELECT last_name || ' ' || first_name AS full_name FROM employees;

-- COALESCE で NULL を空文字に変換する
SELECT last_name || ' ' || COALESCE(first_name, '') AS full_name FROM employees;

-- または CONCAT を使う（NULL を無視する）
SELECT CONCAT(last_name, ' ', first_name) AS full_name FROM employees;
```

### ミス3: 日付の月末を BETWEEN で指定する

```sql
-- TIMESTAMP 型に対してこう書くと 2024-01-31 の23:59:59が漏れる
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';

-- 正しい書き方
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-02-01';
```

### ミス4: DATE_PART の結果を文字列と比較する

```sql
-- DATE_PART は数値を返すため文字列と比較するとエラーか意図しない動作
SELECT * FROM orders WHERE DATE_PART('month', order_date) = '3';  -- 型変換が発生

-- 数値と比較する
SELECT * FROM orders WHERE DATE_PART('month', order_date) = 3;
```

> **注意**  
> 日付関数や文字列関数の戻り値の型に注意しましょう。  
> `DATE_PART` は `DOUBLE PRECISION`、`TO_CHAR` は `TEXT` を返します。

---

## 9. PRレビューのチェックポイント

- [ ] `WHERE` 句の列に関数を適用していないか（インデックスが効かなくなる）
- [ ] 大文字小文字を無視した検索に `LOWER()` を使う場合、関数インデックスの対応があるか
- [ ] 日付の `BETWEEN` で TIMESTAMP型の月末・日末が漏れていないか
- [ ] タイムゾーンを意識した日付計算になっているか（`AT TIME ZONE` の明示）
- [ ] 金額計算に `NUMERIC` 型を使っているか（`FLOAT` や `REAL` は丸め誤差が発生する）
- [ ] `CAST` で変換できない値が来た場合のエラーハンドリングを考慮しているか

---

## 10. まとめ

| テーマ | 要点 |
|--------|------|
| 文字列連結 | `\|\|` はNULL伝播あり、`CONCAT` はNULL無視 |
| TRIM | 空白を除去。LTRIM（左端）、RTRIM（右端）も使える |
| SUBSTRING | 開始位置と文字数で部分文字列を取り出す（1始まり）|
| ROUND / CEIL / FLOOR | 丸め処理。金額には NUMERIC 型と ROUND を使う |
| CURRENT_DATE / NOW() | 現在の日付・日時を取得する |
| DATE_TRUNC | 日付を月初・年初などに丸める。月次集計に便利 |
| DATE_PART / EXTRACT | 年・月・日などの数値を取り出す |
| INTERVAL | 日付の加算・減算。`INTERVAL '7 days'` など |
| CAST / `::` | 型変換。`123::TEXT`・`'2024-01-01'::DATE` |
| TO_CHAR | 日付・数値を指定フォーマットの文字列に変換 |
| TO_DATE | 文字列を日付型に変換 |
| WHERE 句と関数 | 列に関数を適用するとインデックスが効かなくなる |
