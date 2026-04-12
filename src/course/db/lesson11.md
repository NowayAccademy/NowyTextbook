# インデックスの仕組みと設計
B-Treeインデックスの仕組みを理解し、効果的なインデックス設計を学びます

## 本章の目標

本章では以下を目標にして学習します。

- B-Treeインデックスの仕組みを説明できること
- カーディナリティを意識してインデックスを貼る列を選べること
- 複合インデックスの最左一致の原則を理解し、インデックスが効かないパターンを避けられること

## 1. インデックスがなぜ必要か

### フルテーブルスキャンとは

インデックスのないテーブルに対して `WHERE` で検索すると、データベースはテーブルの**全行を1行ずつ読んで条件に合う行を探します**。これを**フルテーブルスキャン（Seq Scan）**と呼びます。

```sql
-- インデックスなし：全行チェックが必要
SELECT * FROM users WHERE email = 'alice@example.com';
-- 100万行あれば100万行すべて読む
```

本の例えでいうと、「索引（インデックス）のない本から特定のキーワードを探す」のと同じです。本を最初から最後まで全部読まなければなりません。

### インデックスがあると何が変わるか

インデックスは「本の巻末の索引」に相当します。「email が alice@example.com のページ番号」を一瞬で見つけられるようになります。

```
索引なし（100万行）: 100万行スキャン → 遅い
索引あり（100万行）: B-Treeで対数時間検索 → 速い（数ステップで到達）
```

> **ポイント**  
> テーブルの行数が少ない（数百行程度）うちはインデックスがなくても遅く感じません。しかし本番環境では数十万〜数千万行になることがざらにあり、そこで初めて差が出ます。

> **現場メモ**  
> 「開発環境では速かったのに本番で突然遅くなった」というのはインデックス問題の典型です。開発環境のDBにはテストデータが数百件しかなく、インデックスがなくても問題ありません。しかし本番リリース後にデータが数十万件になると、フルスキャンが毎回走り、APIのレスポンスが数秒単位になることがあります。筆者も新機能をリリースした翌日に「検索が遅い」というアラートが来て、インデックス追加で対応したことがあります。リリース前に「本番データ量を想定したらインデックスは十分か」を必ず確認することを推奨します。

## 2. B-Treeインデックスの仕組み

### B-Treeとは

PostgreSQLのデフォルトインデックスは **B-Tree（Balanced Tree）**です。平衡木（バランスのとれた木構造）と呼ばれるデータ構造で、値を整列した状態で管理します。

```
                 [ 50 ]                          ← ルートノード
               /        \
          [ 20, 35 ]   [ 70, 85 ]               ← 内部ノード
         /    |    \    /    |    \
      [1-19][21-34][36-49][51-69][71-84][86-100] ← リーフノード（実データへのポインタ）
```

- **ルートノード**: 木の根（1つだけ）
- **内部ノード**: 検索の分岐点（どちらの枝に進むか判断）
- **リーフノード**: 実際のデータへのポインタ（ヒープタプル位置）を持つ

### 検索の流れ

`WHERE email = 'alice@example.com'` を検索する場合：

1. ルートノードから開始
2. 各ノードで「alice は左か右か」を判断して枝を選ぶ
3. リーフノードに到達したら、そこにある「テーブル上の実際の行位置（ページ番号・オフセット）」を取得
4. その位置から実際の行データを読む

100万件のデータでも、ノードを約20回比較するだけで目的のデータに到達できます（log₂(1,000,000) ≈ 20）。

> **ポイント**  
> B-Treeの特性として「データが常にソートされた状態で管理される」ことが重要です。これにより `=`, `<`, `>`, `BETWEEN`, `ORDER BY` なども効率的に処理できます。

## 3. インデックスを貼ると何が速くなるか

### WHERE句の等価検索・範囲検索

```sql
-- 等価検索（= ）
CREATE INDEX idx_users_email ON users (email);
SELECT * FROM users WHERE email = 'alice@example.com';  -- インデックス使用

-- 範囲検索（<, >, BETWEEN）
CREATE INDEX idx_orders_ordered_at ON orders (ordered_at);
SELECT * FROM orders WHERE ordered_at BETWEEN '2024-01-01' AND '2024-03-31';

-- 前方一致（LIKE 'prefix%'）
CREATE INDEX idx_products_name ON products (name);
SELECT * FROM products WHERE name LIKE 'PostgreSQL%';  -- インデックス使用可
```

