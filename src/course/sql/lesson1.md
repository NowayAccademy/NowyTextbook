# SELECT と WHERE
SQLの基本であるSELECTとWHERE、AND/OR/NOTで行を取り出します

## 本章の目標

本章では以下を目標にして学習します。

- SQLの種類（DDL/DML/DCL）を説明できること
- SELECT・FROMを使って必要な列のデータを取得できること
- WHEREで条件を指定して特定の行だけ絞り込めること
- AND/OR/NOTと括弧を組み合わせて複雑な条件を表現できること

---

## 1. SQLとは何か

SQL（Structured Query Language）は、リレーショナルデータベースを操作するための言語です。「データを検索する」「データを追加・変更・削除する」「テーブルを作る」といった操作をすべてSQLで行います。

### SQLの3つの分類

SQLは大きく3種類に分類されます。

| 分類 | 英語名 | 主なコマンド | 役割 |
|------|--------|-------------|------|
| DDL | Data Definition Language | CREATE, ALTER, DROP | テーブルや構造を定義する |
| DML | Data Manipulation Language | SELECT, INSERT, UPDATE, DELETE | データを操作する |
| DCL | Data Control Language | GRANT, REVOKE | アクセス権限を管理する |

本章では **DML の SELECT** を中心に学習します。

> **ポイント**  
> 現場では「SQL書いて」と言われたら、ほぼ必ずDMLの操作を指します。まずはSELECT・INSERT・UPDATE・DELETEをしっかり身につけましょう。

---

## 2. SELECT / FROM の基本構文

### テーブルのイメージ

データベースの「テーブル」はExcelの表と似ています。  
縦方向が「行（レコード）」、横方向が「列（カラム）」です。

以下のような `users` テーブルを例に使います。

| id | name | age | email | department |
|----|------|-----|-------|------------|
| 1 | 田中太郎 | 28 | tanaka@example.com | 営業 |
| 2 | 鈴木花子 | 34 | suzuki@example.com | 開発 |
| 3 | 佐藤次郎 | 25 | sato@example.com | 営業 |
| 4 | 高橋美咲 | 41 | takahashi@example.com | 人事 |

### 全列を取得する

```sql
SELECT * FROM users;
```

`*`（アスタリスク）はすべての列を意味します。テーブルのすべての列・全行が返ってきます。

### 特定の列だけ取得する

```sql
SELECT id, name, age FROM users;
```

カンマ区切りで取得したい列名を指定します。上記では `id`・`name`・`age` の3列だけが返ってきます。

> **ポイント**  
> 本番環境では `SELECT *` ではなく列名を明示することが推奨されます。理由は2つあります。  
> 1. テーブル定義が変わったとき（列が追加・削除された場合）に予期しないバグが発生しにくくなる  
> 2. 不要なデータを取得しないためパフォーマンスが向上する

---

## 3. 列エイリアス（AS）の使い方

取得した列に別名（エイリアス）をつけることができます。

```sql
SELECT
    name AS 氏名,
    age  AS 年齢
FROM users;
```

`AS` の後ろに好きな名前を付けられます。日本語も使えますが、現場では英語が一般的です。

```sql
-- スペースを含む場合はダブルクォートで囲む
SELECT
    name AS "User Name",
    age  AS "User Age"
FROM users;
```

> **ポイント**  
> `AS` は省略可能ですが、可読性のために書く習慣をつけましょう。  
> `SELECT name 氏名` とも書けますが、わかりにくいので `AS` を付けることを推奨します。

---

## 4. `*` vs 列名明示

```sql
-- 避けるべき書き方（本番では）
SELECT * FROM users;

-- 推奨される書き方
SELECT id, name, age, email, department FROM users;
```

### なぜ `*` は避けるべきか

実際のシステムで起きる問題の例：

```sql
-- usersテーブルにpassword列が追加された場合
-- SELECT * だとパスワードが意図せず取得されてしまう危険がある
SELECT * FROM users;

-- 列名明示なら password は返ってこない
SELECT id, name, age, email, department FROM users;
```

> **注意**  
> `SELECT *` は開発中のデータ確認や調査には便利ですが、アプリケーションから呼び出すSQLでは必ず列名を明示してください。

> **現場メモ**  
> `SELECT *` が原因でインシデントになったケースを直接経験しました。`users` テーブルに `password_hash` 列が追加されたとき、APIが `SELECT *` を使っていたため、レスポンスJSONにハッシュ値が含まれてしまいました。クライアントには返さないとコードで弾いていたつもりが、別のエンドポイントでは素通りしていました。セキュリティ的に問題があるとわかってから全エンドポイントのSQLを洗い直すのに丸一日かかりました。列名明示はパフォーマンスだけでなくセキュリティの問題でもあります。

