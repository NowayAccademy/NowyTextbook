# JOINの基本
テーブルを結合する概念を理解し、INNER JOIN・LEFT JOINを使いこなします

## 本章の目標

本章では以下を目標にして学習します。

- なぜ JOIN が必要かを説明できること
- INNER JOIN と LEFT JOIN の違いを理解し、使い分けられること
- テーブルエイリアス（AS）を使ってクエリを簡潔に書けること
- ON 句と WHERE 句の違いを説明できること
- 1対多の JOIN で行が増える現象を理解できること
- USING 句を使って同名列で結合できること

---

## 1. なぜ JOIN が必要か

データベースでは、データを「テーブルに分けて保存する（正規化）」のが基本です。  
たとえば EC サイトのデータを考えてみましょう。

### 正規化されていない場合（NG）

| order_id | customer_name | customer_email        | product | amount |
|----------|--------------|-----------------------|---------|--------|
| 1        | 田中 太郎    | tanaka@example.com    | りんご  | 1500   |
| 2        | 田中 太郎    | tanaka@example.com    | バナナ  | 800    |
| 3        | 鈴木 花子    | suzuki@example.com    | みかん  | 1200   |

「田中 太郎」さんのメールアドレスが変わったとき、2行すべてを更新しなければなりません。  
更新漏れがあると「同じ顧客なのにデータが矛盾する」という問題が起きます。

### 正規化されている場合（OK）

**customers テーブル**

| id  | name      | email               |
|-----|-----------|---------------------|
| 101 | 田中 太郎 | tanaka@example.com  |
| 102 | 鈴木 花子 | suzuki@example.com  |

**orders テーブル**

| id | customer_id | product | amount |
|----|-------------|---------|--------|
| 1  | 101         | りんご  | 1500   |
| 2  | 101         | バナナ  | 800    |
| 3  | 102         | みかん  | 1200   |

メールアドレスは customers テーブルの1か所だけに保存されています。  
変更があっても1行だけ更新すれば OK です。

**このように分割されたテーブルを組み合わせて使うのが JOIN の役割です。**

> **ポイント**  
> JOIN は「複数のテーブルを外部キーで結びつけて、1つの結果として取り出す」機能です。  
> SQL のなかで最も重要な機能の1つであり、実務でほぼ必ず使います。

---

## 2. JOIN の概念（ベン図で説明）

JOIN の種類をベン図で整理すると理解しやすいです。

```
テーブル A                テーブル B
┌─────────────┐         ┌─────────────┐
│  A にしか   │  共通   │  B にしか   │
│  ない行     │  部分   │  ない行     │
└─────────────┘         └─────────────┘

INNER JOIN : 共通部分のみ（両方に一致する行）
LEFT JOIN  : A の全行 + 共通部分（B に一致しない A の行も含む）
RIGHT JOIN : B の全行 + 共通部分（A に一致しない B の行も含む）
FULL OUTER JOIN : A と B の全行
```

本章ではよく使う **INNER JOIN** と **LEFT JOIN** を中心に学びます。

以下のサンプルテーブルを使います。

```sql
-- 顧客テーブル
CREATE TABLE customers (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT NOT NULL
);

INSERT INTO customers (id, name, email) VALUES
(101, '田中 太郎', 'tanaka@example.com'),
(102, '鈴木 花子', 'suzuki@example.com'),
(103, '山田 次郎', 'yamada@example.com'),
(104, '佐藤 三郎', 'sato@example.com');   -- 注文なし

-- 注文テーブル
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    product     TEXT,
    amount      INTEGER,
    order_date  DATE
);

INSERT INTO orders (id, customer_id, product, amount, order_date) VALUES
(1, 101, 'りんご',  1500, '2024-01-05'),
(2, 101, 'バナナ',   800, '2024-01-10'),
(3, 102, 'みかん',  1200, '2024-02-03'),
(4, 103, 'ぶどう',  3000, '2024-02-08'),
(5, 999, 'いちご',  2500, '2024-03-01');  -- customer_id=999 は customers に存在しない
```

---

## 3. INNER JOIN の構文と動作

INNER JOIN は **両テーブルに一致する行のみ** を返します。

### 基本構文

```sql
SELECT 列名
FROM テーブルA
INNER JOIN テーブルB ON テーブルA.結合キー = テーブルB.結合キー;
```

`INNER` は省略可能です。`JOIN` だけでも INNER JOIN として動作します。