### JOINのON条件

```sql
-- JOINのON条件に使われる列にインデックスがあると結合が速くなる
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

SELECT p.name, oi.quantity
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id;  -- product_id のインデックス使用
```

### ORDER BY・DISTINCT

```sql
-- ソートが必要な ORDER BY も B-Tree の整列済み特性で速くなる
CREATE INDEX idx_users_created_at ON users (created_at DESC);
SELECT * FROM users ORDER BY created_at DESC LIMIT 20;
```

> **ポイント**  
> インデックスは SELECT の WHERE / JOIN ON / ORDER BY / GROUP BY で効果を発揮します。主キー（PRIMARY KEY）にはPostgreSQLが自動的にインデックスを作成します。

## 4. カーディナリティとは

### カーディナリティ（Cardinality）

カーディナリティとは、**列に含まれる値の種類の多さ**のことです。

| 列 | 値の例 | カーディナリティ |
| --- | --- | --- |
| `user_id`（主キー） | 1, 2, 3, ... 100万 | 高い（全部違う） |
| `email` | alice@..., bob@..., ... | 高い（全部違う） |
| `prefecture`（都道府県） | 東京都, 大阪府, ... | 中程度（47種類） |
| `status`（状態） | active, inactive | 低い（2種類） |
| `gender` | M, F, NULL | 低い（3種類） |

### カーディナリティとインデックスの関係

- **カーディナリティが高い列**: インデックスが有効に働く  
  → 1つの値に対応する行数が少ないので、絞り込みが大きい

- **カーディナリティが低い列**: インデックスが効きにくい  
  → `WHERE status = 'active'` がテーブルの80%にマッチするなら、フルスキャンとあまり変わらない

```sql
-- カーディナリティが高い → インデックス有効
CREATE INDEX idx_users_email ON users (email);
SELECT * FROM users WHERE email = 'alice@example.com';
-- → 100万行中1行にマッチ → インデックスで爆速

-- カーディナリティが低い → インデックス効果薄
CREATE INDEX idx_users_gender ON users (gender);
SELECT * FROM users WHERE gender = 'M';
-- → 100万行中50万行にマッチ → フルスキャンの方が速いことも
```

> **ポイント**  
> PostgreSQLのクエリプランナーは「このインデックスを使うと速いか、フルスキャンの方が速いか」を統計情報から自動判断します。カーディナリティが低い列にインデックスを貼っても、実際には使われないことがあります。

## 5. インデックスを貼る列の選び方

### インデックスを貼るべき列

| 条件 | 理由 |
| --- | --- |
| WHERE句で頻繁に使われる列 | 検索の絞り込みに直接効く |
| JOINのON条件に使われる外部キー | 結合処理を高速化 |
| ORDER BY / GROUP BY で使う列 | ソート・集計の前処理を省ける |
| カーディナリティが高い列 | 絞り込み効果が大きい |

### インデックスを貼らなくていい列

| 条件 | 理由 |
| --- | --- |
| ほとんど検索されない列 | インデックス維持コストだけかかる |
| カーディナリティが極めて低い列（真偽値など） | 絞り込み効果が小さい |
| 更新が非常に多い列 | INSERT/UPDATE のたびにインデックスを更新するコストが高い |

```sql
-- 実践例：Eコマースの orders テーブル
-- よく使われるインデックス

-- 顧客IDで注文を検索（外部キー）
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

-- 注文日付で絞り込み（範囲検索）
CREATE INDEX idx_orders_ordered_at ON orders (ordered_at);

-- ステータスは低カーディナリティなので単体インデックスより複合が向く
-- CREATE INDEX idx_orders_status ON orders (status);  -- 単体では効果薄
```

### 現場での判断基準

インデックスを貼るか迷ったときは、以下の順で判断することを推奨します。

1. **まずEXPLAINで現状を確認する**（後述）
2. **Seq Scan になっていたら、WHERE句やJOINの列を確認する**
3. **カーディナリティが高く、アクセス頻度が高い列を優先する**
4. **インデックスを追加したら必ずEXPLAINで効いているか確認する**