---

## 5. WHERE による条件絞り込み

`WHERE` 句を使うと、条件に合う行だけを取得できます。

```sql
-- 年齢が30以上のユーザーを取得
SELECT id, name, age FROM users
WHERE age >= 30;
```

実行結果：

| id | name | age |
|----|------|-----|
| 2 | 鈴木花子 | 34 |
| 4 | 高橋美咲 | 41 |

### 文字列の条件指定

```sql
-- 部署が「営業」のユーザーを取得
SELECT id, name, department FROM users
WHERE department = '営業';
```

文字列は **シングルクォート** `'` で囲みます。ダブルクォートではないので注意してください。

### 日付の条件指定

```sql
-- 2024年以降に登録されたユーザーを取得
SELECT id, name, created_at FROM users
WHERE created_at >= '2024-01-01';
```

日付もシングルクォートで囲み、`YYYY-MM-DD` 形式で指定します。

---

## 6. 比較演算子

WHERE句で使える比較演算子の一覧です。

| 演算子 | 意味 | 例 |
|--------|------|-----|
| `=` | 等しい | `age = 28` |
| `<>` または `!=` | 等しくない | `age <> 28` |
| `<` | より小さい | `age < 30` |
| `>` | より大きい | `age > 30` |
| `<=` | 以下 | `age <= 30` |
| `>=` | 以上 | `age >= 30` |

```sql
-- 28歳以外のユーザーを取得
SELECT id, name, age FROM users
WHERE age <> 28;

-- 30歳以下のユーザーを取得
SELECT id, name, age FROM users
WHERE age <= 30;
```

> **ポイント**  
> `<>` と `!=` はどちらも「等しくない」を意味し、PostgreSQLではどちらも使えます。  
> SQL標準は `<>` ですが、現場では `!=` もよく使われます。

---

## 7. AND / OR / NOT の使い方と優先順位

複数の条件を組み合わせることができます。

### AND（かつ）

すべての条件を満たす行を返します。

```sql
-- 営業部門で、かつ30歳以上のユーザーを取得
SELECT id, name, age, department FROM users
WHERE department = '営業'
  AND age >= 30;
```

### OR（または）

いずれかの条件を満たす行を返します。

```sql
-- 営業部門または開発部門のユーザーを取得
SELECT id, name, department FROM users
WHERE department = '営業'
   OR department = '開発';
```

### NOT（否定）

条件を反転させます。

```sql
-- 営業部門以外のユーザーを取得
SELECT id, name, department FROM users
WHERE NOT department = '営業';

-- ※ <> を使っても同じ意味
SELECT id, name, department FROM users
WHERE department <> '営業';
```

### 優先順位

`AND` と `OR` を混在させるとき、**`AND` は `OR` より先に評価されます**。

```sql
-- これは「(department = '営業' AND age >= 30) OR department = '開発'」の意味
SELECT id, name, age, department FROM users
WHERE department = '営業' AND age >= 30
   OR department = '開発';
```

> **注意**  
> AND と OR を混在させると、意図しない結果になることがよくあります。  
> 条件が複雑なときは必ず括弧を使って明示しましょう。

> **現場メモ**  
> PRレビューで最もよく指摘するのがAND/ORの優先順位ミスです。「有料会員、かつ東京または大阪在住」を書こうとして括弧を忘れると、「有料会員かつ東京」または「大阪在住（プランを問わず）」という全く違う意味になります。このバグはユニットテストでは気づきにくく、実際にデータを見て初めて発覚することが多い。複数条件が絡む箇所は必ず括弧を使い、条件の意図をコメントで書いてもらうようレビューで伝えています。

---

## 8. カッコによる優先順位の制御

括弧 `()` で評価順を明示できます。

```sql
-- 「営業または開発の部門で、かつ30歳以上」
SELECT id, name, age, department FROM users
WHERE (department = '営業' OR department = '開発')
  AND age >= 30;
```

括弧がない場合と比較してみましょう。

```sql
-- 括弧なし：「(営業 AND 30歳以上) OR 開発」
SELECT id, name, age, department FROM users
WHERE department = '営業' AND age >= 30
   OR department = '開発';

-- 括弧あり：「(営業 OR 開発) AND 30歳以上」
SELECT id, name, age, department FROM users
WHERE (department = '営業' OR department = '開発')
  AND age >= 30;
```

