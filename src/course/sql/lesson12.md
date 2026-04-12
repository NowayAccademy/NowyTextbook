# VIEW
VIEWで複雑なSELECTに名前をつけ、再利用可能にします

## 本章の目標

本章では以下を目標にして学習します。

- VIEWとは何かを説明できること
- CREATE VIEWで仮想テーブルを作成・管理できること
- VIEWのメリット（再利用性・セキュリティ）を理解できること
- 通常VIEWとマテリアライズドビューの違いを理解できること
- VIEWの使いすぎによるパフォーマンス問題を把握できること

---

## 1. VIEWとは（仮想テーブル）

### VIEWの概念

**VIEW（ビュー）**は、SELECTクエリに名前をつけてデータベースに保存したものです。実際のデータを持たず、参照されるたびに元のSELECTが実行されます。そのため「**仮想テーブル**」とも呼ばれます。

身近な例で例えると、図書館の「新着本コーナー」のようなものです。実際に本が移動しているわけではなく、「新着の本を並べた棚」というラベルが付いた参照先に過ぎません。でも利用者はその棚を見るだけで目的の本を探せます。

```sql
-- テーブル準備
CREATE TABLE products (
    product_id   INT PRIMARY KEY,
    product_name TEXT,
    category     TEXT,
    price        INT,
    stock        INT
);

CREATE TABLE order_details (
    detail_id  INT PRIMARY KEY,
    product_id INT,
    quantity   INT,
    ordered_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO products VALUES
    (1, 'りんご',   '果物', 150, 100),
    (2, 'みかん',   '果物', 100, 200),
    (3, 'にんじん', '野菜',  80, 150),
    (4, 'キャベツ', '野菜',  200, 80),
    (5, 'バナナ',   '果物', 120, 50);

INSERT INTO order_details VALUES
    (1, 1, 3, '2024-03-01 10:00:00'),
    (2, 2, 5, '2024-03-02 11:00:00'),
    (3, 1, 2, '2024-03-03 09:00:00'),
    (4, 3, 4, '2024-03-04 14:00:00'),
    (5, 5, 1, '2024-03-05 16:00:00');
```

> **ポイント**  
> VIEWはデータのコピーではありません。VIEWを参照するたびに元テーブルからデータが取得されるため、元テーブルのデータが変わればVIEWの結果も自動的に最新になります。

---

## 2. CREATE VIEW の構文

### VIEWを作成する

```sql
-- 基本構文
CREATE VIEW ビュー名 AS
SELECT ...;

-- 実例: 果物商品の一覧ビュー
CREATE VIEW fruits_view AS
SELECT product_id, product_name, price, stock
FROM products
WHERE category = '果物';

-- VIEWを使う（通常のテーブルと同じように使える）
SELECT * FROM fruits_view;

-- VIEWに対してWHEREやORDER BYも使える
SELECT product_name, price
FROM fruits_view
WHERE price > 110
ORDER BY price DESC;
```

### 複雑なクエリにVIEWをつける

```sql
-- 商品別の注文合計を計算する複雑なクエリ
CREATE VIEW product_sales_summary AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    p.price,
    COALESCE(SUM(od.quantity), 0)        AS total_ordered,
    COALESCE(SUM(od.quantity * p.price), 0) AS total_revenue
FROM products p
LEFT JOIN order_details od ON p.product_id = od.product_id
GROUP BY p.product_id, p.product_name, p.category, p.price;

-- 作成後はシンプルに参照できる
SELECT * FROM product_sales_summary ORDER BY total_revenue DESC;
```

> **ポイント**  
> VIEWを使うことで、複雑なJOINやGROUP BYを毎回書かずに済みます。SQLを書く人全員がこのVIEW名を使えば、計算ロジックを統一できます。

---

## 3. CREATE OR REPLACE VIEW

### 既存VIEWを更新する

VIEWの定義を変更したい場合、`CREATE OR REPLACE VIEW` を使うと既存のVIEWを置き換えられます。

```sql
-- 既存のVIEWを上書き更新
CREATE OR REPLACE VIEW fruits_view AS
SELECT
    product_id,
    product_name,
    price,
    stock,
    price * stock AS inventory_value  -- 新しい列を追加
FROM products
WHERE category = '果物';

-- 確認
SELECT * FROM fruits_view;
```

