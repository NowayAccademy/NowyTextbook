# 文字列検索パターン
LIKE・IN・BETWEEN・EXISTSでデータを効率的に絞り込みます

## 本章の目標

本章では以下を目標にして学習します。

- LIKE とワイルドカードを使ってパターン一致検索ができること
- IN / NOT IN を使って複数の候補値で絞り込みができること
- BETWEEN を使って範囲指定の検索ができること
- EXISTS を使ってサブクエリの結果の存在確認ができること
- それぞれの演算子のパフォーマンス上の特性を理解していること

---

## 1. LIKE とワイルドカード（% と _）

`LIKE` は文字列のパターン一致を行う演算子です。  
特定の文字列を含む行や、特定の文字で始まる行などを検索できます。

以下の `customers` テーブルを例に使います。

| id | name | email | address |
|----|------|-------|---------|
| 1 | 田中太郎 | tanaka@example.com | 東京都新宿区... |
| 2 | 田中花子 | hanako@gmail.com | 大阪府大阪市... |
| 3 | 鈴木次郎 | suzuki@example.com | 東京都渋谷区... |
| 4 | 田村一郎 | tamura@company.co.jp | 神奈川県横浜市... |
| 5 | 中田美咲 | nakata@example.com | 東京都品川区... |

### ワイルドカードの種類

| ワイルドカード | 意味 | 例 |
|--------------|------|-----|
| `%` | 0文字以上の任意の文字列 | `'田%'` → 「田」で始まる |
| `_` | 任意の1文字 | `'田_'` → 「田」+ 1文字 |

### 前方一致（〜で始まる）

```sql
-- 名前が「田」で始まる顧客を取得
SELECT id, name FROM customers
WHERE name LIKE '田%';
```

実行結果：「田中太郎」「田中花子」「田村一郎」が返る

### 後方一致（〜で終わる）

```sql
-- メールアドレスが「@example.com」で終わる顧客
SELECT id, name, email FROM customers
WHERE email LIKE '%@example.com';
```

### 部分一致（〜を含む）

```sql
-- 住所に「東京都」を含む顧客
SELECT id, name, address FROM customers
WHERE address LIKE '%東京都%';
```

### `_` で1文字指定

```sql
-- 「田」+ 1文字 + 「太郎」（例：田中太郎、田村太郎など）
SELECT id, name FROM customers
WHERE name LIKE '田_太郎';

-- 5文字ちょうどの名前
SELECT id, name FROM customers
WHERE name LIKE '_____';
```

> **ポイント**  
> `%` は「0文字以上の任意の文字列」なので `'%田%'` は「田」を1文字でも含む文字列に  
> マッチします。`'田%'` なら「田」で始まる文字列にマッチします。

---

## 2. NOT LIKE

`NOT LIKE` は LIKE の否定です。パターンに一致しない行を返します。

```sql
-- gmailアドレスではない顧客
SELECT id, name, email FROM customers
WHERE email NOT LIKE '%@gmail.com';

-- 東京都以外の顧客
SELECT id, name, address FROM customers
WHERE address NOT LIKE '%東京都%';
```

> **注意**  
> `NOT LIKE` を使う場合、NULL の行は結果に含まれません（3値論理のため）。  
> NULL を含めたい場合は `OR address IS NULL` を追加する必要があります。

---

## 3. ILIKE（大文字小文字を無視、PostgreSQL）

PostgreSQL には `ILIKE` という大文字小文字を区別しないパターンマッチングがあります。

```sql
-- 大文字小文字を区別せずに「gmail」を含むメールアドレスを検索
SELECT id, name, email FROM customers
WHERE email ILIKE '%GMAIL%';
-- 「gmail.com」でも「GMAIL.COM」でもマッチする
```

```sql
-- 通常の LIKE は大文字小文字を区別する
SELECT * FROM customers WHERE email LIKE '%GMAIL%';   -- 大文字GMIALのみマッチ
SELECT * FROM customers WHERE email ILIKE '%GMAIL%';  -- 大文字小文字両方マッチ
```

