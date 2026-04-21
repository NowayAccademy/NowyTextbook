# ORDER BY / LIMIT / DISTINCT
並び替え・件数制限・重複排除の書き方と注意点を学びます

## 本章の目標

本章では以下を目標にして学習します。

- ORDER BY を使って結果を任意の順序で並べられること
- LIMIT と OFFSET を使って件数を制限し、ページング処理を実装できること
- DISTINCT を使って重複を排除した結果を取得できること
- ORDER BY なしで LIMIT を使う危険性を理解していること

---

## 1. ORDER BY の基本（ASC / DESC）

クエリの結果は、デフォルトでは順序が保証されていません。一定の順序で取得したい場合は `ORDER BY` を使います。

以下の `products` テーブルを例に使います。

| id | name | price | category | stock |
|----|------|-------|----------|-------|
| 1 | りんご | 150 | 果物 | 100 |
| 2 | バナナ | 80 | 果物 | 200 |
| 3 | にんじん | 120 | 野菜 | 50 |
| 4 | ほうれん草 | 200 | 野菜 | 30 |
| 5 | みかん | 100 | 果物 | 150 |

### 昇順（ASC）

```sql
-- 価格の安い順に並べる（昇順）
SELECT id, name, price FROM products
ORDER BY price ASC;
```

`ASC`（Ascending）は昇順（小さい → 大きい）です。

### 降順（DESC）

```sql
-- 価格の高い順に並べる（降順）
SELECT id, name, price FROM products
ORDER BY price DESC;
```

`DESC`（Descending）は降順（大きい → 小さい）です。

> **ポイント**  
> `ASC` はデフォルトのため省略可能ですが、明示的に書くと読みやすくなります。  
> チームで開発するときは省略せず書くことを推奨します。

---

## 2. 複数列の ORDER BY（優先順位）

複数の列を指定すると、最初の列で並べた後、同じ値の行を次の列でさらに並べ替えます。

```sql
-- まずカテゴリ順（昇順）、同じカテゴリ内では価格順（昇順）
SELECT id, name, price, category FROM products
ORDER BY category ASC, price ASC;
```

実行結果：

| id | name | price | category |
|----|------|-------|----------|
| 3 | にんじん | 120 | 野菜 |
| 4 | ほうれん草 | 200 | 野菜 |
| 2 | バナナ | 80 | 果物 |
| 5 | みかん | 100 | 果物 |
| 1 | りんご | 150 | 果物 |

```sql
-- カテゴリは昇順、価格は降順（混在も可能）
SELECT id, name, price, category FROM products
ORDER BY category ASC, price DESC;
```

> **ポイント**  
> ORDER BY には列名の代わりに SELECT の何番目の列かを数字で指定することもできます。  
> `ORDER BY 3` は3番目の列でソートします。ただし、数字は可読性が下がるため  
> 現場ではあまり推奨されません。

---

## 3. NULL のソート順（NULLS FIRST / NULLS LAST）

NULLが含まれる列でソートしたとき、NULLの位置はデータベースによって異なります。  
PostgreSQL では **昇順のとき NULL が最後**、**降順のとき NULL が最初** になります。

```sql
-- NULLの位置を明示的に指定する
SELECT id, name, stock FROM products
ORDER BY stock ASC NULLS LAST;   -- NULL を末尾に
```

```sql
SELECT id, name, stock FROM products
ORDER BY stock DESC NULLS FIRST; -- NULL を先頭に
```

```sql
-- NULL を先頭に表示したい場合（昇順）
SELECT id, name, stock FROM products
ORDER BY stock ASC NULLS FIRST;
```

> **注意**  
> `NULLS FIRST` / `NULLS LAST` は PostgreSQL の構文です。MySQLなど他のDBでは  
> `ISNULL(stock)` のような関数を使う必要があります。移植性に注意しましょう。

---

## 4. LIMIT で件数を制限する

`LIMIT` を使うと、取得する行数の上限を指定できます。