### 例：顧客名と注文を一緒に取得する

```sql
SELECT
    orders.id          AS order_id,
    customers.name     AS customer_name,
    orders.product,
    orders.amount
FROM orders
INNER JOIN customers ON orders.customer_id = customers.id;
```

実行結果：

| order_id | customer_name | product | amount |
|----------|--------------|---------|--------|
| 1        | 田中 太郎    | りんご  | 1500   |
| 2        | 田中 太郎    | バナナ  | 800    |
| 3        | 鈴木 花子    | みかん  | 1200   |
| 4        | 山田 次郎    | ぶどう  | 3000   |

注目点：
- 佐藤 三郎（id=104）は注文がないため、結果に含まれません
- customer_id=999 の注文（id=5）は customers に存在しないため、結果に含まれません

> **ポイント**  
> INNER JOIN は「両テーブルに対応するレコードがある行のみ」返します。  
> どちらかにしか存在しない行は結果から除外されます。

> **現場メモ**  
> INNER JOIN を使うということは「両テーブルに必ずデータが存在する」という前提を置くことになります。あるプロジェクトで「ユーザーは必ずプロフィールを持つはず」と INNER JOIN を使っていたところ、プロフィール未設定のユーザーがレポートから完全に消えていたインシデントがありました。本番データは「あるはず」が崩れることがあります。INNER JOIN を選ぶ際は「本当に両テーブルに対応するデータが保証されているか」をスキーマと運用の両面で確認することをお勧めします。

---

## 4. テーブルエイリアスの使い方

テーブル名が長い場合、毎回フルネームを書くのは大変です。  
`AS` を使って短い別名（エイリアス）を付けられます。

```sql
-- AS を使ったエイリアス（AS は省略可能）
SELECT
    o.id          AS order_id,
    c.name        AS customer_name,
    o.product,
    o.amount
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id;
```

`AS` は省略できます（`orders o` と書いても同じです）。

> **ポイント**  
> テーブルエイリアスは JOIN を使うクエリで特によく使います。  
> `u`（users）、`o`（orders）、`p`（products）のように、  
> テーブル名の頭文字を使うのが慣習です。

> **現場メモ**  
> エイリアスの命名はチームで統一することを強くお勧めします。あるチームでは `c` が customers を指すと思ったら contracts を指していた、という混乱が実際に起きました。筆者のチームでは「テーブルの頭文字2〜3文字を使う（customers → cu、contracts → co）」というルールにしてから、読み間違いが大幅に減りました。また、エイリアスを使わずにテーブルのフルネームで書いたクエリは、JOIN が2〜3個になった途端に読みにくくなります。新しい JOIN を追加するタイミングでエイリアスを導入しておくのが良い習慣です。

---

## 5. ON 句の書き方

ON 句には結合条件を書きます。基本は「外部キー = 主キー」ですが、複数条件も書けます。

```sql
-- 基本：外部キー = 主キー
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.id

-- 複数条件（AND で繋ぐ）
FROM order_details AS od
INNER JOIN products AS p
    ON od.product_id = p.id
    AND od.version   = p.version

-- 不等号も使える（通常の JOIN ではあまり使わない）
FROM a
INNER JOIN b ON a.value BETWEEN b.min_val AND b.max_val
```

> **注意**  
> ON 句に条件を書くと、JOIN の段階で絞り込まれます。  
> これは WHERE 句で絞り込むのと似ていますが、LEFT JOIN では挙動が変わります（後述）。

---

## 6. LEFT JOIN

LEFT JOIN は **左テーブル（FROM に書いたテーブル）の全行を返し**、  
右テーブルに一致する行がない場合は NULL で補完します。

### 構文

```sql
SELECT 列名
FROM テーブルA           -- 左テーブル（全行返る）
LEFT JOIN テーブルB ON テーブルA.キー = テーブルB.キー;
```

### 例：注文のない顧客も含めて全顧客を取得する

```sql
SELECT
    c.id           AS customer_id,
    c.name         AS customer_name,
    o.id           AS order_id,
    o.product,
    o.amount
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id;
```

実行結果：

| customer_id | customer_name | order_id | product | amount |
|-------------|--------------|----------|---------|--------|
| 101         | 田中 太郎    | 1        | りんご  | 1500   |
| 101         | 田中 太郎    | 2        | バナナ  | 800    |
| 102         | 鈴木 花子    | 3        | みかん  | 1200   |
| 103         | 山田 次郎    | 4        | ぶどう  | 3000   |
| 104         | 佐藤 三郎    | NULL     | NULL    | NULL   |

