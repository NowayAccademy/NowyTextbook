# NULL と CASE式
NULLの性質・IS NULL・COALESCE・NULLIF・CASE式を使いこなします

## 本章の目標

本章では以下を目標にして学習します。

- NULL が「値がない」という特殊な状態であることを理解できること
- IS NULL / IS NOT NULL を使って NULL を正しく扱えること
- COALESCE と NULLIF を使って NULL を別の値に置き換えられること
- CASE 式を使って条件分岐のある値を返せること
- CASE を集計関数と組み合わせた条件付き集計ができること

---

## 1. NULL とは何か

NULL は「値が存在しない」ことを表す特殊な状態です。  
0でも空文字でもなく、「データが入っていない」「わからない」「該当しない」を意味します。

### NULL の3つの意味

| 意味 | 例 |
|------|-----|
| 値なし | まだ入力されていない電話番号 |
| 不明（Unknown） | 年齢が不明なユーザー |
| 適用外（Not Applicable） | 独身者の配偶者名 |

データベースを設計するとき、NULL を「値が未入力」の意味にするか  
「そもそも存在しない」の意味にするかを明確にしておくことが重要です。

以下の `employees` テーブルを例に使います。

| id | name | age | email | manager_id | bonus |
|----|------|-----|-------|------------|-------|
| 1 | 田中太郎 | 28 | tanaka@example.com | 3 | 50000 |
| 2 | 鈴木花子 | NULL | suzuki@example.com | 3 | NULL |
| 3 | 佐藤次郎 | 45 | NULL | NULL | 100000 |
| 4 | 高橋美咲 | 32 | takahashi@example.com | 3 | 0 |

---

## 2. NULL と 0・空文字の違い

この3つは全く異なるものです。混同しないようにしましょう。

| 値 | 意味 | 例 |
|----|------|-----|
| `NULL` | 値が存在しない | ボーナスが未設定（まだ決まっていない） |
| `0` | 数値のゼロ | ボーナスが0円（意図的に0円に設定された） |
| `''` | 空の文字列 | コメント欄が空白（入力して消した） |

```sql
-- 高橋美咲のbonusは0（ゼロ）
-- 鈴木花子のbonusはNULL（未設定）
-- この2つは意味が異なる

SELECT name, bonus FROM employees;
-- name: 高橋美咲, bonus: 0       → ボーナスなしと確定
-- name: 鈴木花子, bonus: NULL    → ボーナスがまだ未決定
```

> **ポイント**  
> 「ボーナス0円」と「ボーナス未設定（NULL）」は意味が違います。  
> 集計するとき、`AVG(bonus)` は NULL を無視しますが 0 は計算に含めます。  
> この違いを意識することが重要です。

---

## 3. IS NULL / IS NOT NULL

NULL を検索するには `IS NULL` または `IS NOT NULL` を使います。

```sql
-- メールアドレスが登録されていない（NULL）の社員を検索
SELECT id, name FROM employees
WHERE email IS NULL;
```

実行結果：

| id | name |
|----|------|
| 3 | 佐藤次郎 |

```sql
-- メールアドレスが登録されている社員を検索
SELECT id, name, email FROM employees
WHERE email IS NOT NULL;
```

```sql
-- マネージャーが設定されていない社員（トップレベルの管理者）
SELECT id, name FROM employees
WHERE manager_id IS NULL;
```

---

## 4. NULL を `=` で比較できない理由（3値論理）

通常の真偽値（boolean）は `TRUE` か `FALSE` の2値です。  
しかし SQL には `TRUE`・`FALSE`・`UNKNOWN` の **3値論理** があります。

NULL が絡む比較はすべて `UNKNOWN` になります。

```sql
-- これは常にFALSE（NULLとの比較はUNKNOWNなのでWHEREを通過しない）
SELECT * FROM employees WHERE age = NULL;     -- 0件
SELECT * FROM employees WHERE age <> NULL;    -- 0件
SELECT * FROM employees WHERE NULL = NULL;    -- 0件
```