この2つは結果が異なります。意図を明確にするために括弧を使う習慣をつけましょう。

> **ポイント**  
> 「条件が3つ以上になったら括弧を使う」というルールを自分に課すとバグが減ります。

---

## 9. 文字列・数値・日付の書き方の違い

SQLで値を書くときの書き方はデータ型によって異なります。

```sql
-- 数値はそのまま書く（クォート不要）
SELECT * FROM users WHERE age = 28;
SELECT * FROM orders WHERE price > 1000;

-- 文字列はシングルクォートで囲む
SELECT * FROM users WHERE name = '田中太郎';
SELECT * FROM users WHERE department = '営業';

-- 日付もシングルクォートで囲む（YYYY-MM-DD形式）
SELECT * FROM orders WHERE order_date = '2024-03-15';
SELECT * FROM orders WHERE order_date >= '2024-01-01';

-- 日付と時刻はYYYY-MM-DD HH:MI:SS形式
SELECT * FROM logs WHERE created_at >= '2024-01-01 09:00:00';
```

> **注意**  
> 数値をシングルクォートで囲んでも多くの場合動きますが、暗黙的な型変換が発生し  
> インデックスが効かなくなる場合があります。型を意識して書きましょう。

---

## 10. よくあるミスと対処法

### ミス1: NULL を `=` で比較してしまう

```sql
-- 間違い：NULLは = で比較できない（常にFALSEになる）
SELECT * FROM users WHERE email = NULL;

-- 正しい：IS NULL を使う
SELECT * FROM users WHERE email IS NULL;

-- NULL以外を取得したい場合
SELECT * FROM users WHERE email IS NOT NULL;
```

NULL との比較には `=` ではなく `IS NULL` / `IS NOT NULL` を使います。  
これはSQLの仕様で、`NULL = NULL` は `TRUE` でも `FALSE` でもなく `UNKNOWN` になるためです。

### ミス2: 文字列をダブルクォートで囲んでしまう

```sql
-- 間違い：ダブルクォートは列名や識別子に使う
SELECT * FROM users WHERE name = "田中太郎";  -- エラーになる

-- 正しい：文字列はシングルクォート
SELECT * FROM users WHERE name = '田中太郎';
```

### ミス3: AND/OR の優先順位を間違える

```sql
-- 意図：「年齢20代または30代で、かつ営業部門」
-- 間違い（括弧なし）：「(20代) OR (30代 AND 営業)」になってしまう
SELECT * FROM users
WHERE age >= 20 AND age < 30
   OR age >= 30 AND age < 40
  AND department = '営業';

-- 正しい：括弧で明示
SELECT * FROM users
WHERE (age >= 20 AND age < 40)
  AND department = '営業';
```

### ミス4: FROM を書き忘れる

```sql
-- 間違い
SELECT id, name WHERE age > 30;

-- 正しい
SELECT id, name FROM users WHERE age > 30;
```

> **注意**  
> `FROM` 句は必須です（一部の特殊なケースを除く）。SELECTを書いたら必ずFROMを書く癖をつけましょう。

---

## 11. PRレビューのチェックポイント

- [ ] `SELECT *` を使っていないか（本番コードでは列名を明示する）
- [ ] 文字列比較でダブルクォートを使っていないか（シングルクォートが正しい）
- [ ] NULL との比較に `= NULL` を使っていないか（`IS NULL` を使う）
- [ ] AND/OR が混在している条件に括弧が付いているか
- [ ] 列に適切な型の値を渡しているか（文字列列に数値を渡すなど型の混乱がないか）
- [ ] FROM句が抜けていないか（SELECT のみで WHERE を書いていないか）

---

## 12. まとめ

| テーマ | 要点 |
|--------|------|
| SQL の分類 | DDL（構造定義）、DML（データ操作）、DCL（権限管理） |
| SELECT の基本 | `SELECT 列名 FROM テーブル名` が基本形 |
| `*` の注意 | 本番コードでは列名を明示する |
| AS によるエイリアス | `AS 別名` で列に分かりやすい名前をつけられる |
| WHERE の基本 | 条件に合う行だけを取得する |
| 比較演算子 | `=`, `<>`, `<`, `>`, `<=`, `>=` が使える |
| AND/OR/NOT | AND が OR より先に評価される |
| 括弧の活用 | 複雑な条件は括弧で評価順を明示する |
| 値の書き方 | 数値はそのまま、文字列と日付はシングルクォート |
| NULL の比較 | `= NULL` ではなく `IS NULL` を使う |