佐藤 三郎（注文なし）も結果に含まれ、orders 側の列は NULL になっています。

### 注文のない顧客だけを絞り込む

LEFT JOIN で NULL になった行を WHERE で絞ることで、「対応データがない行」だけを抽出できます。

```sql
-- 一度も注文していない顧客を抽出
SELECT
    c.id   AS customer_id,
    c.name AS customer_name
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id
WHERE o.id IS NULL;   -- 右テーブルの主キーが NULL = 一致なし
```

実行結果：

| customer_id | customer_name |
|-------------|--------------|
| 104         | 佐藤 三郎    |

> **ポイント**  
> `LEFT JOIN ... WHERE 右テーブルの列 IS NULL` というパターンは  
> 「A にあって B にない行」を取得する定番テクニックです。  
> 覚えておきましょう。

> **現場メモ**  
> 新しいメンバーが INNER JOIN を使うべき場面で LEFT JOIN を使い、NULL 行がレポートに混入するバグがありました。逆に「確実に存在するはず」と思って INNER JOIN を使ったら、稀に存在しないデータがあってレコードが消えるバグも見ています。「どちらのテーブルにデータが欠ける可能性があるか」を意識するのが大事です。面接でも「INNER JOIN と LEFT JOIN の違いは何ですか、どう使い分けますか」という質問はよく出ます。答えるときは「テーブルにデータが必ず存在するかどうか」という観点で説明すると説得力が出ます。

---

## 7. RIGHT JOIN

RIGHT JOIN は LEFT JOIN と左右対称で、**右テーブルの全行を返します**。

```sql
-- LEFT JOIN で書き直せる
SELECT c.name, o.product
FROM customers AS c
RIGHT JOIN orders AS o ON c.id = o.customer_id;

-- 上と同じ結果（LEFT JOIN で書き直し）
SELECT c.name, o.product
FROM orders AS o
LEFT JOIN customers AS c ON o.customer_id = c.id;
```

> **ポイント**  
> RIGHT JOIN は LEFT JOIN でテーブルの順番を入れ替えることで表現できます。  
> そのため、コードの可読性を統一するために **LEFT JOIN だけを使う** という規約を持つ  
> チームが多いです。実務では RIGHT JOIN よりも LEFT JOIN の方が圧倒的によく使われます。

---

## 8. 結合で行が増える罠（1対多の JOIN）

1対多のリレーションで JOIN すると、行数が増えることがあります。  
これは意図した動作の場合もありますが、集計を誤る原因になることもあります。

### 例：1人の顧客が複数の注文を持つ場合

```sql
-- 田中 太郎（id=101）は2件の注文がある
SELECT c.name, o.product, o.amount
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
WHERE c.id = 101;
```

| name      | product | amount |
|-----------|---------|--------|
| 田中 太郎 | りんご  | 1500   |
| 田中 太郎 | バナナ  | 800    |

`customers` では1行だった田中 太郎が、JOIN 後は2行になっています。

### 集計で誤るパターン

```sql
-- NG：JOIN 後に SUM すると行が増えた分だけ合計が変わる（意図した結果になるが要注意）
SELECT
    c.name,
    SUM(o.amount) AS total_amount
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id
GROUP BY c.name;
```

これ自体は正しいですが、さらに別の JOIN を重ねると意図せず行が「爆発的」に増えることがあります。

> **注意**  
> JOIN を追加するたびに、結果の行数がどう変わるかを意識しましょう。  
> 「なぜか集計値がおかしい」と感じたら、まず JOIN 後の行数を COUNT(*) で確認してください。

> **現場メモ**  
> 1対多の JOIN が絡む集計バグは、筆者が見てきた中でも特に発見が遅れやすいバグです。「顧客ごとの購入合計金額」を出すクエリに、後からタグ付けテーブルを JOIN したところ、1つの注文に複数のタグが付いていたため行数が倍増し、集計額が2倍になっていたという事例があります。数値がおかしいと気づくまでに数日かかりました。JOIN を追加するたびに `SELECT COUNT(*) FROM ...` で行数を確認する習慣を身につけることを強くお勧めします。

---

## 9. JOIN と WHERE の違い（ON 条件と WHERE 条件）

ON 句の条件と WHERE 句の条件は、**LEFT JOIN を使うときに挙動が異なります**。