> **ポイント**  
> `ILIKE` は PostgreSQL 独自の機能です。他のDBでは `LOWER()` 関数を使って  
> `WHERE LOWER(email) LIKE '%gmail%'` のように書きます。  
> ただし、関数を使うとインデックスが効かなくなるため注意が必要です。

---

## 4. LIKE のインデックスが効く条件

LIKE はインデックス（索引）が効く場合と効かない場合があります。

```sql
-- インデックスが効く（前方一致）
WHERE name LIKE '田%'

-- インデックスが効かない（後方一致・部分一致）
WHERE name LIKE '%田'
WHERE name LIKE '%田%'
```

### なぜ前方一致しかインデックスが効かないのか

インデックスはアルファベット順（辞書順）のような形で構築されます。  
「田中」「田村」「田口」は辞書で「田」のページを開けばまとめて見つかります（前方一致）。  
しかし「〜田」を含む全文字列は辞書のどこに散らばっているか分からないため、  
全ページをめくって確認するしかありません（全テーブルスキャン）。

```sql
-- データ量が多い場合は後方一致・部分一致は避けるか、全文検索を検討する
-- PostgreSQLならGINインデックスやpg_trgm拡張を使う方法もある

-- pg_trgm を使った部分一致インデックス
CREATE INDEX idx_customers_name_trgm ON customers
USING GIN (name gin_trgm_ops);
```

> **注意**  
> 数百万件以上のデータに対して `LIKE '%キーワード%'` を使うと非常に遅くなります。  
> 全文検索が必要な場合は PostgreSQL の全文検索機能や Elasticsearch などを検討しましょう。

> **現場メモ**  
> ユーザーの自由入力キーワードで商品を検索する機能で `LIKE '%キーワード%'` を使っていたところ、商品データが数十万件になった時点でAPIのタイムアウトが頻発しました。EXPLAINを見るとフルテーブルスキャンになっていました。その場では `pg_trgm` 拡張のGINインデックスを追加して対処しましたが、本来は設計段階で全文検索の要件を認識してElasticsearchやPostgreSQLの全文検索を採用すべきでした。検索機能を実装する際は「データが増えても耐えられるか」を必ずレビューで確認するようにしています。

---

## 5. IN / NOT IN の使い方

`IN` は複数の値のいずれかと一致する行を返します。  
複数の `OR` 条件をシンプルに書けます。

```sql
-- OR を使った書き方（冗長）
SELECT id, name FROM customers
WHERE address LIKE '%東京都%'
   OR address LIKE '%大阪府%'
   OR address LIKE '%神奈川県%';

-- IN を使った書き方（スッキリ）
SELECT id, name, prefecture FROM customers
WHERE prefecture IN ('東京都', '大阪府', '神奈川県');
```

### 数値での使い方

```sql
-- 特定のIDの商品を取得
SELECT id, name, price FROM products
WHERE id IN (1, 3, 5, 7);
```

### サブクエリと組み合わせる

```sql
-- 注文が存在する顧客のIDリストを取得してから顧客情報を取得
SELECT id, name FROM customers
WHERE id IN (
    SELECT DISTINCT customer_id FROM orders
);
```

---

## 6. IN に NULL が含まれる時の落とし穴

`NOT IN` のサブクエリに NULL が含まれると、結果が0件になります。

```sql
-- ordersテーブルのcustomer_idにNULLが含まれているとする
-- この場合、NOT INは全行を除外してしまう（0件になる）
SELECT id, name FROM customers
WHERE id NOT IN (
    SELECT customer_id FROM orders  -- NULLが含まれるかもしれない
);
```

### なぜ0件になるのか

`NOT IN` は内部的に「= ANY の否定」として動作します。  
`id NOT IN (1, 2, NULL)` は `id <> 1 AND id <> 2 AND id <> NULL` と同等です。  
`id <> NULL` は UNKNOWN になるため、WHERE を通過しません。

```sql
-- 正しい対処法：NULL を除外する
SELECT id, name FROM customers
WHERE id NOT IN (
    SELECT customer_id FROM orders
    WHERE customer_id IS NOT NULL  -- NULL を除外
);

-- または EXISTS を使う（後述）
SELECT id, name FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.customer_id = c.id
);
```