「インデックスを貼れば速くなる」は正しいですが、「インデックスを貼るほど書き込みが遅くなる」も同様に正しいです。追加時は常にトレードオフを意識してください。

## 6. 複合インデックスの列順（最左一致の原則）

### 複合インデックスとは

複数の列をまとめてインデックスにしたものです。

```sql
-- 複合インデックスの作成
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);
```

### 最左一致の原則

複合インデックス `(A, B, C)` は、以下のようなクエリで使えます：

```sql
-- OK: 左端の列 A から始まっている
WHERE A = 1
WHERE A = 1 AND B = 2
WHERE A = 1 AND B = 2 AND C = 3
WHERE A = 1 AND B BETWEEN 10 AND 20

-- NG: 左端の列 A が含まれていない
WHERE B = 2                    -- Aを飛ばしている → 使えない
WHERE C = 3                    -- Aを飛ばしている → 使えない
WHERE B = 2 AND C = 3          -- Aを飛ばしている → 使えない
```

```sql
-- 実例
CREATE INDEX idx_orders_cust_status_date ON orders (customer_id, status, ordered_at);

-- 使えるクエリ
SELECT * FROM orders WHERE customer_id = 42;
SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped';
SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped' AND ordered_at > '2024-01-01';

-- 使えないクエリ（フルスキャンになる）
SELECT * FROM orders WHERE status = 'shipped';
SELECT * FROM orders WHERE ordered_at > '2024-01-01';
```

### 列順の決め方

```sql
-- 絞り込みが強い列を左に、範囲検索や ORDER BY 用の列を右に
CREATE INDEX idx_orders_customer_date ON orders (customer_id, ordered_at);
-- customer_id = 42 で絞り込んだ後、ordered_at の範囲検索が効く
```

> **ポイント**  
> 複合インデックスでは「最もよく使う検索条件の列から順番に」が基本です。ただし、範囲検索（`BETWEEN`, `<`, `>`）の列は末尾に置くと効果的です。

> **現場メモ**  
> 複合インデックスの列順を間違えてパフォーマンスが改善しなかった経験があります。あるAPIで `(status, customer_id)` という順でインデックスを作成したのですが、実際のクエリは `WHERE customer_id = ? AND status = ?` という形でした。この場合、最左一致の原則により `customer_id` が左にないとインデックスが効きません。EXPLAINで確認すると `Seq Scan` のままでした。インデックスを `(customer_id, status)` に作り直して解決しましたが、列順の重要性を改めて実感しました。**複合インデックスを追加したら、必ずEXPLAINで意図通りに使われているか確認すること**を習慣にしています。面接でも「複合インデックスの列順をどう決めるか」はよく聞かれます。

## 7. インデックスが効かないパターン

### パターン1: 列に関数を適用している

```sql
-- NG: 列に関数を使うとインデックス効果なし
SELECT * FROM users WHERE UPPER(email) = 'ALICE@EXAMPLE.COM';
SELECT * FROM orders WHERE EXTRACT(YEAR FROM ordered_at) = 2024;

-- OK: 値の方を変換する
SELECT * FROM users WHERE email = LOWER('ALICE@EXAMPLE.COM');
SELECT * FROM orders WHERE ordered_at >= '2024-01-01' AND ordered_at < '2025-01-01';

-- 関数インデックスで対応する場合
CREATE INDEX idx_users_email_upper ON users (UPPER(email));
SELECT * FROM users WHERE UPPER(email) = 'ALICE@EXAMPLE.COM';  -- これなら使える
```

### パターン2: 型が一致していない

```sql
-- テーブル定義: user_code TEXT
CREATE TABLE users (user_code TEXT, ...);
CREATE INDEX idx_users_code ON users (user_code);

-- NG: 数値で検索すると型変換が発生してインデックス効かず
SELECT * FROM users WHERE user_code = 12345;   -- 数値リテラル

-- OK: 同じ型（文字列）で検索する
SELECT * FROM users WHERE user_code = '12345';
```

### パターン3: LIKE の前方ワイルドカード

