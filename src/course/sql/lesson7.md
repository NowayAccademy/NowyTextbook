# UPDATE と DELETE
データを安全に更新・削除するための書き方と事故防止の考え方を学びます

## 本章の目標

本章では以下を目標にして学習します。

- UPDATE の基本構文で特定の行のデータを更新できること
- WHERE なし UPDATE の危険性を理解し、事故を防げること
- DELETE の基本構文で特定の行を削除できること
- TRUNCATE と DELETE の違いを説明できること
- トランザクションを使って安全に更新・削除ができること
- 論理削除パターンを実装できること

---

## 1. UPDATE の基本構文

UPDATE 文は既存の行のデータを変更します。

```sql
UPDATE テーブル名
SET 列1 = 値1, 列2 = 値2
WHERE 条件;
```

本章で使うサンプルテーブルを用意します。

```sql
-- 商品テーブル
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    price       INTEGER NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    category    TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    deleted_at  TIMESTAMP
);

INSERT INTO products (code, name, price, stock, category) VALUES
('APPLE-001', 'りんご',   150, 100, '果物'),
('BANANA-001', 'バナナ',  120,  80, '果物'),
('CARROT-001', 'にんじん', 60,  90, '野菜'),
('SPINACH-001', 'ほうれん草', 80, 60, '野菜'),
('BEEF-001', '牛肉',     1200,  20, '肉類');

-- 注文テーブル
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL,
    order_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    status      TEXT NOT NULL DEFAULT '受付中'
);

INSERT INTO orders (product_id, quantity, order_date, status) VALUES
(1, 5,  '2024-01-05', '完了'),
(2, 3,  '2024-01-10', '受付中'),
(3, 10, '2024-02-03', '完了'),
(1, 2,  '2024-02-08', '受付中'),
(5, 1,  '2024-03-01', '完了');
```

### 例：りんごの価格を 150 → 180 に変更する

```sql
UPDATE products
SET price = 180
WHERE code = 'APPLE-001';
```

### 例：複数列を同時に更新する（後述のセクション3）

```sql
UPDATE products
SET
    price    = 180,
    stock    = 90,
    category = '国産果物'
WHERE code = 'APPLE-001';
```

> **ポイント**  
> UPDATE を実行する前に、必ず WHERE 条件を確認しましょう。  
> WHERE を書き忘れると、テーブルの **全行** が更新されてしまいます。

---

## 2. WHERE なし UPDATE の危険性

WHERE を指定しないと、テーブルの全行が更新されます。

```sql
-- NG：これはすべての商品価格が 0 になる（全行更新）
UPDATE products
SET price = 0;
-- 5行すべて更新される！
```

```sql
-- このように実行するつもりだったとしても...
UPDATE products
SET price = 0
-- WHERE を書き忘れた！
;
```

> **注意**  
> WHERE を書き忘れた UPDATE は、取り消しできません（トランザクション外の場合）。  
> 本番データで誤って全行更新してしまった事故は実際に起きています。  
> 後述する「事故防止パターン」を必ず実践しましょう。

> **現場メモ**  
> `UPDATE products SET price = 0` をWHERE句なしで実行して全商品の価格が0円になった、という事故は現場では本当に起きます。「たった1行のミスが数万件のデータを吹き飛ばす」のがUPDATE/DELETEの怖さです。筆者も新人のころ、本番でWHERE句を書き忘れて全行更新してしまい、バックアップから復元するという経験をしました。それ以来、本番DBで手動SQLを実行するときは必ず「① SELECTで対象行を確認 → ② BEGINでトランザクション開始 → ③ UPDATE/DELETE実行 → ④ 件数とデータを目視確認 → ⑤ COMMIT」という手順を必ず踏むようにしています。ツールによっては「safe-update mode」（WHERE句のないUPDATE/DELETEを拒否する設定）も活用できます。

### 安全のための確認手順

```sql
-- 手順1：まず SELECT で対象行を確認する
SELECT id, code, name, price
FROM products
WHERE code = 'APPLE-001';   -- これで1行だけ返ってくるか確認

-- 手順2：確認できたら UPDATE を実行する
UPDATE products
SET price = 180
WHERE code = 'APPLE-001';
```

---

## 3. 複数列の同時更新

SET 句にカンマ区切りで複数列を並べることで、1つの UPDATE で複数列を更新できます。