> **注意**  
> `NOT IN` + サブクエリの組み合わせは、NULL が含まれると意図しない結果になる  
> 代表的なバグの原因です。サブクエリを使う場合は `NOT EXISTS` の使用を検討しましょう。

---

## 7. BETWEEN ... AND ...（両端含む）

`BETWEEN` は範囲を指定して絞り込みます。**両端の値を含む**（inclusive）点に注意してください。

```sql
-- 価格が100円以上300円以下の商品を取得
SELECT id, name, price FROM products
WHERE price BETWEEN 100 AND 300;

-- ↑ 以下と同等
SELECT id, name, price FROM products
WHERE price >= 100 AND price <= 300;
```

### 日付での使い方

```sql
-- 2024年1月中の注文を取得
SELECT id, order_date, amount FROM orders
WHERE order_date BETWEEN '2024-01-01' AND '2024-01-31';
```

> **ポイント**  
> BETWEEN の両端は含まれます（以上・以下）。  
> `BETWEEN 100 AND 300` は「100以上300以下」であり「100より大きく300より小さい」ではありません。

### 日付の BETWEEN 注意点

```sql
-- TIMESTAMP型の場合、'2024-01-31' は '2024-01-31 00:00:00' と解釈される
-- 2024-01-31 23:59:59 のデータが漏れる可能性がある
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';

-- より安全な書き方
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-02-01';  -- 翌月の00:00:00未満
```

---

## 8. NOT BETWEEN

`NOT BETWEEN` は BETWEEN の否定です。

```sql
-- 価格が100円未満、または300円より高い商品
SELECT id, name, price FROM products
WHERE price NOT BETWEEN 100 AND 300;

-- ↑ 以下と同等
SELECT id, name, price FROM products
WHERE price < 100 OR price > 300;
```

---

## 9. EXISTS / NOT EXISTS の概念と使い方

`EXISTS` はサブクエリが1件以上の行を返すかどうかを確認します。

```sql
-- 注文が存在する顧客の情報を取得
SELECT id, name FROM customers c
WHERE EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);
```

`EXISTS` の動作：
1. `customers` テーブルを1行ずつ読む
2. その行に対してサブクエリを実行する
3. サブクエリが1件でも返せば `TRUE`、0件なら `FALSE`

```sql
-- NOT EXISTS：注文が1件も存在しない顧客を取得
SELECT id, name FROM customers c
WHERE NOT EXISTS (
    SELECT 1
    FROM orders o
    WHERE o.customer_id = c.id
);
```

> **ポイント**  
> EXISTS の SELECT リストは何でも構いません。`SELECT 1`・`SELECT *`・`SELECT 'x'`  
> すべて同じ意味です。一般的には `SELECT 1` が可読性のためによく使われます。

---

## 10. EXISTS vs IN（パフォーマンスと意味の違い）

### 意味の違い

```sql
-- IN：サブクエリの結果リストに一致するか
SELECT id, name FROM customers
WHERE id IN (SELECT customer_id FROM orders);

-- EXISTS：サブクエリが1件以上返すか（相関サブクエリ）
SELECT id, name FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

この2つは多くの場合同じ結果を返しますが、NULL の扱いが異なります。

### NULL の扱いの違い

```sql
-- IN：サブクエリにNULLが含まれるとNOT INで問題が発生する（前述）
SELECT * FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);  -- NULLが含まれると0件

-- NOT EXISTS：NULLの問題が発生しない（安全）
SELECT * FROM customers c
WHERE NOT EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

### パフォーマンスの違い

現代の PostgreSQL では、クエリオプティマイザが `IN` と `EXISTS` を  
適切に最適化するため、大きな差はないことが多いです。  
ただし、一般論として：

| ケース | 推奨 |
|--------|------|
| サブクエリの結果が少ない場合 | IN |
| サブクエリの結果が多い場合 | EXISTS |
| NOT の場合 | NOT EXISTS（NULL 問題を回避） |