| 式 | 結果 |
|----|------|
| `NULL = NULL` | UNKNOWN |
| `NULL <> NULL` | UNKNOWN |
| `NULL = 0` | UNKNOWN |
| `NULL > 5` | UNKNOWN |
| `NULL IS NULL` | TRUE |
| `NULL IS NOT NULL` | FALSE |

WHERE 句は `TRUE` の行だけ返します。`UNKNOWN` は通過しません。

> **注意**  
> `WHERE age = NULL` と書いても結果は0件です。これはバグの原因になりやすいため  
> 必ず `WHERE age IS NULL` を使いましょう。

---

## 5. COALESCE（最初の NULL でない値を返す）

`COALESCE` は引数を左から順に評価して、最初に NULL でない値を返します。

### 構文

```sql
COALESCE(値1, 値2, 値3, ...)
```

### 基本的な使い方

```sql
-- bonusがNULLの場合は0を表示する
SELECT
    name,
    COALESCE(bonus, 0) AS bonus
FROM employees;
```

実行結果：

| name | bonus |
|------|-------|
| 田中太郎 | 50000 |
| 鈴木花子 | 0 |      ← NULLが0に置き換わった
| 佐藤次郎 | 100000 |
| 高橋美咲 | 0 |

### 複数の候補を指定する

```sql
-- 第1連絡先がNULLなら第2連絡先、それもNULLなら「未登録」を返す
SELECT
    name,
    COALESCE(phone1, phone2, '未登録') AS contact
FROM employees;
```

### NULL を含む計算での活用

```sql
-- NULL を含む計算は結果がNULLになる
-- 1000 + NULL = NULL（意図しない結果）
SELECT name, 1000 + bonus AS total FROM employees;

-- COALESCEでNULLを0に変換してから計算
SELECT name, 1000 + COALESCE(bonus, 0) AS total FROM employees;
```

> **ポイント**  
> NULL に対して計算（+、-、*、/）を行うと、結果は必ず NULL になります。  
> 計算前に COALESCE で NULL を適切な値（0など）に変換しましょう。

---

## 6. NULLIF（2つの値が等しければ NULL を返す）

`NULLIF` は2つの値が等しい場合に NULL を返し、等しくない場合は第1引数を返します。

### 構文

```sql
NULLIF(値1, 値2)
-- 値1 = 値2 のとき → NULL
-- 値1 ≠ 値2 のとき → 値1
```

### 基本的な使い方

```sql
-- ボーナスが0の場合はNULLとして扱う（0を「未設定」と同等にしたい場合）
SELECT
    name,
    NULLIF(bonus, 0) AS bonus_nullified
FROM employees;
```

| name | bonus_nullified |
|------|----------------|
| 田中太郎 | 50000 |
| 鈴木花子 | NULL |
| 佐藤次郎 | 100000 |
| 高橋美咲 | NULL |  ← 0がNULLに変換された

### ゼロ除算の防止

`NULLIF` のよくある使い方として、ゼロ除算を防ぐ用途があります。

```sql
-- total_salesが0のときに除算するとエラーになる
SELECT name, total_revenue / total_sales AS avg_price FROM sales;

-- NULLIF で0をNULLに変換することでゼロ除算を防ぐ
-- ÷ NULL = NULL になる（エラーは出ない）
SELECT name, total_revenue / NULLIF(total_sales, 0) AS avg_price FROM sales;
```

> **ポイント**  
> COALESCE と NULLIF は対になる関数です。  
> - COALESCE：NULL → 値 に変換  
> - NULLIF：値 → NULL に変換

> **現場メモ**  
> `COALESCE` はSQLで最もよく使う関数の一つです。特に「集計結果がNULLになる場合」への対処として `COALESCE(SUM(amount), 0)` というパターンは頻出します。注意が必要なのは「NULLを0に変換してから集計するか、集計結果のNULLを0に変換するか」で意味が変わること。例えば `AVG(COALESCE(score, 0))` と `COALESCE(AVG(score), 0)` では前者が「0点扱いで平均を取る」、後者が「NULL以外の行で平均を取る（全員NULLなら0）」と結果が異なります。どちらが正しいかはビジネス要件次第なので、必ずレビュー時に確認します。