```sql
-- 複数列を一度に更新
UPDATE products
SET
    price    = 200,
    stock    = 150,
    category = '特選果物'
WHERE id = 1;
```

```sql
-- 現在の値に基づいた計算で更新
UPDATE products
SET
    price = price * 1.1,           -- 現在の価格の 1.1 倍（値上げ10%）
    stock = stock - 5              -- 在庫を5減らす
WHERE category = '果物'
  AND stock > 5;                   -- 在庫が5以上の商品のみ
```

> **ポイント**  
> `SET 列名 = 列名 + 値` のように現在の値を参照した計算もできます。  
> これは在庫の加減算や、カウンタの増減によく使われます。

---

## 4. UPDATE ... FROM（別テーブルを参照した更新）

別テーブルのデータを参照して UPDATE できます。  
PostgreSQL 特有の `UPDATE ... FROM` 構文を使います。

### 例：注文テーブルから数量を取得して在庫を減らす

```sql
-- 完了した注文の数量だけ在庫を減らす
UPDATE products AS p
SET stock = p.stock - o.quantity
FROM orders AS o
WHERE p.id = o.product_id
  AND o.status = '完了'
  AND o.order_date = CURRENT_DATE;
```

### 例：別テーブルのマスタ価格を反映する

```sql
-- 価格マスタテーブルの価格を商品テーブルに反映する
CREATE TABLE price_master (
    product_code TEXT PRIMARY KEY,
    new_price    INTEGER NOT NULL
);

INSERT INTO price_master VALUES
('APPLE-001',  200),
('BANANA-001', 130);

-- price_master の価格で products を更新
UPDATE products AS p
SET price = pm.new_price
FROM price_master AS pm
WHERE p.code = pm.product_code;
```

> **ポイント**  
> `UPDATE ... FROM` は PostgreSQL の拡張です。  
> 標準 SQL のサブクエリ方式（`UPDATE ... SET 列 = (SELECT ...)  WHERE ...`）でも同じことができます。  
> PostgreSQL では FROM を使った方が可読性が高くなることが多いです。

---

## 5. RETURNING 句（更新後の値を確認）

INSERT と同様に、UPDATE でも RETURNING 句で更新後の値を取得できます。

```sql
-- 更新後の値を返す
UPDATE products
SET price = price * 1.1
WHERE category = '果物'
RETURNING id, code, name, price AS new_price;
```

実行結果イメージ：

| id | code        | name   | new_price |
|----|-------------|--------|-----------|
| 1  | APPLE-001   | りんご | 198       |
| 2  | BANANA-001  | バナナ | 132       |

```sql
-- 更新前の値と更新後の値を比較する（サブクエリを使う）
WITH updated AS (
    UPDATE products
    SET price = price * 1.1
    WHERE category = '果物'
    RETURNING id, code, name, price AS new_price
)
SELECT
    u.code,
    u.name,
    p.price                    AS old_price,
    u.new_price
FROM updated AS u
JOIN products AS p ON u.id = p.id;
```

> **ポイント**  
> RETURNING を使うと UPDATE 後の値を確認できます。  
> アプリケーション側で「更新後の値をすぐ使いたい」場合に、追加の SELECT が不要です。

---

## 6. DELETE の基本構文

DELETE 文は行を削除します。

```sql
DELETE FROM テーブル名
WHERE 条件;
```

### 例：特定の商品を削除する

```sql
-- id = 5 の商品を削除する
DELETE FROM products
WHERE id = 5;
```

```sql
-- 在庫ゼロの商品をすべて削除する
DELETE FROM products
WHERE stock = 0;
```

> **ポイント**  
> 外部キー参照がある場合（orders が products を参照している等）、  
> 参照されている行を DELETE しようとすると外部キー制約エラーになります。  
> 先に子テーブルの行を削除してから親テーブルを削除するか、  
> `ON DELETE CASCADE` を設定する必要があります。

---

## 7. WHERE なし DELETE の危険性

WHERE を指定しないと、テーブルの **全行** が削除されます。

```sql
-- NG：これはテーブルの全行が削除される！
DELETE FROM products;
-- 5行すべて削除される！
```

> **注意**  
> WHERE なし DELETE は本番環境で絶対に避けなければならない操作です。  
> 削除したデータはトランザクション外では復元できません。  
> 必ず WHERE 条件を付け、事前に SELECT で対象行を確認してから実行しましょう。

---