> **ポイント**  
> 迷ったら `EXISTS` を使うと安全です。特に `NOT EXISTS` は  
> `NOT IN` よりも NULL に関する落とし穴がなく、意図した通りに動きます。

> **現場メモ**  
> 「注文したことがない顧客一覧」を取得する処理で `NOT IN (SELECT customer_id FROM orders)` と書かれたコードがありました。テストデータでは問題なく動いていましたが、本番移行後に `orders` テーブルへの特定のデータ投入タイミングで `customer_id` に NULL が混入したことで、全顧客が結果から消えてしまいました。このパターンはSQLの最も有名な落とし穴の一つです。`NOT IN` + サブクエリは書いてはいけないパターンとして覚えておいてください。代わりに `NOT EXISTS` か `LEFT JOIN ... IS NULL` を使います。

---

## 11. よくあるミスと対処法

### ミス1: BETWEEN の両端を間違える

```sql
-- 「1月より大きく3月より小さい」のつもりが両端を含んでしまう
SELECT * FROM orders WHERE month BETWEEN 1 AND 3;
-- 実際には 1月・2月・3月 すべて含まれる（1以上3以下）

-- 両端を含まない範囲が欲しい場合は > と < を使う
SELECT * FROM orders WHERE month > 1 AND month < 3;  -- 2月のみ
```

### ミス2: LIKE で特殊文字をそのまま使う

```sql
-- % や _ を検索したい場合はエスケープが必要
-- 「50%」という文字列を検索する
SELECT * FROM products WHERE description LIKE '%50\%%' ESCAPE '\';

-- _ をリテラルとして検索する
SELECT * FROM products WHERE code LIKE 'A\_001' ESCAPE '\';
```

### ミス3: IN のリストに誤った型を混入させる

```sql
-- 文字列型の列に数値を混ぜると暗黙変換が起きる
SELECT * FROM products WHERE category IN ('果物', 1);  -- 型不一致

-- 型を統一する
SELECT * FROM products WHERE category IN ('果物', '野菜');
```

### ミス4: IN のリストが膨大になる

```sql
-- 数万件のIDリストをINに渡すのは非効率
WHERE id IN (1, 2, 3, ... 10000個 ...);

-- 一時テーブルや JOIN を使う方が効率的
SELECT c.*
FROM customers c
JOIN temp_target_ids t ON c.id = t.id;
```

> **注意**  
> `IN` のリストが数百を超えるような場合は、一時テーブルや unnest 関数を使う  
> ことでパフォーマンスが改善することがあります。

---

## 12. PRレビューのチェックポイント

- [ ] `LIKE '%keyword%'` の部分一致を大量データに使っていないか（インデックスが効かない）
- [ ] `NOT IN (SELECT ...)` パターンを使っていないか（NULLが混入すると全件除外になる）
- [ ] `IN` のリストが動的に増える可能性がある場合、上限を考慮しているか
- [ ] `BETWEEN` の日付範囲でTIMESTAMP型の月末（23:59:59）が漏れていないか
- [ ] `ILIKE` を使う場合、他DBへの移植性を考慮しているか（PostgreSQL専用）
- [ ] 検索機能の件数が将来大幅に増えてもパフォーマンスが維持できるか

---

## 13. まとめ

| テーマ | 要点 |
|--------|------|
| LIKE の `%` | 0文字以上の任意の文字列にマッチ |
| LIKE の `_` | 任意の1文字にマッチ |
| ILIKE | 大文字小文字を無視するパターンマッチ（PostgreSQL専用） |
| LIKE のインデックス | 前方一致のみインデックスが効く |
| IN | 複数の候補値のいずれかに一致する行を返す |
| NOT IN と NULL | サブクエリにNULLが含まれると0件になる落とし穴がある |
| BETWEEN | 両端を含む範囲指定（以上・以下） |
| 日付の BETWEEN | TIMESTAMP型は範囲の終端に注意が必要 |
| EXISTS | サブクエリが1件以上返すかを確認する |
| NOT EXISTS | NULL の問題を回避できる NOT IN の代替 |