### ON に条件を書いた場合（LEFT JOIN では全行残る）

```sql
-- ON に条件を書く → LEFT JOIN なので customers の全行が残る
SELECT c.name, o.product, o.amount
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
    AND o.amount >= 2000;   -- ON に条件
```

実行結果：

| name      | product | amount |
|-----------|---------|--------|
| 田中 太郎 | NULL    | NULL   |
| 鈴木 花子 | NULL    | NULL   |
| 山田 次郎 | ぶどう  | 3000   |
| 佐藤 三郎 | NULL    | NULL   |

LEFT JOIN なので customers の全行が返ります。  
`amount >= 2000` の条件は「どの orders 行を結合するか」にのみ影響します。

### WHERE に条件を書いた場合（全行には戻らない）

```sql
-- WHERE に条件を書く → INNER JOIN と同じ動作になる
SELECT c.name, o.product, o.amount
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id
WHERE o.amount >= 2000;   -- WHERE に条件
```

実行結果：

| name      | product | amount |
|-----------|---------|--------|
| 山田 次郎 | ぶどう  | 3000   |

WHERE で絞り込まれるため、`amount` が NULL（注文なし）の行も除外されてしまいます。  
事実上 INNER JOIN と同じ動作になります。

> **注意**  
> LEFT JOIN を使う目的が「右テーブルに一致しない行も含めたい」なら、  
> 右テーブルへの絞り込み条件は **ON に書く** のが正しい書き方です。  
> WHERE に書くと LEFT JOIN の意味がなくなります。

> **現場メモ**  
> これは筆者がレビューで最もよく指摘する誤りの一つです。「LEFT JOIN を使っているのに WHERE 句に右テーブルの条件がある」というコードを見たら、意図通りか必ず確認してください。書いた本人は「LEFT JOIN にしたのになぜ NULL 行が出ないんだろう」と悩んでいることが多いです。また、仕様変更で INNER JOIN を LEFT JOIN に変えたとき、WHERE 句の条件を ON に移動し忘れてバグが残る事例も経験しました。JOIN の種類を変える際は WHERE 句も一緒に見直す習慣をつけてください。

---

## 10. USING 句

結合するキー列の **名前が両テーブルで同じ** 場合、`USING` 句で簡潔に書けます。

```sql
-- ON を使った書き方
SELECT o.id, c.name, o.product
FROM orders AS o
INNER JOIN customers AS c ON o.customer_id = c.customer_id;

-- USING を使った書き方（結合列名が同じ場合のみ）
SELECT o.id, c.name, o.product
FROM orders AS o
INNER JOIN customers AS c USING (customer_id);
```

> **ポイント**  
> USING を使うと、結合列が結果に1列だけ現れます（重複しません）。  
> ON を使うと両テーブルの列が別々に存在します。  
> チームのコーディング規約に合わせて使い分けましょう。

---

## 11. よくあるミスと対処法

### ミス1：JOIN で行が増えることに気づかない

```sql
-- orders に複数行ある場合、customers の行が増えて見える
SELECT COUNT(*) FROM customers;               -- 4行
SELECT COUNT(*) FROM customers
INNER JOIN orders ON customers.id = orders.customer_id;  -- 4行より多くなる
```

**対処法：** JOIN 後に行数を確認する。  
集計クエリがおかしいと感じたら `SELECT COUNT(*)` で行数を確認しましょう。

### ミス2：テーブル名を付けずに列名が曖昧になる

```sql
-- NG：id がどちらのテーブルの id か不明（エラーになる）
SELECT id, name, product
FROM customers
INNER JOIN orders ON customers.id = orders.customer_id;
-- ERROR: column reference "id" is ambiguous
```

**対処法：** テーブルエイリアスを使って列名を明示する。

```sql
-- OK
SELECT c.id, c.name, o.product
FROM customers AS c
INNER JOIN orders AS o ON c.id = o.customer_id;
```

### ミス3：LEFT JOIN が INNER JOIN になってしまう

```sql
-- NG：WHERE に右テーブルの列の条件を書くと LEFT JOIN の意味がなくなる
SELECT c.name, o.product
FROM customers AS c
LEFT JOIN orders AS o ON c.id = o.customer_id
WHERE o.order_date > '2024-01-01';   -- 注文なし顧客（NULL）も除外される
```

**対処法：** 「右テーブルのない行も含めたい」なら条件は ON に書く。