## 8. DELETE ... USING（別テーブルを参照した削除）

別テーブルの条件を参照して削除できます。

```sql
-- キャンセルされた注文の商品を削除する例
-- （実務ではこういうケースは論理削除で対応するのが一般的）
DELETE FROM orders AS o
USING products AS p
WHERE o.product_id = p.id
  AND p.is_active = FALSE
  AND o.status = '受付中';
```

```sql
-- 30日以上前に完了した注文を削除する
DELETE FROM orders
WHERE status = '完了'
  AND order_date < CURRENT_DATE - INTERVAL '30 days';
```

> **ポイント**  
> DELETE ... USING は PostgreSQL の拡張構文です。  
> 標準 SQL では `DELETE FROM テーブル WHERE 列 IN (SELECT ...)` のように書きます。

---

## 9. TRUNCATE vs DELETE

テーブルの全データを消去したい場合、DELETE と TRUNCATE の2つの方法があります。

| 比較項目 | DELETE（WHERE なし） | TRUNCATE |
|---------|---------------------|---------|
| 速度 | 遅い（行を1行ずつ処理） | 速い（ページ単位で削除） |
| ロールバック | 可能 | 可能（PostgreSQL ではトランザクション内なら） |
| RETURNING 句 | 使える | 使えない |
| トリガー | 発火する | TRUNCATE トリガーのみ発火（ROW レベルトリガーは非発火） |
| 自動採番リセット | されない | RESTART IDENTITY でリセット可能 |
| 外部キー参照 | エラーになる | CASCADE を指定しないとエラー |

```sql
-- TRUNCATE の基本（全行削除）
TRUNCATE TABLE products;

-- TRUNCATE + シーケンスリセット
TRUNCATE TABLE products RESTART IDENTITY;

-- 外部キー参照のある関連テーブルも含めて削除
TRUNCATE TABLE products CASCADE;
```

> **注意**  
> PostgreSQL では TRUNCATE もトランザクション内であればロールバックできます。  
> しかし MySQL では TRUNCATE は暗黙の COMMIT を発行するため、ロールバックできません。  
> DB の種類によって挙動が異なる点に注意しましょう。

---

## 10. 事故防止パターン

実務での更新・削除は「一発でやらない」ことが大原則です。  
以下のパターンを必ず守りましょう。

### 黄金パターン：SELECT → BEGIN → DML → 確認 → COMMIT

```sql
-- ステップ1：まず SELECT で対象行を確認する
SELECT id, code, name, price
FROM products
WHERE category = '果物';
-- → 期待通りの行が返ってきているか確認

-- ステップ2：トランザクションを開始する
BEGIN;

-- ステップ3：UPDATE または DELETE を実行する
UPDATE products
SET price = price * 1.2
WHERE category = '果物';
-- UPDATE 2 のように影響行数が表示される

-- ステップ4：結果を SELECT で確認する
SELECT id, code, name, price FROM products WHERE category = '果物';
-- → 値が正しく変わっているか確認

-- ステップ5：問題なければ COMMIT、おかしければ ROLLBACK
COMMIT;    -- 確定
-- または
ROLLBACK;  -- 取り消し
```

> **注意**  
> `BEGIN` なしで DML を実行すると、即座にコミットされます（オートコミット）。  
> 取り消しができないため、特に本番環境では必ず BEGIN から始めましょう。

### WHERE 条件の件数確認パターン

```sql
-- WHERE 条件に一致する件数を先に確認する
SELECT COUNT(*) FROM products WHERE category = '果物';
-- → 2件

-- 件数が想定通りなら UPDATE を実行
UPDATE products SET price = price * 1.2 WHERE category = '果物';
-- UPDATE 2 ← 件数が一致しているか確認
```

---

## 11. 論理削除の実装パターン

「削除」といっても、実際には行を消さずに「削除フラグ」を立てるだけの設計があります。  
これを **論理削除** といいます。

### 論理削除とは

| 物理削除 | 論理削除 |
|---------|---------|
| DELETE で行を消す | is_deleted = TRUE や deleted_at = NOW() を設定 |
| データは復元不可（バックアップから戻すしかない） | フラグを戻せばデータが復元できる |
| ストレージを節約できる | 削除済みデータが残るためストレージを消費 |
| 参照整合性を保ちやすい | 常に WHERE deleted_at IS NULL を付けなければならない |

### 実装例：deleted_at 列による論理削除