### VIEWの定義を確認する

```sql
-- VIEWの定義を確認
SELECT definition
FROM pg_views
WHERE viewname = 'fruits_view';

-- または
\d+ fruits_view  -- psqlコマンドラインツールの場合
```

> **注意**  
> `CREATE OR REPLACE VIEW` はWHERE句や列の追加は可能ですが、既存の列を削除したり型を変更したりはできません。その場合はいったん `DROP VIEW` してから再作成する必要があります。

---

## 4. VIEWのメリット（複雑なクエリの隠蔽・セキュリティ）

### メリット1: 複雑なクエリの隠蔽と再利用

```sql
-- 毎回書くのが大変な複雑なクエリ
-- （JOINが多い、サブクエリが多い、計算が複雑など）
-- これをVIEWにすれば1行で使える

-- ビュー: 月次売上レポート（複雑な計算をカプセル化）
CREATE VIEW monthly_sales_report AS
SELECT
    DATE_TRUNC('month', od.ordered_at) AS month,
    p.category,
    COUNT(DISTINCT od.detail_id) AS transaction_count,
    SUM(od.quantity)              AS total_quantity,
    SUM(od.quantity * p.price)    AS total_revenue,
    AVG(od.quantity * p.price)    AS avg_order_value
FROM order_details od
INNER JOIN products p ON od.product_id = p.product_id
GROUP BY DATE_TRUNC('month', od.ordered_at), p.category;

-- 利用は簡単
SELECT * FROM monthly_sales_report
WHERE month = '2024-03-01'
ORDER BY total_revenue DESC;
```

### メリット2: セキュリティ（列・行の制限）

```sql
-- 給与テーブル（機密情報を含む）
CREATE TABLE salary_info (
    emp_id     INT PRIMARY KEY,
    emp_name   TEXT,
    salary     INT,
    bonus      INT,
    bank_account TEXT  -- 機密情報
);

INSERT INTO salary_info VALUES
    (1, '田中', 500000, 50000, '0001-001-1234567'),
    (2, '鈴木', 600000, 60000, '0002-002-9876543');

-- 機密情報を除いたビューを作成
CREATE VIEW safe_salary_view AS
SELECT emp_id, emp_name, salary
FROM salary_info;
-- bank_account は含めない！

-- 一般ユーザーにはビューだけアクセス権を与える
-- GRANT SELECT ON safe_salary_view TO general_user;

SELECT * FROM safe_salary_view;  -- bank_accountは見えない
```

> **ポイント**  
> VIEWはセキュリティ管理のツールとしても使えます。ユーザーに直接テーブルへのアクセスを与えず、必要な列・行だけを見せるVIEWへのアクセスのみ許可することで、情報漏洩リスクを下げられます。

---

## 5. VIEWへのSELECT

### VIEWは通常テーブルと同じように使える

```sql
-- WHERE句
SELECT product_name, total_revenue
FROM product_sales_summary
WHERE total_revenue > 500;

-- ORDER BY
SELECT *
FROM product_sales_summary
ORDER BY total_ordered DESC
LIMIT 3;

-- 別のVIEWやテーブルとJOINも可能
SELECT
    ps.product_name,
    ps.total_revenue,
    f.stock  -- fruitsビューのstock列
FROM product_sales_summary ps
INNER JOIN fruits_view f ON ps.product_id = f.product_id;

-- VIEWに対してCOUNTなどの集計も可能
SELECT COUNT(*), AVG(total_revenue)
FROM product_sales_summary;
```

> **ポイント**  
> VIEWはSELECTの観点では通常テーブルと全く同じように扱えます。JOINすることも、WHERE/GROUP BY/ORDER BYを使うことも、別のVIEWのFROMに書くことも可能です。

---

## 6. VIEWの更新（updatable viewの条件）

### 更新可能なVIEW（Updatable View）

VIEWに対してINSERT/UPDATE/DELETEを行うには、VIEWが**更新可能（updatable）**である必要があります。以下の条件をすべて満たす必要があります：