```sql
-- OK
SELECT c.name, o.product
FROM customers AS c
LEFT JOIN orders AS o
    ON c.id = o.customer_id
    AND o.order_date > '2024-01-01';
```

### ミス4：ON の条件が逆になって全行マッチしてしまう（デカルト積）

```sql
-- NG：ON 条件を忘れた場合（カンマ結合の古い書き方も同様）
SELECT c.name, o.product
FROM customers, orders;   -- 全組み合わせが返る（4×5=20行）
```

**対処法：** 必ず JOIN の ON 句を正しく書く。  
結果行数が急激に増えた場合はデカルト積（クロス結合）を疑いましょう。

---

## 12. 現場での使い分け

JOIN の種類を選ぶ際に、現場で筆者が使っている判断フローを紹介します。

### INNER JOIN を選ぶとき

- 結合先テーブルにデータが必ず存在することがスキーマ（外部キー制約など）で保証されている
- 結合先にデータがない行は結果に含めたくない（含めると意味をなさない）
- 例：注文と商品マスタを結合するとき（商品マスタに存在しない商品は注文できない設計）

### LEFT JOIN を選ぶとき

- 結合先テーブルにデータがない可能性がある
- NULL でもよいので左テーブルの全行を保持したい
- 例：ユーザーと設定テーブルを結合するとき（設定を一度もしていないユーザーも取得したい）
- 例：未購入ユーザーを含むレポートを出したいとき

### 判断に迷ったら

LEFT JOIN を選んでおく方が安全です。INNER JOIN はデータの欠損があると行が消えるため、本番データの揺れに対して LEFT JOIN の方が壊れにくいクエリになります。ただし NULL が混入することを意識した実装（NULL チェックや COALESCE）が必要です。

---

## 13. PRレビューのチェックポイント

JOIN を含む SQL をレビューするときに確認すべき観点をまとめます。自分が書いたクエリのセルフレビューにも使えます。

### 結合の種類

- [ ] INNER JOIN と LEFT JOIN の選択は意図的か？「なぜ INNER JOIN（または LEFT JOIN）を使ったか」を説明できるか
- [ ] LEFT JOIN を使っているのに WHERE 句に右テーブルの NULL になりうる列の条件がないか（意図せず INNER JOIN 化していないか）
- [ ] RIGHT JOIN を使っているなら LEFT JOIN に書き直せないか（可読性の統一）

### 行数・集計

- [ ] 1対多の JOIN を含む場合、行が増えることを意図しているか
- [ ] 集計（SUM / COUNT / AVG）を使っている場合、JOIN 後の行数が正しいか確認したか
- [ ] 複数の1対多 JOIN が重なっていて行数が爆発していないか

### 可読性

- [ ] テーブルエイリアスはチームの命名規則に沿っているか
- [ ] エイリアスが省略されている箇所はなく、すべての列に `テーブル名.列名` または `エイリアス.列名` が付いているか
- [ ] JOIN が3つ以上ある場合、CTE に分割して読みやすくできないか（lesson9 参照）

### ON 句

- [ ] ON 句の結合条件は正しいキーで結合しているか
- [ ] 誤った ON 条件や ON 句の書き忘れによってデカルト積が発生していないか

---

## 14. まとめ

| テーマ | 要点 |
| --- | --- |
| JOIN の目的 | 正規化されたテーブルを外部キーで結合し、まとめて取得する |
| INNER JOIN | 両テーブルに一致する行のみ返す。どちらかに存在しない行は除外 |
| LEFT JOIN | 左テーブルの全行を返す。右テーブルに一致しない場合は NULL |
| RIGHT JOIN | 右テーブルの全行を返す。LEFT JOIN の左右入れ替えで代替可能 |
| テーブルエイリアス | AS で短い別名を付ける。複数テーブルのクエリで可読性が上がる |
| ON 句 | 結合条件を書く場所。LEFT JOIN では ON の条件は結合行の選択のみに影響 |
| WHERE 句 | 結合後の全行に適用。LEFT JOIN + WHERE は事実上 INNER JOIN になることがある |
| USING 句 | 結合列名が同じとき使える簡潔な書き方 |
| 行が増える罠 | 1対多の JOIN では行が増える。集計がおかしいと感じたら行数を確認 |
| よくあるミス | 列名の曖昧さ / WHERE で LEFT JOIN を無効化 / デカルト積 |
| 現場での使い分け | 結合先データが保証されているなら INNER JOIN、不確かなら LEFT JOIN |