```sql
-- NG: % が先頭にあるとインデックス使えない（後方一致・中間一致）
SELECT * FROM products WHERE name LIKE '%SQL';
SELECT * FROM products WHERE name LIKE '%SQL%';

-- OK: 前方一致（%が末尾）はインデックス使える
SELECT * FROM products WHERE name LIKE 'PostgreSQL%';
```

### パターン4: OR条件（一方のみインデックスあり）

```sql
-- NG: OR の両側の列にインデックスがないと片方しか使われない
SELECT * FROM users WHERE email = 'alice@example.com' OR name = 'Alice';
-- → 両方にインデックスがあれば Bitmap Index Scan で対応できる場合もある

-- OK: UNION に書き換えてそれぞれインデックスを使わせる
SELECT * FROM users WHERE email = 'alice@example.com'
UNION
SELECT * FROM users WHERE name = 'Alice';
```

### パターン5: IS NULL / IS NOT NULL

```sql
-- カーディナリティが低いため効果が薄いことがある
SELECT * FROM users WHERE deleted_at IS NULL;
-- → 未削除行が多い場合はフルスキャンの方が速い

-- 部分インデックスで対応
CREATE INDEX idx_users_deleted_active ON users (user_id)
WHERE deleted_at IS NULL;
```

> **注意**  
> インデックスが「使われているか」は EXPLAIN で確認できます。次章で詳しく学びます。

> **現場メモ**  
> インデックスが効いていないパターンは、EXPLAINを確認するまで気づきにくいです。特に「型が一致していない」パターンは、動的型付け言語からSQLを発行するとき（JavaScriptの数値がSQLに文字列として渡されない場合など）に発生しやすく、気づくのが遅れがちです。「インデックスを貼ったのに速くならない」と思ったら、まず `EXPLAIN (ANALYZE, BUFFERS)` で実際にどのスキャン方法が選ばれているかを確認することを推奨します。

## 8. EXPLAINで実際に確認するフロー

### インデックスを貼ったら必ずEXPLAINで確認する

インデックスを追加した後、実際に使われているかを必ずEXPLAINで確認することを習慣にしてください。

```sql
-- 基本的なEXPLAIN
EXPLAIN SELECT * FROM users WHERE email = 'alice@example.com';

-- より詳細な情報（実際の実行時間、バッファ使用量も確認）
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE email = 'alice@example.com';
```

### 結果の読み方

```
-- インデックスが使われている場合（良い）
Index Scan using idx_users_email on users  (cost=0.43..8.45 rows=1 width=100)
  Index Cond: (email = 'alice@example.com'::text)

-- インデックスが使われていない場合（要確認）
Seq Scan on users  (cost=0.00..18540.00 rows=1000000 width=100)
  Filter: (email = 'alice@example.com'::text)
```

- `Index Scan` または `Index Only Scan` → インデックスが効いている
- `Seq Scan` → フルスキャン。インデックスが使われていない（またはクエリプランナーが使わないと判断した）

### 実際の確認フロー

```sql
-- ステップ1: 現状確認
EXPLAIN SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped';
-- → Seq Scan が出たらインデックスを検討

-- ステップ2: インデックスを追加
CREATE INDEX CONCURRENTLY idx_orders_customer_status ON orders (customer_id, status);

-- ステップ3: インデックスが使われているか確認
EXPLAIN SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped';
-- → Index Scan になっていれば成功

-- ステップ4: 実際の実行時間も確認
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42 AND status = 'shipped';
```

> **現場メモ**  
> 「インデックスを貼ったら必ずEXPLAINで確認する」はチームのルールにしています。インデックスを追加してもEXPLAINが `Seq Scan` のままの場合、列順が間違っている、型が合っていない、カーディナリティが低すぎてクエリプランナーが使わないと判断した、などの原因が考えられます。EXPLAINを確認せずにリリースすると、「インデックス追加したはずなのに本番が遅い」という事態になります。PRにインデックス追加が含まれている場合は、EXPLAINの結果スクリーンショットや実行計画をPRの説明に添付する文化を持つチームもあります。

## 9. インデックスを貼りすぎるデメリット

### INSERT / UPDATE / DELETE が遅くなる

インデックスは「検索」を速くしますが、**データを変更するたびにインデックスも更新**する必要があります。