```sql
-- 上位3件だけ取得
SELECT id, name, price FROM products
ORDER BY price DESC
LIMIT 3;
```

実行結果：

| id | name | price |
|----|------|-------|
| 4 | ほうれん草 | 200 |
| 1 | りんご | 150 |
| 5 | みかん | 100 |

### LIMIT の使いどころ

- 「最新の10件を表示する」というような要件
- パフォーマンステストで少量のデータだけ確認したいとき
- ランキング上位N件を取得するとき

```sql
-- 在庫が少ない商品ワースト3を取得
SELECT id, name, stock FROM products
ORDER BY stock ASC
LIMIT 3;
```

---

## 5. OFFSET でスキップする

`OFFSET` を使うと、先頭から指定した件数をスキップして取得できます。

```sql
-- 先頭3件をスキップして4件目以降を取得
SELECT id, name, price FROM products
ORDER BY price DESC
LIMIT 3 OFFSET 3;
```

> **ポイント**  
> OFFSET は0始まりです。`OFFSET 0` は先頭から（スキップなし）、  
> `OFFSET 3` は先頭3件をスキップして4件目から取得します。

---

## 6. ページングの基本（LIMIT + OFFSET）

Webアプリケーションでよく使われる「ページング（ページネーション）」は  
LIMIT と OFFSET の組み合わせで実装できます。

1ページあたり10件表示する場合：

```sql
-- 1ページ目（1〜10件目）
SELECT id, name, price FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 0;

-- 2ページ目（11〜20件目）
SELECT id, name, price FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 10;

-- 3ページ目（21〜30件目）
SELECT id, name, price FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 20;
```

公式で表すと：

```
OFFSET = (ページ番号 - 1) × 1ページの件数
```

```sql
-- ページ番号をアプリ側で計算して渡す例
-- page = 5, per_page = 10 のとき OFFSET = 40
SELECT id, name, price FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 40;
```

---

## 7. OFFSET が大きいと遅くなる理由

`OFFSET` は「スキップする」といっても、内部的にはスキップした行も一度読み込んでいます。  
つまり `OFFSET 10000` は先頭1万件を読み込んだ後に捨てているため、遅くなります。

```sql
-- これはOFFSETが大きいと遅くなる
SELECT id, name FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 100000;
```

### より効率的な方法（シークメソッド）

```sql
-- 前ページの最後のIDを条件にする
-- 前ページの最後のIDが 100000 だった場合
SELECT id, name FROM products
WHERE id > 100000
ORDER BY id ASC
LIMIT 10;
```

> **ポイント**  
> 本番システムでページ数が多くなる場合は、OFFSETの代わりに  
> 「前ページの最後のIDより大きいIDを取得する」方法（シークメソッド）を検討しましょう。  
> ただし実装が複雑になるため、まずはLIMIT+OFFSETで理解を深めることが大切です。

> **現場メモ**  
> リリースから1年後にユーザー数が増えてから「ページ最後の方が異常に遅い」という報告が来たことがあります。原因は `OFFSET 50000` 以上のページングでした。最初の1万件は速いのに、50ページ目あたりから数秒かかるようになっていた。シークメソッドに切り替えることで解決しましたが、最初から設計しておけばよかったと思いました。「今は件数が少ないから問題ない」は通用しないので、大量データになりうるページングは最初からシークメソッドを検討するか、将来のリファクタを想定した設計をしておくのが現場の判断基準です。

---

## 8. DISTINCT で重複排除

`DISTINCT` を使うと、結果から重複する行を除いて取得できます。

### 基本的な使い方

```sql
-- カテゴリの一覧を取得（重複なし）
SELECT DISTINCT category FROM products;
```

実行結果：

| category |
|----------|
| 果物 |
| 野菜 |

重複が排除されて2行だけ返ってきます。

### 複数列での DISTINCT

```sql
-- (category, price) の組み合わせで重複排除
SELECT DISTINCT category, price FROM products
ORDER BY category, price;
```

複数列を指定した場合、**指定した全列の組み合わせ**が同じ行を重複とみなします。