- FROM句にテーブルが1つだけ（JOINなし）
- DISTINCT なし
- GROUP BY / HAVING なし
- UNION / INTERSECT / EXCEPT なし
- 集計関数（SUM, AVG等）なし
- ウィンドウ関数なし
- サブクエリが列参照を含まない

```sql
-- 更新可能なシンプルなVIEW
CREATE VIEW simple_fruits AS
SELECT product_id, product_name, price, stock
FROM products
WHERE category = '果物';

-- VIEWを通じてUPDATE（元テーブルが変わる）
UPDATE simple_fruits
SET price = 180
WHERE product_name = 'りんご';

-- 元テーブルを確認すると価格が変わっている
SELECT * FROM products WHERE product_name = 'りんご';

-- VIEWを通じてINSERT
INSERT INTO simple_fruits (product_id, product_name, price, stock)
VALUES (6, 'ぶどう', 300, 30);
-- 注意: categoryが指定できないのでNULLになる
-- WITH CHECK OPTION を使うと条件外の挿入を防げる

-- WITH CHECK OPTIONで整合性を保つ
CREATE OR REPLACE VIEW simple_fruits AS
SELECT product_id, product_name, price, stock
FROM products
WHERE category = '果物'
WITH CHECK OPTION;  -- category='果物'でない行の挿入を防ぐ
```

> **注意**  
> JOINやGROUP BYを含む複雑なVIEWは更新不可です。更新可能かどうかを確認するには `pg_views` の `is_updatable` 列を参照できます。実務ではVIEWへの直接更新は避け、元テーブルを直接操作する方が安全です。

---

## 7. DROP VIEW（CASCADE）

### VIEWを削除する

```sql
-- 基本的な削除
DROP VIEW fruits_view;

-- VIEWが存在しない場合でもエラーを出さない
DROP VIEW IF EXISTS fruits_view;

-- 依存するオブジェクト（他のVIEWや関数）も一緒に削除
DROP VIEW fruits_view CASCADE;
-- 注意: CASCADEは依存先も削除するため慎重に使う

-- RESTRICT（デフォルト）: 依存先がある場合はエラー
DROP VIEW fruits_view RESTRICT;

-- VIEWの一覧を確認
SELECT viewname, viewowner
FROM pg_views
WHERE schemaname = 'public';
```

> **注意**  
> `CASCADE` を使うと、そのVIEWを参照している他のVIEWや関数もすべて削除されます。本番環境では必ず依存関係を確認してから削除しましょう。

---

## 8. マテリアライズドビュー（MATERIALIZED VIEW）の概念

### 通常VIEWとの違い

通常のVIEWは「参照するたびに元のSELECTを実行する仮想テーブル」ですが、**マテリアライズドビュー（MATERIALIZED VIEW）**は「クエリの結果を実際にディスクに保存する物理テーブル」です。

| 比較項目 | 通常VIEW | マテリアライズドビュー |
|----------|----------|----------------------|
| データ保存 | しない（毎回クエリ実行） | する（結果をキャッシュ） |
| 読み取り速度 | 元クエリの速度に依存 | 高速（保存済みデータを読む） |
| 最新性 | 常に最新 | REFRESH時のみ更新 |
| 書き込みオーバーヘッド | なし | REFRESHのコスト |
| インデックス | 付けられない | 付けられる |

```sql
-- マテリアライズドビューの作成
CREATE MATERIALIZED VIEW product_sales_mat AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    COALESCE(SUM(od.quantity), 0)           AS total_ordered,
    COALESCE(SUM(od.quantity * p.price), 0) AS total_revenue
FROM products p
LEFT JOIN order_details od ON p.product_id = od.product_id
GROUP BY p.product_id, p.product_name, p.category, p.price;

-- 参照（通常テーブルと同じ）
SELECT * FROM product_sales_mat ORDER BY total_revenue DESC;

-- マテリアライズドビューにインデックスを追加できる
CREATE INDEX idx_mat_category ON product_sales_mat (category);
```

> **ポイント**  
> 重い集計クエリを毎回実行したくない場合、マテリアライズドビューに保存しておくと参照が高速になります。ただしデータは自動更新されないため、手動または定期的なREFRESHが必要です。

---

## 9. マテリアライズドビューのリフレッシュ（REFRESH MATERIALIZED VIEW）