```
書き込み時のコスト：
  インデックスなし → テーブルに行を追加するだけ
  インデックスあり → テーブルに行を追加 + 全インデックスを更新

  インデックスが10個あれば10個すべて更新
```

```sql
-- バッチ処理では一時的にインデックスを削除することも（大量INSERT時）
DROP INDEX idx_large_table_column;
-- 大量INSERT実行
CREATE INDEX idx_large_table_column ON large_table (column);
```

> **現場メモ**  
> 「インデックスを追加したらINSERTが遅くなった」という経験があります。あるバッチ処理で毎日数十万件のデータを一括INSERTしていたのですが、機能追加に伴いインデックスを5つ追加したところ、バッチの処理時間が2倍以上に延びました。読み取り（SELECT）は確かに速くなりましたが、書き込み（INSERT）のコストが見落とされていました。特に書き込みが多いテーブルにインデックスを追加するときは、INSERTやUPDATEへの影響も必ず測定することを推奨します。インデックス数は「読み取り性能」と「書き込み性能」のトレードオフであることを常に意識してください。

### ストレージを消費する

インデックスはテーブルとは別にディスクを消費します。テーブルよりインデックスの方がストレージを使うケースもあります。

### 使われないインデックスの確認

```sql
-- 使われていないインデックスを確認する（pg_stat_user_indexes）
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS 使用回数
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY tablename;
```

> **ポイント**  
> 「とりあえずインデックスを貼っておく」はアンチパターンです。使われないインデックスは書き込みを遅くするだけの負債になります。

## 10. CREATE INDEX構文（CONCURRENTLYオプション）

### 基本構文

```sql
-- 基本的なインデックス作成
CREATE INDEX idx_users_email ON users (email);

-- 降順インデックス
CREATE INDEX idx_orders_created_desc ON orders (created_at DESC);

-- 複合インデックス
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

-- 部分インデックス（条件付き）
CREATE UNIQUE INDEX idx_users_email_active ON users (email)
WHERE deleted_at IS NULL;

-- ユニークインデックス
CREATE UNIQUE INDEX idx_products_sku ON products (sku);
```

### CONCURRENTLYオプション

通常の `CREATE INDEX` はテーブルに**ロックをかけて**インデックスを作成するため、その間テーブルへの書き込みができません。本番環境では致命的です。

```sql
-- 通常の CREATE INDEX（テーブルをロック → 本番では危険）
CREATE INDEX idx_users_email ON users (email);

-- CONCURRENTLY オプション（ロックなし → 本番での推奨方法）
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
-- 注意：トランザクション内では使えない、時間がかかる
```

> **ポイント**  
> 本番環境でインデックスを追加するときは `CONCURRENTLY` を使うのが基本です。作成中もINSERT/UPDATE/DELETEが通常通り動作します。

> **現場メモ**  
> 本番でCONCURRENTLYなしのCREATE INDEXを実行してしまい、数分間テーブルへの書き込みがブロックされたことがあります。その間、APIのタイムアウトが大量発生し、インシデントになりました。本番DBへのマイグレーションスクリプトに `CREATE INDEX`（CONCURRENTLYなし）が含まれていたのが原因です。それ以来、マイグレーションレビューでは「本番テーブルへのCREATE INDEXはCONCURRENTLYになっているか」を必ず確認するようにしています。

```sql
-- インデックスの削除
DROP INDEX idx_users_email;

-- 本番で安全に削除（ロックなし）
DROP INDEX CONCURRENTLY idx_users_email;

-- 既存のインデックス一覧を確認
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';
```

## 11. よくある設計ミス

### ミス1: 外部キー列にインデックスを貼り忘れる

```sql
-- NG: 外部キーにインデックスがない
CREATE TABLE order_items (
  order_id   INT NOT NULL REFERENCES orders(order_id),
  product_id INT NOT NULL REFERENCES products(product_id)
  -- インデックスがない → JOINが遅い
);

-- OK: 外部キーには必ずインデックスを貼る
CREATE INDEX idx_order_items_order_id   ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);
```

> **注意**  
> PostgreSQLは外部キー制約を設定しても自動でインデックスを作りません（主キー側は自動作成されます）。外部キーを持つ側（子テーブル）には手動でインデックスを作成する必要があります。