```sql
-- 削除する（deleted_at に現在時刻を入れる）
UPDATE products
SET deleted_at = NOW()
WHERE id = 3;

-- 有効なレコードのみ取得（常に WHERE deleted_at IS NULL が必要）
SELECT id, code, name, price
FROM products
WHERE deleted_at IS NULL;

-- 削除済みのレコードを復元する
UPDATE products
SET deleted_at = NULL
WHERE id = 3;
```

### ビューで隠ぺいする

毎回 `WHERE deleted_at IS NULL` を書くのを忘れると、削除済みデータが混入します。  
ビューを使ってデフォルトで除外する設計が有効です。

```sql
-- 有効な商品のみを返すビュー
CREATE VIEW active_products AS
SELECT *
FROM products
WHERE deleted_at IS NULL;

-- ビューから SELECT すれば条件不要
SELECT id, code, name, price
FROM active_products;
```

> **ポイント**  
> 論理削除を採用する場合のデメリット：  
> - クエリに常に `WHERE deleted_at IS NULL` が必要（忘れるとバグの原因）  
> - テーブルが肥大化する（定期的なアーカイブが必要）  
> - 外部キー制約が「論理削除済みのレコードを参照しているか」を検知しない  
> 
> 論理削除が適しているのは「削除履歴を残したい」「誤削除を復元したい」場合です。  
> 要件に応じて物理削除と使い分けましょう。

---

## 12. よくあるミス

### ミス1：WHERE を付けずに全行更新・削除

```sql
-- NG（全行更新）
UPDATE products SET price = 0;

-- NG（全行削除）
DELETE FROM products;
```

**対処法：** 必ず BEGIN してから実行し、ROLLBACK できる状態にしておく。  
WHERE 条件を先に SELECT で確認する。

### ミス2：外部キー制約エラー

```sql
-- NG：orders が product_id=1 を参照しているため削除できない
DELETE FROM products WHERE id = 1;
-- ERROR: update or delete on table "products" violates foreign key constraint...
```

**対処法：** 先に子テーブルの参照行を削除するか、論理削除を使う。

```sql
-- OK：先に子テーブルの行を削除
DELETE FROM orders WHERE product_id = 1;
DELETE FROM products WHERE id = 1;
```

### ミス3：UPDATE で SET を忘れる

```sql
-- NG：文法エラー
UPDATE products
price = 180       -- SET が抜けている
WHERE id = 1;
```

**対処法：** `UPDATE テーブル SET 列=値 WHERE 条件` の順番を覚える。

### ミス4：RETURNING を付けたまま本番実行して結果を確認し忘れる

RETURNING を付けて実行すると、更新結果が返ってきます。  
「結果を見て問題があった」と気づいてもすでに COMMIT 済みのことがあります。  
必ず BEGIN → 実行 → RETURNING で確認 → COMMIT の順番を守りましょう。

### ミス5：論理削除のフィルタを忘れる

```sql
-- NG：deleted_at IS NULL がないため削除済みも含む
SELECT * FROM products WHERE category = '果物';
```

**対処法：** ビューを作成して論理削除フィルタを一元化する。

---

## 13. ポイント

### UPDATE / DELETE の安全確認

- **WHERE 句がない UPDATE / DELETE になっていないか**
  - WHERE 句なしは全行対象になる。意図的な全件操作でもコメントで明示する
- **UPDATE / DELETE の前に SELECT で対象行数を確認する手順があるか**
  - 本番手動実行時は「SELECT → BEGIN → DML → 確認 → COMMIT」の手順を必ず踏む
- **大量行の UPDATE / DELETE をトランザクション1つで実行しようとしていないか**
  - ロック時間とロールバック時間を考慮してバッチ処理に分割する

### 論理削除・物理削除

- **DELETE を使っている箇所が本当に物理削除すべきデータか確認したか**
  - 監査・トレーサビリティが必要なテーブルには論理削除を使う
- **論理削除テーブルへの SELECT に `deleted_at IS NULL` フィルタが入っているか**

### UPSERT / RETURNING

- **DO NOTHING と DO UPDATE の選択が要件と一致しているか**
  - 競合時に既存データを保持したいのか上書きしたいのかを明確にする
- **RETURNING 句を使う場合、アプリ側で結果を受け取る処理があるか**

---

## 14. まとめ