### データを更新する

```sql
-- 元テーブルのデータを変更
INSERT INTO order_details VALUES (6, 4, 10, NOW());

-- マテリアライズドビューは自動更新されない（古いデータのまま）
SELECT * FROM product_sales_mat WHERE product_id = 4;

-- REFRESHで手動更新
REFRESH MATERIALIZED VIEW product_sales_mat;

-- 更新後に確認
SELECT * FROM product_sales_mat WHERE product_id = 4;

-- REFRESH中もSELECT可能にする（ロックなしで更新）
-- ただし一意なインデックスが必要
CREATE UNIQUE INDEX idx_mat_product_id ON product_sales_mat (product_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_mat;
-- CONCURRENTLYを使うと更新中もVIEWが参照できる（一意インデックス必須）
```

### 定期的なREFRESHの設定

```sql
-- PostgreSQLにはスケジュール実行機能がないため、
-- pg_cronやcronジョブで定期実行するのが一般的

-- pg_cronの例（毎時0分にREFRESH）
-- SELECT cron.schedule('0 * * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_mat$$);

-- または外部のcronジョブから
-- psql -d mydb -c "REFRESH MATERIALIZED VIEW CONCURRENTLY product_sales_mat"
```

> **ポイント**  
> `CONCURRENTLY` オプションを使うとREFRESH中もSELECTできます（ロックなし）。ただし一意インデックスが必要で、初回のCONCURRENT REFRESHはできません（通常のREFRESH後にCONCURRENTLYが使えます）。

---

## 10. VIEWを使いすぎる危険（ネストが深くなるとパフォーマンス問題）

### ネストしたVIEWの問題

```sql
-- VIEWがVIEWを参照するとネストが深くなる
CREATE VIEW view_a AS
SELECT * FROM products WHERE category = '果物';

CREATE VIEW view_b AS
SELECT * FROM view_a WHERE price > 100;  -- view_aを参照

CREATE VIEW view_c AS
SELECT * FROM view_b WHERE stock > 50;  -- view_bを参照（view_a → products）

-- view_cへのクエリは実際には3段階展開される
SELECT * FROM view_c;
-- → SELECT * FROM (SELECT * FROM (SELECT * FROM products WHERE ...) WHERE ...) WHERE ...
```

### パフォーマンス問題の例

```sql
-- 問題のあるパターン: 複雑なVIEWをさらにJOINする
-- products_summary_view（複雑な集計含む）
-- ↓
-- top_products_view（products_summary_viewを参照）
-- ↓
-- final_report_view（top_products_viewとその他のビューをJOIN）

-- このような多段VIEWは、最終的に何十本もJOINされた巨大クエリになる

-- 対策: VIEWの代わりにマテリアライズドビューを使う
-- 対策: VIEWのネストは3段以内に抑える
-- 対策: 複雑な中間処理はCTEやアプリケーション層で処理する

-- EXPLAINで展開後のクエリを確認する
EXPLAIN SELECT * FROM product_sales_summary;
```

> **注意**  
> VIEWはクエリを隠蔽してくれますが、その内部では毎回元のSELECTが実行されます。複数のVIEWが積み重なると、実行時に何十テーブルもJOINされた巨大クエリが走ることになり、パフォーマンスが著しく低下します。「VIEWが3つ以上ネストしたら要注意」と覚えておきましょう。

> **現場メモ**  
> VIEWは便利ですが「VIEWに変更を加えたら依存するVIEWが壊れた」という問題が起きることがあります。VIEW Aを変更したらVIEW AをJOINしているVIEW Bがエラーになり、さらにVIEW BをSELECTしているアプリコードが動かなくなる、という連鎖崩壊です。筆者が関わったプロジェクトでは多段VIEWが10本以上あり、どのVIEWがどのVIEWに依存しているかの把握が困難になっていました。`pg_depend` や `information_schema.view_column_usage` でVIEWの依存関係を確認する習慣を持ちましょう。また、マテリアライズドビューのREFRESHタイミングもよく問題になります。「最新データが出ない」という報告が来て調べたら、マテリアライズドビューのREFRESHが止まっていた、という事象は珍しくありません。

---

## 11. よくあるミス