> **注意**  
> `SELECT DISTINCT *` はすべての列が完全に一致する行を重複とみなします。  
> id列のような一意な列があれば重複は発生しないため、あまり意味がありません。

---

## 9. DISTINCT ON（PostgreSQL 独自）

PostgreSQL には `DISTINCT ON` という特別な構文があります。  
これは「特定の列の値が同じ場合に1行だけ残す」というものです。

```sql
-- カテゴリごとに最も価格が高い商品を1件ずつ取得
SELECT DISTINCT ON (category)
    id,
    name,
    price,
    category
FROM products
ORDER BY category, price DESC;
```

- `DISTINCT ON (category)` → category が同じ行の中から1行だけ残す
- `ORDER BY category, price DESC` → price DESC なので、同じカテゴリの中で最も高価な行が選ばれる

> **ポイント**  
> `DISTINCT ON` を使う場合、`ORDER BY` の最初の列は `DISTINCT ON` の列と一致させる必要があります。  
> これはPostgreSQL固有の構文のため、他のDBMSには移植できません。

---

## 10. ORDER BY なしで LIMIT を使う危険性

`ORDER BY` を指定せずに `LIMIT` を使うと、どの行が返ってくるかは保証されません。

```sql
-- 危険：どの3件が返ってくるか保証されない
SELECT id, name FROM products
LIMIT 3;
```

データベースは内部的に都合の良い順序でデータを読むため、同じクエリを実行しても  
毎回異なる結果が返ってくる可能性があります。

```sql
-- 安全：必ず ORDER BY とセットで使う
SELECT id, name FROM products
ORDER BY id ASC
LIMIT 3;
```

> **注意**  
> 「毎回同じ結果が欲しい」「特定の上位N件が欲しい」という場合は、  
> 必ず ORDER BY をセットで書きましょう。ORDER BY なしの LIMIT は  
> バグの温床になります。

> **現場メモ**  
> 「開発環境では毎回同じ結果だったのに本番で突然違う結果が返ってきた」という問い合わせを受けたことがあります。調べると `ORDER BY` なしで `LIMIT 1` を使っていました。開発時はたまたま同じ順序でデータが返っていただけで、本番のテーブルはVACUUMや並列書き込みの影響でブロックの並びが異なっていました。PostgreSQLはデフォルトで順序を保証しません。`ORDER BY` なしの `LIMIT` はテスト環境では気づかないまま本番で初めて問題になるタイプのバグです。

---

## 11. よくあるミスと対処法

### ミス1: ORDER BY と WHERE の順番を間違える

```sql
-- 間違い：WHERE は ORDER BY より前に書く
SELECT id, name, price FROM products
ORDER BY price DESC
WHERE category = '果物';  -- エラー

-- 正しい順序
SELECT id, name, price FROM products
WHERE category = '果物'
ORDER BY price DESC;
```

SQLの書く順序は `SELECT → FROM → WHERE → ORDER BY → LIMIT` です。

### ミス2: OFFSET だけ使って LIMIT を忘れる

```sql
-- 意図は「11件目以降を取得」かもしれないが全件返ってくる
SELECT id, name FROM products
OFFSET 10;

-- LIMIT とセットで使う
SELECT id, name FROM products
ORDER BY id ASC
LIMIT 10 OFFSET 10;
```

### ミス3: DISTINCT と ORDER BY の列が噛み合わない

```sql
-- これはエラーになる場合がある
-- DISTINCT を使うと ORDER BY に指定できる列が制限される
SELECT DISTINCT category FROM products
ORDER BY price;  -- price は SELECT に含まれていないのでエラー

-- 正しい：ORDER BY は SELECT と同じ列を使う
SELECT DISTINCT category FROM products
ORDER BY category;
```

### ミス4: LIMIT の値を0にしてしまう

```sql
-- 0件を返す（意図していない場合はバグ）
SELECT id, name FROM products
LIMIT 0;
```