| テーマ | 要点 |
| --- | --- |
| UPDATE 基本 | `UPDATE テーブル SET 列=値 WHERE 条件` WHERE 必須 |
| WHERE なし UPDATE | 全行が更新される。本番で絶対に避ける |
| 複数列更新 | SET 句にカンマ区切りで複数列を指定 |
| UPDATE ... FROM | 別テーブルを参照した更新。PostgreSQL 拡張 |
| RETURNING 句 | 更新後の値を取得できる。追加 SELECT が不要 |
| DELETE 基本 | `DELETE FROM テーブル WHERE 条件` WHERE 必須 |
| WHERE なし DELETE | 全行が削除される。本番で絶対に避ける |
| DELETE ... USING | 別テーブルを参照した削除 |
| TRUNCATE vs DELETE | TRUNCATE は高速。ロールバック可否はDBに依存 |
| 事故防止パターン | SELECT で確認 → BEGIN → DML → SELECT で確認 → COMMIT |
| 論理削除 | deleted_at = NOW() でフラグ管理。ビューで透過的にフィルタ |
| よくあるミス | WHERE 忘れ / 外部キー制約 / 論理削除フィルタ忘れ |

---

## 練習問題

以下のテーブルを使って解いてください。

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id      INTEGER PRIMARY KEY,
  name    TEXT    NOT NULL,
  balance INTEGER NOT NULL
);
DELETE FROM accounts;
INSERT INTO accounts (id, name, balance) VALUES
  (1, '田中', 50000),
  (2, '鈴木', 120000),
  (3, '佐藤', 30000);

CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY,
  title        TEXT      NOT NULL,
  published_at TIMESTAMP,
  author_id    INTEGER
);
DELETE FROM articles;
INSERT INTO articles (id, title, published_at, author_id)
SELECT
  gs,
  '記事' || gs,
  TIMESTAMP '2024-01-01 00:00:00' + (gs - 1) * INTERVAL '8 hours',
  (gs % 3) + 1
FROM generate_series(1, 100) AS gs;
```

### 問題1: 送金トランザクション

> 参照：[1. UPDATE の基本構文](#1-update-の基本構文) ・ [6. DELETE の基本構文](#6-delete-の基本構文)

`鈴木`（id=2）から `田中`（id=1）へ 20000 円を送金するトランザクションを書いてください。どちらかの UPDATE が失敗したら全体を取り消してください。

<details>
<summary>回答を見る</summary>

```sql
BEGIN;

UPDATE accounts SET balance = balance - 20000 WHERE id = 2;
UPDATE accounts SET balance = balance + 20000 WHERE id = 1;

COMMIT;
```

**解説：** `BEGIN` でトランザクションを開始し、2つの UPDATE を実行します。両方成功したら `COMMIT` で確定します。途中でエラーが発生した場合は `ROLLBACK` を実行すれば全変更が取り消されます。2つの UPDATE を別々のトランザクションで実行すると、片方だけ成功する「部分更新」が起きる可能性があります。

</details>

### 問題2: OFFSET ページング

> 参照：[9. TRUNCATE vs DELETE](#9-truncate-vs-delete)

`articles` テーブルから `published_at` の降順で2ページ目（1ページ10件）を取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT id, title, published_at
FROM articles
ORDER BY published_at DESC
LIMIT 10 OFFSET 10;
```

**解説：** `OFFSET 10` で最初の10件をスキップし、`LIMIT 10` で次の10件を返します。シンプルですが、OFFSET が大きくなるほど先頭からスキャンが必要なため件数が多いテーブルでは遅くなります。

</details>

### 問題3: カーソルベースのページング

> 参照：[11. 論理削除の実装パターン](#11-論理削除の実装パターン)

前のページ最後の記事が `id=50`, `published_at='2024-01-15 12:00:00'` だったとき、次の10件をカーソルベースで取得してください。

<details>
<summary>回答を見る</summary>

```sql
SELECT id, title, published_at
FROM articles
WHERE published_at < '2024-01-15 12:00:00'
   OR (published_at = '2024-01-15 12:00:00' AND id < 50)
ORDER BY published_at DESC, id DESC
LIMIT 10;
```

**解説：** OFFSET の代わりに「前ページ最後の値より小さい行」を WHERE で指定します。インデックスを使って直接該当位置から読み始めるため、ページが深くなっても一定の速度を保てます。`published_at` が同じ行が存在する場合の重複を `id` で区別するのがポイントです。

</details>