### ミス1: VIEWのデータが古いと思って困惑する

```sql
-- 通常VIEWは常に最新（毎回クエリが実行される）
-- マテリアライズドビューはREFRESHしないと古い

-- 確認: 今参照しているのは通常VIEWか？マテリアライズドか？
SELECT schemaname, matviewname  -- マテリアライズドビューの一覧
FROM pg_matviews
WHERE schemaname = 'public';

SELECT schemaname, viewname  -- 通常VIEWの一覧
FROM pg_views
WHERE schemaname = 'public';
```

### ミス2: 更新不可なVIEWに対してUPDATEしてエラー

```sql
-- JOINを含むVIEWには直接UPDATEできない
-- CREATE VIEW product_order_view AS
-- SELECT p.product_name, od.quantity
-- FROM products p JOIN order_details od ON p.product_id = od.product_id;

-- UPDATE product_order_view SET quantity = 10;  -- エラー！

-- 解決策: 元テーブルを直接UPDATEする
UPDATE order_details SET quantity = 10 WHERE detail_id = 1;
```

### ミス3: DROP VIEW で依存先が消える

```sql
-- 誤ってCASCADEを付けると依存するVIEWも全削除
-- DROP VIEW base_view CASCADE;  -- base_viewを参照するVIEWも全部消える！

-- 安全な確認方法: まず依存関係を調べる
SELECT DISTINCT
    dependent_view.relname AS dependent_view
FROM pg_depend
INNER JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
INNER JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
INNER JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
WHERE source_table.relname = 'fruits_view'
  AND source_table.relkind = 'v';
```

### ミス4: SELECT * をVIEWに使う

```sql
-- 悪い例: SELECT * のVIEW
-- CREATE VIEW all_products AS SELECT * FROM products;
-- products テーブルに列を追加しても、CREATE OR REPLACEしないと新しい列が出ない場合がある

-- 良い例: 明示的に列を指定
CREATE OR REPLACE VIEW all_products AS
SELECT product_id, product_name, category, price, stock
FROM products;
```

> **注意**  
> VIEWに `SELECT *` を使うと、元テーブルの列が変わったときに予期しない動作をすることがあります。列名を明示的に指定するのが安全です。

---

## 12. PRレビューのチェックポイント

- [ ] **VIEW のネストが 3 段以上になっていないか**
  - 多段 VIEW はパフォーマンス劣化の原因。EXPLAIN で展開後のクエリを確認する
- [ ] **VIEW 内で `SELECT *` を使っていないか**
  - テーブルにカラムを追加したとき VIEW が古い定義のままになる
- [ ] **更新可能な VIEW（Updatable View）に意図しない INSERT / UPDATE をしていないか**
  - VIEW への書き込みが意図通りに元テーブルに反映されるか確認する
- [ ] **マテリアライズドビューの REFRESH タイミングが要件と合っているか**
  - 「リアルタイムに最新データが必要か」「1時間遅延でも許容できるか」を確認
- [ ] **DROP VIEW CASCADE を使う前に依存先の VIEW / クエリを確認しているか**
  - CASCADE は依存する VIEW も連鎖削除する

---

## 13. まとめ

| テーマ | 要点 |
| --- | --- |
| VIEWとは | SELECTに名前をつけて保存した仮想テーブル。データは持たない |
| CREATE VIEW | `CREATE VIEW 名前 AS SELECT ...` |
| CREATE OR REPLACE | 既存VIEWを更新（列の削除・型変更は不可） |
| VIEWのメリット | 複雑クエリの再利用・セキュリティ（列/行の隠蔽）|
| 更新可能VIEW | JOIN/GROUP BY/集計なしのシンプルなVIEWのみ更新可能 |
| DROP VIEW | `CASCADE` は依存先も削除するため慎重に使う |
| マテリアライズドビュー | 結果をディスクに保存。高速だが手動REFRESHが必要 |
| REFRESH | `REFRESH MATERIALIZED VIEW [CONCURRENTLY]` で更新 |
| 使いすぎの危険 | VIEWのネストが深いと実行時に巨大クエリになりパフォーマンス低下 |
| よくあるミス | SELECT *使用・更新不可VIEWへのUPDATE・CASCADE削除 |