---

## 7. CASE 式の2種類

CASE式はSQLの中で条件分岐を行う構文です。プログラミングの `if-else` に相当します。

### 単純 CASE（値との一致を比較）

```sql
-- 部門コードを日本語名に変換する
SELECT
    name,
    dept_code,
    CASE dept_code
        WHEN 'SALES' THEN '営業部'
        WHEN 'DEV'   THEN '開発部'
        WHEN 'HR'    THEN '人事部'
        ELSE '不明'
    END AS dept_name
FROM employees;
```

`CASE 列名 WHEN 値 THEN 結果` の形式です。

### 検索 CASE（任意の条件を評価）

```sql
-- 年齢で世代を分類する
SELECT
    name,
    age,
    CASE
        WHEN age < 30 THEN '20代'
        WHEN age < 40 THEN '30代'
        WHEN age < 50 THEN '40代'
        ELSE '50代以上'
    END AS generation
FROM employees;
```

`CASE WHEN 条件 THEN 結果` の形式で、任意の条件式を使えます。

> **ポイント**  
> CASE は上から順に評価され、最初に条件が `TRUE` になったところで評価を止めます。  
> 条件の順序が重要です。範囲指定の場合は狭い条件から書きましょう。

---

## 8. CASE で NULL を扱う

CASE 式の中で NULL を扱う場合は `IS NULL` を使います。

```sql
-- ボーナスがNULLのときは「未設定」、0のときは「なし」、それ以外は金額を表示
SELECT
    name,
    CASE
        WHEN bonus IS NULL THEN '未設定'
        WHEN bonus = 0     THEN 'なし'
        ELSE bonus::TEXT || '円'
    END AS bonus_display
FROM employees;
```

実行結果：

| name | bonus_display |
|------|--------------|
| 田中太郎 | 50000円 |
| 鈴木花子 | 未設定 |
| 佐藤次郎 | 100000円 |
| 高橋美咲 | なし |

> **注意**  
> `CASE WHEN bonus = NULL THEN ...` は動きません（3値論理のため）。  
> NULL との比較は必ず `IS NULL` を使います。

---

## 9. CASE を集計と組み合わせる（CASE + SUM/COUNT）

CASE を集計関数の中で使うと、条件付き集計が実現できます。

### SUM(CASE ...) パターン

```sql
-- 部門ごとに「ボーナスあり」と「ボーナスなし（またはNULL）」の人数を集計
SELECT
    department,
    COUNT(*) AS total,
    SUM(CASE WHEN bonus > 0 THEN 1 ELSE 0 END) AS bonus_count,
    SUM(CASE WHEN bonus IS NULL OR bonus = 0 THEN 1 ELSE 0 END) AS no_bonus_count
FROM employees
GROUP BY department;
```

### COUNT(CASE ...) パターン

```sql
-- 年代別の人数を横持ちで集計
SELECT
    COUNT(CASE WHEN age < 30 THEN 1 END) AS "20代",
    COUNT(CASE WHEN age >= 30 AND age < 40 THEN 1 END) AS "30代",
    COUNT(CASE WHEN age >= 40 THEN 1 END) AS "40代以上"
FROM employees;
```

COUNT は NULL を数えないため、`THEN 1 END`（ELSE なし、NULL を返す）が使えます。

> **ポイント**  
> `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` と `COUNT(CASE WHEN ... THEN 1 END)` は  
> ほぼ同じ結果になります。どちらも現場でよく使うパターンです。  
> 後者の方が短く書けますが、前者の方が初学者には意図が分かりやすいです。

---

## 10. よくあるミス（NULL の落とし穴）

### ミス1: NULL を `=` で比較する

```sql
-- 間違い：0件しか返らない
SELECT * FROM employees WHERE age = NULL;
SELECT * FROM employees WHERE age != NULL;

-- 正しい
SELECT * FROM employees WHERE age IS NULL;
SELECT * FROM employees WHERE age IS NOT NULL;
```