> **現場メモ**  
> 「外部キーにインデックスを貼り忘れる」はレビューでよく指摘する問題です。新しいテーブルを追加するPRを見ると、`REFERENCES` を書いていてもインデックスがないケースが少なくありません。「外部キーを持つ列には必ずインデックスを貼る」はチームのコーディングルールにしておくことを推奨します。特に結合が多いテーブルでは、外部キーのインデックス漏れがパフォーマンスのボトルネックになりやすいです。インデックスを忘れたまま本番リリースして、JOINが絡む集計クエリがタイムアウトするというトラブルも経験しました。

### ミス2: 関数を使った WHERE 条件でインデックスが効かない

```sql
-- 実務でよく見るミス
SELECT * FROM users
WHERE DATE(created_at) = '2024-04-01';  -- DATE() 関数でインデックス効かず

-- 修正
SELECT * FROM users
WHERE created_at >= '2024-04-01'
  AND created_at < '2024-04-02';
```

### ミス3: SELECT * でインデックスオンリースキャンを妨げる

```sql
-- 必要な列だけ指定するとインデックスオンリースキャンになる場合がある
CREATE INDEX idx_users_email_name ON users (email, name);

-- SELECT * だと必ずテーブルアクセスが発生
SELECT * FROM users WHERE email = 'alice@example.com';

-- 必要な列だけなら Index Only Scan になり速い
SELECT email, name FROM users WHERE email = 'alice@example.com';
```

## 12. PRレビューのチェックポイント

シニアエンジニアがインデックスに関連するコードレビューで確認するポイントをまとめます。

### テーブル作成・変更時の確認

- [ ] **外部キー列にインデックスが貼られているか**
  - `REFERENCES` を持つ列には必ず対応するインデックスを確認する
- [ ] **新しいテーブルのWHERE句で使われる列にインデックスがあるか**
  - APIのクエリを見て「この絞り込み列にインデックスはありますか？」と確認する
- [ ] **複合インデックスの列順は正しいか**
  - 最左一致の原則に従い、よく使う検索条件の列が左にあるか

### インデックス追加時の確認

- [ ] **本番環境では `CREATE INDEX CONCURRENTLY` を使っているか**
  - マイグレーションファイルに通常の `CREATE INDEX` が含まれていないか
- [ ] **EXPLAINで実際にインデックスが使われることを確認したか**
  - インデックス追加のPRにはEXPLAINの結果を添付することを推奨する
- [ ] **既存のインデックスと重複していないか**
  - 同じ列への似たようなインデックスが既にないか `pg_indexes` で確認する

### パフォーマンス全般の確認

- [ ] **このWHERE句にインデックスはありますか？**
  - 新しいクエリが追加されたとき、使われている列にインデックスがあるか確認する
- [ ] **書き込みが多いテーブルへのインデックス追加は、INSERT/UPDATE性能への影響を測定したか**
  - 読み取り性能だけでなく書き込みコストのトレードオフを評価しているか
- [ ] **使われていないインデックスが残っていないか**
  - リファクタリング後に古いインデックスが残っていないか定期的に確認する

## 13. まとめ

| テーマ | 要点 |
| --- | --- |
| なぜインデックスが必要か | フルスキャンを避けて対数時間で検索するため |
| B-Treeの仕組み | 平衡木でデータを整列管理、log N 時間で目的行に到達 |
| 効果が出る操作 | WHERE =・範囲, JOIN ON, ORDER BY, GROUP BY |
| カーディナリティ | 高い列（email, user_id）ほど効果大、低い列（boolean, status）は要検討 |
| 複合インデックス | 左端の列から順に使われる（最左一致の原則） |
| 効かないパターン | 関数適用・型不一致・LIKE先頭%・低カーディナリティ |
| EXPLAINで確認 | インデックスを追加したら必ずEXPLAINで効いているか確認する |
| 貼りすぎのデメリット | INSERT/UPDATE/DELETE が遅くなる・ストレージ消費 |
| CONCURRENTLY | 本番環境でのインデックス追加にはこれを使う |
| 現場での原則 | インデックスは「読み取り性能」と「書き込み性能」のトレードオフ |