> **注意**  
> アプリ側からLIMITの値を動的に渡す場合、0や負の値が来ないようにバリデーションを  
> 忘れずに実施しましょう。

---

## 12. ポイント

- `LIMIT` を使っているクエリに `ORDER BY` がセットになっているか
- ページングに大きな `OFFSET` を使っていないか（件数が増えると遅くなる）
- `ORDER BY` なしのページングになっていないか（毎回異なる結果になりうる）
- `DISTINCT ON` を使っている場合、`ORDER BY` の先頭列と `DISTINCT ON` の列が一致しているか
- アプリ側から `LIMIT` の値を渡す場合、0や負の値をバリデーションしているか

---

## 13. まとめ

| テーマ | 要点 |
|--------|------|
| ORDER BY の基本 | `ASC`（昇順）と `DESC`（降順）を指定する |
| 複数列のソート | カンマ区切りで複数列を指定し、左から優先順に評価される |
| NULL のソート | PostgreSQL は昇順でNULL最後、降順でNULL最初。`NULLS FIRST/LAST` で明示できる |
| LIMIT | 取得件数の上限を指定する |
| OFFSET | 先頭からスキップする件数を指定する（0始まり） |
| ページング | `LIMIT n OFFSET (page-1)*n` の組み合わせで実装する |
| OFFSET の注意 | 大きなOFFSETはパフォーマンスが低下する |
| DISTINCT | 重複する行を排除して取得する |
| DISTINCT ON | PostgreSQL 固有。特定列が同じ行のうち1行だけ残す |
| ORDER BY なしの LIMIT | 結果の順序が保証されないため必ず ORDER BY とセットで使う |

---

## 練習問題

以下のテーブルを使って解いてください。

```sql
CREATE TABLE IF NOT EXISTS products (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  price    INTEGER NOT NULL,
  category TEXT    NOT NULL,
  stock    INTEGER NOT NULL
);
DELETE FROM products;
INSERT INTO products (id, name, price, category, stock) VALUES
  (1, 'ノートPC',     98000, 'PC',       10),
  (2, 'マウス',        3500, '周辺機器', 50),
  (3, 'キーボード',    8000, '周辺機器',  0),
  (4, 'モニター',     42000, 'PC',        5),
  (5, 'USBハブ',      2800, '周辺機器',  30),
  (6, 'タブレット',   65000, 'PC',        8);
```

### 問題1: 価格の高い順に上位3件

> 参照：[1. ORDER BY の基本](#1-order-by-の基本asc-desc) ・ [4. LIMIT で件数を制限する](#4-limit-で件数を制限する)

`price` の高い順に上位3件の `name` と `price` を取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT name, price
FROM products
ORDER BY price DESC
LIMIT 3;
```

**解説：** `ORDER BY price DESC` で降順に並べ、`LIMIT 3` で先頭3件に絞ります。結果はノートPC・タブレット・モニターです。

</details>

### 問題2: カテゴリの重複排除

> 参照：[8. DISTINCT で重複排除](#8-distinct-で重複排除)

`products` テーブルに存在する `category` の一覧を重複なく取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT DISTINCT category
FROM products;
```

**解説：** `DISTINCT` を付けることで重複行を除去します。6件のデータから `PC` と `周辺機器` の2種類が返ります。

</details>

### 問題3: 複合ソートとページング

> 参照：[2. 複数列の ORDER BY](#2-複数列の-order-by優先順位) ・ [6. ページングの基本](#6-ページングの基本limit-offset)

`category` の昇順・同一カテゴリ内では `price` の降順で並べ、3件目から2件取得してください（2ページ目相当）。

<details>
<summary>回答を見る</summary>

```sql
SELECT name, category, price
FROM products
ORDER BY category ASC, price DESC
LIMIT 2 OFFSET 2;
```

**解説：** `ORDER BY` に複数カラムを指定すると、1つ目のキーで並べた後、同じ値の行を2つ目のキーで並べます。`OFFSET 2` で先頭2件をスキップし、`LIMIT 2` で次の2件を取得します。

</details>