### ミス2: NOT IN に NULL が含まれる場合

> **現場メモ**  
> バッチ処理で「まだ処理されていないレコードを取得する」というSQLに `NOT IN` を使っていたところ、あるタイミングから突然0件しか取れなくなる障害が発生しました。原因は、サブクエリの結果に `NULL` が1件混入していたことでした。データ投入時の不具合でNULLが入ってしまい、それ以降バッチが動かなくなった。`NOT IN` + サブクエリは時限爆弾になりえます。私のチームでは `NOT IN (SELECT ...)` パターンはPRで必ず指摘して `NOT EXISTS` または `LEFT JOIN IS NULL` に書き換えてもらいます。

```sql
-- サブクエリの結果にNULLが含まれると NOT IN が全行を除外する
SELECT * FROM employees
WHERE id NOT IN (SELECT manager_id FROM employees);
-- manager_id にNULLが含まれていると、このクエリは0件返ってくる！

-- 正しい対処法：NULL を除外する
SELECT * FROM employees
WHERE id NOT IN (
    SELECT manager_id FROM employees
    WHERE manager_id IS NOT NULL
);
```

### ミス3: NULL を含む計算

```sql
-- NULLを含む演算は結果がNULL
SELECT 100 + NULL;       -- NULL
SELECT 'hello' || NULL;  -- NULL（文字列連結もNULLになる）

-- COALESCEで対処
SELECT 100 + COALESCE(bonus, 0) FROM employees;
SELECT name || COALESCE(suffix, '') FROM employees;
```

### ミス4: COUNT(*) と COUNT(列名) の違い

```sql
-- COUNT(*) は NULL を含む全行をカウント
SELECT COUNT(*) FROM employees;       -- 4

-- COUNT(列名) はNULLを除いてカウント
SELECT COUNT(email) FROM employees;   -- 3（emailがNULLの行を除く）
```

> **注意**  
> `COUNT(*)` と `COUNT(列名)` は NULL の扱いが異なります。  
> 「NULL以外の件数を数えたい」場合は列名を指定し、  
> 「全件数を数えたい」場合は `COUNT(*)` を使います。

---

## 11. PRレビューのチェックポイント

- [ ] `= NULL` や `!= NULL` で NULL 比較をしていないか（`IS NULL` / `IS NOT NULL` を使う）
- [ ] `NOT IN (SELECT ...)` パターンを使っていないか（サブクエリにNULLが混入すると全件除外になる）
- [ ] `CASE WHEN column = NULL THEN ...` と書いていないか（`IS NULL` が正しい）
- [ ] NULL を含む列での計算（+, -, ||など）に `COALESCE` が適用されているか
- [ ] `COALESCE` で NULL を変換するタイミング（集計前か集計後か）が要件と合っているか
- [ ] `COUNT(*)` と `COUNT(列名)` の使い分けが意図に合っているか

---

## 12. まとめ

| テーマ | 要点 |
|--------|------|
| NULL の意味 | 「値なし」「不明」「適用外」を表す特殊な状態 |
| NULL と 0・空文字 | 全く異なるもの。混同しない |
| IS NULL | NULL かどうかを調べる。`= NULL` は使えない |
| 3値論理 | TRUE / FALSE / UNKNOWN の3状態。NULL との比較は UNKNOWN |
| COALESCE | 最初の NULL でない値を返す。NULL → 値 の変換に使う |
| NULLIF | 2つの値が等しければ NULL を返す。値 → NULL の変換に使う |
| 単純 CASE | `CASE 列 WHEN 値 THEN 結果` で値の一致を比較する |
| 検索 CASE | `CASE WHEN 条件 THEN 結果` で任意の条件を評価する |
| CASE + 集計 | `SUM(CASE...)` や `COUNT(CASE...)` で条件付き集計ができる |
| NOT IN と NULL | サブクエリに NULL が含まれると NOT IN は全行を除外する |
