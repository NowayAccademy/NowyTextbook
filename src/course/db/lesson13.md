# EXPLAINとパフォーマンス
実行計画を読み解き、スロークエリとN+1問題を特定・改善します

## 本章の目標

本章では以下を目標にして学習します。

- EXPLAIN / EXPLAIN ANALYZEの出力を読んで、遅いクエリの原因を特定できること
- N+1問題を説明し、JOINで解決できること
- クエリチューニングの基本パターンを実践できること

## 1. なぜEXPLAINが必要か

### クエリが遅い原因を「推測」で探しても無駄

SQLのパフォーマンス問題を解決しようとするとき、「なんとなく遅そう」という感覚だけで動いても解決できません。PostgreSQLには `EXPLAIN` というコマンドがあり、**データベースが実際にどうやってデータを探しているかの計画（実行計画）を見せてくれます**。

「フルスキャンしているのか、インデックスを使っているのか」「どこでコストがかかっているのか」を把握してから対策を立てます。

> **ポイント**  
> パフォーマンス改善は「計測 → 特定 → 対策」の順で行います。`EXPLAIN` は「特定」の手段です。インデックスを闇雲に追加する前に、まず実行計画を確認しましょう。

### 「クエリが遅い」と報告が来てから解決するまでの実際の調査フロー

現場でユーザーや監視アラートから「クエリが遅い」と報告が来たとき、筆者が実際に行う調査の流れを紹介します。

**ステップ1: 遅いクエリを特定する**

まず `pg_stat_statements` でボトルネックになっているクエリを探します（後述）。あわせて `pg_stat_activity` で現在進行中の長時間クエリがないか確認します。

**ステップ2: 遅いクエリに EXPLAIN ANALYZE をかける**

特定できたら、再現環境（またはステージング環境）でそのクエリに `EXPLAIN ANALYZE` をかけます。**本番DBへの EXPLAIN ANALYZE は、軽量なSELECT文に限定し、データ変更系は必ず BEGIN + ROLLBACK で実行します**。

**ステップ3: 実行計画を読んで原因を絞る**

`Seq Scan` が意図せず出ていないか、`rows` の推定値と実測値に大きな乖離がないか、`Sort` や `Hash` が高コストになっていないかを確認します。

**ステップ4: 対策を適用して再計測**

インデックス追加・クエリ書き換え・統計情報の更新などを施して、再度 EXPLAIN ANALYZE で改善を確認します。「なんとなく速くなった気がする」では不十分で、必ず数値で比較します。

> **現場メモ**  
> あるとき、ユーザーから「注文履歴ページが10秒以上かかる」という報告が来ました。まず `pg_stat_statements` を確認すると、そのページに対応するクエリの平均実行時間が8,000msを超えていました。EXPLAIN ANALYZE をかけると `Seq Scan on orders (cost=0.00..245000.00 rows=120000)` が出ており、120万行のテーブルをフルスキャンしていました。`customer_id` にインデックスがなかったことが原因で、インデックスを追加したところ平均実行時間が8,000msから12msまで落ちました。改善前後の EXPLAIN ANALYZE の出力をスクリーンショットでチケットに残しておくと、振り返りや類似問題の対処にとても役立ちます。

## 2. EXPLAINの基本構文と出力の読み方

### 基本構文

```sql
-- EXPLAINの基本
EXPLAIN SELECT * FROM users WHERE email = 'alice@example.com';
```

### 出力例（インデックスなしの場合）

```
QUERY PLAN
----------------------------------------------------------
Seq Scan on users  (cost=0.00..1845.00 rows=1 width=100)
  Filter: ((email)::text = 'alice@example.com'::text)
```

### 出力例（インデックスありの場合）

```
QUERY PLAN
----------------------------------------------------------
Index Scan using idx_users_email on users  (cost=0.43..8.45 rows=1 width=100)
  Index Cond: ((email)::text = 'alice@example.com'::text)
```

### 主なノード（操作）の種類

| ノード名 | 意味 |
| --- | --- |
| `Seq Scan` | テーブル全行を順番に読む（フルスキャン） |
| `Index Scan` | インデックスを使って行を探す |
| `Index Only Scan` | インデックスだけで結果を返す（テーブルを読まない） |
| `Bitmap Index Scan` | インデックスでビットマップを作り、まとめてテーブルを読む |
| `Hash Join` | 小さい方のテーブルをハッシュ化して結合 |
| `Nested Loop` | 外側の各行に対して内側を検索する結合 |
| `Merge Join` | 両方ソート済みの場合に使われる結合 |
| `Sort` | 結果をソートする |
| `Aggregate` | 集計関数（COUNT, SUM等）の処理 |
| `Limit` | 行数を制限する |

```sql
-- JOINを含むEXPLAINの例
EXPLAIN
SELECT o.order_id, c.name, o.total
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
WHERE c.name = '山田太郎';
```

```
QUERY PLAN
--------------------------------------------------------------------------
Hash Join  (cost=1.10..2856.00 rows=5 width=48)
  Hash Cond: (o.customer_id = c.customer_id)
  ->  Seq Scan on orders o  (cost=0.00..1845.00 rows=100000 width=24)
  ->  Hash  (cost=1.09..1.09 rows=1 width=36)
        ->  Index Scan using idx_customers_name on customers c  (cost=0.28..1.09 rows=1 width=36)
              Index Cond: (name = '山田太郎'::text)
```

ツリー構造で読む：下（内側）から上（外側）に向かって処理される。

> **ポイント**  
> `EXPLAIN` の出力は**下から上に読む**のが基本です。最も内側（最も下）の操作が最初に実行されます。

## 3. EXPLAIN ANALYZEの違い

### EXPLAINは「予測」、EXPLAIN ANALYZEは「実測」

`EXPLAIN` だけでは推定値（見積もり）が表示されます。`EXPLAIN ANALYZE` を付けると**実際に実行してリアルな数値を取得します**。

```sql
-- 実際に実行して計測（本物のデータが返る）
EXPLAIN ANALYZE
SELECT * FROM orders WHERE customer_id = 42;
```

```
QUERY PLAN
------------------------------------------------------------------------------------------------------
Index Scan using idx_orders_customer_id on orders  (cost=0.43..8.52 rows=5 width=80)
                                                   (actual time=0.042..0.051 rows=3 loops=1)
  Index Cond: (customer_id = 42)
Planning Time: 0.185 ms
Execution Time: 0.089 ms
```

### BUFFERS オプション（キャッシュヒット率の確認）

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42;
```

```
  Buffers: shared hit=3 read=0
  -- hit: キャッシュから読んだページ数
  -- read: ディスクから読んだページ数
```

> **注意**  
> `EXPLAIN ANALYZE` は実際にSQLを実行します。`DELETE` や `UPDATE` に付けると実際にデータが変更されます。データを変更するSQLには `EXPLAIN ANALYZE` を付ける場合は必ず `BEGIN` でトランザクションを開始し、最後に `ROLLBACK` してください。

```sql
-- データ変更系クエリの実行計画確認は必ずこの形で
BEGIN;
EXPLAIN ANALYZE DELETE FROM logs WHERE created_at < '2020-01-01';
ROLLBACK;  -- 実際には削除しない
```

> **現場メモ**  
> `EXPLAIN ANALYZE` を本番DBで実行することに抵抗を感じる方も多いかもしれませんが、**軽量なSELECT文であれば本番でも積極的に使います**。ステージング環境のデータは本番とデータ量や分布が異なることが多く、本番でしか再現しないパフォーマンス問題もあります。ただし実行前に「本当に軽いか」を `EXPLAIN`（ANALYZE なし）で確認してから実行します。数百万行のSeq Scanになるようなクエリをいきなり本番でANALYZEするのは避けましょう。筆者のチームでは「ステージングで問題なければ本番でも EXPLAIN ANALYZE して確認する」という方針にしています。

## 4. costとrowsの見方

### cost の読み方

```
Seq Scan on users  (cost=0.00..1845.00 rows=1 width=100)
                         ↑       ↑      ↑       ↑
                      開始コスト 終了コスト 推定行数 1行の平均バイト数
```

- **開始コスト**: 最初の1行を返すまでのコスト（ソートなどは高い）
- **終了コスト**: 全行を処理し終えるまでの合計コスト（小さいほど良い）
- **rows**: 処理すると推定される行数
- **width**: 1行あたりのバイト数

コストの単位は「ディスクページを読む時間」を1.0とした相対値です。絶対時間ではありません。

### actual time と rows（ANALYZE時）

```
(actual time=0.042..0.051 rows=3 loops=1)
              ↑              ↑       ↑
           実際の開始時間(ms) 実際の行数 繰り返し実行回数
```

> **ポイント**  
> `rows=1000` と推定しているのに `actual rows=100000` と大きく乖離している場合、統計情報が古い可能性があります。`ANALYZE テーブル名;` で統計を更新しましょう。

> **現場メモ**  
> 以前、EXPLAIN の `rows` 推定が実測の100倍以上ズレていた経験があります。`rows=500` と推定しているのに実際には `actual rows=80000` だったため、プランナーがインデックスを使うより安いと判断してSeq Scanを選んでいました。原因はバルクインポートで大量データを投入した後に `ANALYZE` を実行していなかったことでした。PostgreSQLのautovacuumは通常自動でANALYZEを走らせますが、短時間に大量のデータが入ったときには間に合わないことがあります。バルクインポート後は手動で `ANALYZE テーブル名;` を実行することを推奨します。

## 5. Seq Scan vs Index Scanの判断

### PostgreSQLがSeq Scanを選ぶとき

```sql
-- カーディナリティが低い → インデックスより Seq Scan が速い
-- status列に 'active' と 'inactive' の2種類しかない場合
SELECT * FROM users WHERE status = 'active';
-- → テーブルの60%にマッチ → Seq Scanの方が効率的とプランナーが判断
```

```sql
-- テーブルが小さい → Seq Scan の方が速い
SELECT * FROM tiny_config_table;
-- → 数十行しかないテーブルはインデックスを経由するより直接読む方が速い
```

### Seq Scanが意図しない場合

```sql
-- インデックスがあるのになぜか Seq Scan になる場合の確認
EXPLAIN SELECT * FROM orders WHERE ordered_at = '2024-01-15';
-- もしSeq Scanなら...

-- 統計情報を更新してみる
ANALYZE orders;
EXPLAIN SELECT * FROM orders WHERE ordered_at = '2024-01-15';
-- → Index Scan に変わることがある
```

> **ポイント**  
> Seq Scan が必ずしも「悪い」わけではありません。問題なのは「インデックスがあるはずなのにSeq Scanになっている」場合です。EXPLAIN で確認して原因を探りましょう。

### 現場での判断基準

Seq Scan が出たときの対処フローを紹介します。

1. **意図したSeq Scanか確認する**: 小テーブルや低カーディナリティ列への検索は Seq Scan が正常です。問題は大テーブルで意図せず Seq Scan になっている場合です。

2. **インデックスが存在するか確認する**: `\d テーブル名`（psqlコマンド）や `pg_indexes` ビューで確認します。インデックスがなければ作成を検討します。

3. **統計情報が最新か確認する**: `ANALYZE テーブル名;` を実行して再度 EXPLAIN をかけます。統計が古いとプランナーの判断が外れることがあります。

4. **型の不一致がないか確認する**: `WHERE user_id = '42'`（文字列）のように、列の型と条件の型が異なると暗黙の型変換が起きてインデックスが使われないことがあります。

5. **関数をWHERE句にかけていないか確認する**: `WHERE DATE(created_at) = '2024-01-15'` のように列に関数をかけると、通常のインデックスが使われません。関数インデックスを作るか、範囲条件に書き換えます。

> **現場メモ**  
> ある集計バッチで `WHERE LOWER(email) = 'alice@example.com'` というWHERE句があり、`email` にインデックスがあるのに Seq Scan になっていたことがあります。`LOWER()` 関数をかけているためインデックスが効かなかったのです。対策として `CREATE INDEX idx_users_email_lower ON users (LOWER(email));` という関数インデックスを作成したところ Index Scan に変わりました。レビューでも「WHERE句の列に関数をかけていないか」は確認するようにしています。

## 6. スロークエリの調査手順

### pg_stat_statements で遅いクエリを見つける

`pg_stat_statements` はPostgreSQLの拡張機能で、**実行されたクエリの統計情報（実行回数・合計時間・平均時間など）を記録します**。

```sql
-- pg_stat_statements が有効か確認
SELECT * FROM pg_extension WHERE extname = 'pg_stat_statements';

-- 有効にする場合（postgresql.conf に追記 + 再起動が必要）
-- shared_preload_libraries = 'pg_stat_statements'

-- 有効後、拡張を作成
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

```sql
-- 平均実行時間が長いクエリ TOP 10
SELECT
  round(total_exec_time / calls)  AS 平均実行時間ms,
  calls                           AS 実行回数,
  round(total_exec_time)          AS 合計実行時間ms,
  query
FROM pg_stat_statements
ORDER BY 平均実行時間ms DESC
LIMIT 10;

-- 実行回数が多いクエリ TOP 10（頻度が高いなら小さな改善でも効果大）
SELECT
  calls                           AS 実行回数,
  round(mean_exec_time)           AS 平均実行時間ms,
  query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

### ログからスロークエリを検出する

```sql
-- postgresql.conf での設定（100ms以上かかるクエリをログに出力）
-- log_min_duration_statement = 100   -- 単位: ms
```

> **ポイント**  
> `pg_stat_statements` は「どのクエリが全体の実行時間のボトルネックになっているか」を定量的に把握できます。チューニングは「最も総実行時間が大きいクエリ」から優先的に行うのが効率的です。

> **現場メモ**  
> `pg_stat_statements` を初めてプロジェクトに導入したとき、想定外のクエリがトップ10に入っていました。開発者が認識していなかったORMの自動クエリが大量に発行されていたのです。「このクエリ、どこから来てる？」とコードを追ったら、特定のAPI呼び出しのたびにN+1が発生していることが分かりました。`pg_stat_statements` は「見えていなかった問題を可視化する」ツールとして非常に価値があります。新しいプロジェクトに入ったらまず有効になっているか確認することをお勧めします。

## 7. N+1問題とは

### N+1問題の説明

**N+1問題**はアプリケーションがDBに対して「1回のクエリ + N回のクエリ」を発行してしまうパフォーマンス上のアンチパターンです。

### 具体例：ユーザー一覧とその注文数を表示

```python
# NG: N+1問題（Pythonの擬似コード）

# 1回目のクエリ（ユーザー一覧を取得）
users = db.query("SELECT user_id, name FROM users LIMIT 100")

# ユーザーごとにループして注文を取得（100回のクエリが発行される！）
for user in users:  # N = 100
    orders = db.query(
        "SELECT COUNT(*) FROM orders WHERE customer_id = %s",
        user['user_id']
    )
    user['order_count'] = orders[0]['count']

# 合計 1 + 100 = 101 回のクエリ
```

```sql
-- 上記で発行されるSQL（イメージ）

-- 1回目
SELECT user_id, name FROM users LIMIT 100;

-- 2回目（user_id=1のため）
SELECT COUNT(*) FROM orders WHERE customer_id = 1;
-- 3回目（user_id=2のため）
SELECT COUNT(*) FROM orders WHERE customer_id = 2;
-- ...（100回繰り返す）
-- 101回目
SELECT COUNT(*) FROM orders WHERE customer_id = 100;
```

### N+1問題の影響

- 100ユーザーで101クエリ
- 10,000ユーザーで10,001クエリ
- 各クエリにネットワーク遅延が加わると、ページ表示が数十秒かかることも

### EXPLAINでのN+1の見え方

N+1問題はEXPLAINでは単体クエリを見ても気づきにくいのが厄介です。ループ内の1クエリは非常に速くても（例：1ms）、それが1,000回実行されれば合計1秒になります。

N+1を疑うときは以下の観点で確認します。

```sql
-- pg_stat_statements でN+1を疑うパターン
SELECT
  calls,
  round(mean_exec_time) AS 平均ms,
  round(total_exec_time) AS 合計ms,
  query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
-- → 「calls が異常に多い」かつ「クエリが WHERE primary_key = $1 の形」であればN+1候補
```

`Nested Loop` ノードが実行計画に出てきて、その `loops` 値が大きい場合も、ループ回数が多いことを示しています。

```
Nested Loop  (cost=... rows=100 loops=1)
  -> Seq Scan on users (rows=100 loops=1)
  -> Index Scan on orders (rows=3 loops=100)   ← loops=100 に注目
```

`loops=100` は「この操作が100回繰り返された」ことを示します。

### JOINで解決する

```sql
-- OK: 1回のクエリで解決
SELECT
  u.user_id,
  u.name,
  COUNT(o.order_id) AS 注文数
FROM users u
LEFT JOIN orders o ON u.user_id = o.customer_id
GROUP BY u.user_id, u.name
ORDER BY u.user_id
LIMIT 100;

-- → 1回のクエリで全ユーザーの注文数が取得できる
```

> **ポイント**  
> N+1問題はORMを使うフレームワーク（ActiveRecord、SQLAlchemy等）で特に発生しやすいです。ORMの「イーガーロード（eager load）」機能や、手動でのJOINを使って解決します。

> **現場メモ**  
> N+1問題は面接で必ずといっていいほど聞かれます。「N+1問題とは何ですか」だけでなく、「どうやって検出しますか」まで答えられるようにしておきましょう。開発環境では `django-debug-toolbar`（Django）や `bullet`（Rails）のようなクエリ可視化ツールを使うのが効果的です。本番ではpg_stat_statementsの`calls`値を確認します。修正後は「クエリ数が減ったこと」を数値で確認することを徹底しています。

## 8. クエリチューニングの基本パターン

### パターン1: インデックスを追加する

```sql
-- スロークエリの例
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'pending';

-- Seq Scan になっているなら複合インデックスを追加
CREATE INDEX CONCURRENTLY idx_orders_customer_status
ON orders (customer_id, status);

-- 再確認
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE customer_id = 42 AND status = 'pending';
-- → Index Scan に変わっているはず
```

### パターン2: サブクエリをJOINに書き換える

```sql
-- NG: 相関サブクエリ（遅い）
SELECT
  p.product_id,
  p.name,
  (SELECT SUM(oi.quantity)
   FROM order_items oi
   WHERE oi.product_id = p.product_id) AS 総販売数
FROM products p;
-- → 各行ごとにサブクエリが実行される（N+1と同じ問題）

-- OK: LEFT JOIN + GROUP BY（速い）
SELECT
  p.product_id,
  p.name,
  COALESCE(SUM(oi.quantity), 0) AS 総販売数
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.product_id, p.name;
```

### パターン3: 必要な列だけ取得する（SELECT * をやめる）

```sql
-- NG: SELECT * は余分なデータを転送する
SELECT * FROM users WHERE user_id = 42;

-- OK: 必要な列だけ指定
SELECT user_id, name, email FROM users WHERE user_id = 42;
-- → データ転送量が減り、Index Only Scan になる可能性も上がる
```

### パターン4: LIMIT でページネーション

```sql
-- NG: オフセットが大きいと遅くなる
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 100000;
-- → 100020行を読んで最後の20行を返す

-- OK: カーソルベースのページネーション（Keyset Pagination）
SELECT * FROM orders
WHERE created_at < '2024-01-01 00:00:00'  -- 前ページの最後の値
ORDER BY created_at DESC
LIMIT 20;
```

### パターン5: EXISTS vs IN の使い分け

```sql
-- IN でサブクエリ（大量行では遅くなることがある）
SELECT * FROM customers
WHERE customer_id IN (
  SELECT customer_id FROM orders WHERE total > 10000
);

-- EXISTS で書き換え（行数に左右されにくい）
SELECT * FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.customer_id = c.customer_id
    AND o.total > 10000
);
-- → どちらが速いかは EXPLAIN ANALYZE で確認
```

### パターン6: CTEをインライン化する（またはCTEで整理する）

```sql
-- CTE（WITH句）は読みやすいが、場合によっては最適化が難しい
WITH recent_orders AS (
  SELECT * FROM orders WHERE ordered_at > NOW() - INTERVAL '30 days'
)
SELECT * FROM recent_orders WHERE total > 5000;

-- インライン化するとプランナーが最適化しやすい場合がある
SELECT * FROM orders
WHERE ordered_at > NOW() - INTERVAL '30 days'
  AND total > 5000;
```

> **ポイント**  
> PostgreSQL 12以降、CTEはデフォルトでインライン化（最適化対象）されます。古いバージョンでは `MATERIALIZED` / `NOT MATERIALIZED` を明示することが有効でした。

### パターン7: 複雑なJOINをCTEで整理して速くする

深くネストしたJOINは、読みにくいだけでなくプランナーが最適なプランを選べないことがあります。CTEで段階的に分割すると、可読性が上がるだけでなくパフォーマンスが改善することもあります。

```sql
-- NG: ネストが深くて読みにくいJOIN
SELECT
  u.name,
  p.title,
  c.content,
  t.name AS tag_name
FROM users u
JOIN posts p ON p.user_id = u.user_id
JOIN comments c ON c.post_id = p.post_id
JOIN post_tags pt ON pt.post_id = p.post_id
JOIN tags t ON t.tag_id = pt.tag_id
WHERE u.user_id = 42
  AND p.published_at > NOW() - INTERVAL '30 days';

-- OK: CTEで段階的に整理する
WITH target_posts AS (
  -- まず対象ユーザーの最近の投稿を絞る
  SELECT post_id, user_id, title, published_at
  FROM posts
  WHERE user_id = 42
    AND published_at > NOW() - INTERVAL '30 days'
),
post_with_tags AS (
  -- 投稿にタグを結合する
  SELECT tp.post_id, tp.title, t.name AS tag_name
  FROM target_posts tp
  JOIN post_tags pt ON pt.post_id = tp.post_id
  JOIN tags t ON t.tag_id = pt.tag_id
)
SELECT u.name, pwt.title, c.content, pwt.tag_name
FROM users u
JOIN post_with_tags pwt ON pwt.post_id IN (
  SELECT post_id FROM target_posts WHERE user_id = u.user_id
)
JOIN comments c ON c.post_id = pwt.post_id
WHERE u.user_id = 42;
```

> **現場メモ**  
> 以前、8つのテーブルをJOINしたクエリが秒単位で遅いという問題がありました。EXPLAIN ANALYZEを見ると、プランナーが「1億行のテーブルに対してネストループを選んでいる」ことが分かりました。CTEで処理を分割して中間テーブルを小さくしたところ、実行時間が3秒から200msまで改善しました。読みやすさと速さを同時に得られることがあるので、複雑なJOINはまずCTEで整理してみることをお勧めします。

## 9. よくあるパフォーマンス問題

### 問題1: 統計情報が古くて実行計画が外れている

> 参照：[2. EXPLAINの基本構文と出力の読み方](#2-explainの基本構文と出力の読み方) ・ [5. Seq Scan vs Index Scanの判断](#5-seq-scan-vs-index-scanの判断)

```sql
-- 症状：EXPLAINのrows推定が実際の行数と大きく乖離

-- 対策：ANALYZEで統計情報を更新
ANALYZE orders;

-- 全テーブルを対象にする場合
VACUUM ANALYZE;
```

### 問題2: テーブルの肥大化（Seq Scanが特に遅くなる）

> 参照：[7. N+1問題とは](#7-n1問題とは)

大量のDELETE/UPDATEをした後、テーブルサイズが縮まらない場合があります。

```sql
-- dead tuple（不要行）の確認
SELECT
  relname       AS テーブル名,
  n_live_tup    AS 有効行数,
  n_dead_tup    AS 不要行数,
  round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS 不要行率
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC;

-- VACUUM で不要行を回収
VACUUM ANALYZE orders;
```

### 問題3: ORDER BY + LIMIT が遅い

> 参照：[8. クエリチューニングの基本パターン](#8-クエリチューニングの基本パターン) ・ [3. EXPLAIN ANALYZEの違い](#3-explain-analyzeの違い)

```sql
-- インデックスがない列でのORDER BYはSortノードが発生する
EXPLAIN ANALYZE
SELECT * FROM orders ORDER BY total DESC LIMIT 10;
-- → Sort (cost=... rows=100000) が見える場合

-- 対策：インデックスを追加
CREATE INDEX idx_orders_total_desc ON orders (total DESC);
```

### 問題4: NULLとインデックス

```sql
-- B-TreeインデックスはNULLを末尾（またはデフォルト）に格納する
-- IS NULL / IS NOT NULL 検索はインデックスを使える場合もある

-- NULLを含む列での検索
SELECT * FROM users WHERE deleted_at IS NULL;
-- → deleted_at のインデックスがあれば使われる（行数次第）
```

> **現場メモ**  
> ソフトデリートを実装しているシステムで `WHERE deleted_at IS NULL` という条件が多用されているケースがありました。`deleted_at` にインデックスがなかったため Seq Scan になっていましたが、単純にインデックスを追加してもほぼ全行が `NULL`（削除されていないレコード）なのでインデックスの恩恵が小さい状態でした。このような場合は部分インデックス（`CREATE INDEX idx_users_active ON users (user_id) WHERE deleted_at IS NULL;`）が有効です。「削除されていないユーザー」だけのインデックスになるので、インデックスサイズが小さく、検索も効率的になります。

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| EXPLAINの必要性 | 「遅い原因」を計測で特定するための基本ツール |
| Seq Scan | テーブル全行スキャン。大テーブルでは遅いが小テーブルやカーディナリティが低いと選ばれる |
| Index Scan | インデックスを使った検索。WHERE条件が絞り込める場合に選ばれる |
| EXPLAIN ANALYZE | 実際に実行して実測値を取得。DML系はBEGIN+ROLLBACKで |
| cost | 相対的なコスト値。低いほど良い |
| actual rows vs rows | 大きく乖離していたらANALYZEで統計更新 |
| pg_stat_statements | スロークエリを定量的に特定するための拡張機能 |
| N+1問題 | ループ内で1クエリずつ発行するアンチパターン。JOINで解決 |
| チューニングの基本 | インデックス追加・相関サブクエリ→JOIN・SELECT *排除 |

## ポイント

クエリのパフォーマンスに関するコードをレビューするとき、筆者が必ず確認するポイントをまとめます。「EXPLAINをかけたことがない」クエリが本番に出ていくことを防ぐための観点です。

**クエリの設計**
- ループ内でDBクエリを発行していないか（N+1問題）
- `SELECT *` を使っていないか（必要な列だけ取得しているか）
- `WHERE` 句の条件列にインデックスが効いているか（EXPLAIN で確認済みか）
- `WHERE` 句の列に関数をかけていないか（インデックスが効かなくなる）
- 大量データを対象とするクエリに `LIMIT` がついているか

**実行計画の確認**
- 新規クエリや変更したクエリに `EXPLAIN ANALYZE` をかけて確認しているか
- `Seq Scan` が大テーブルで出ていないか
- `rows` 推定と実際の行数に大きな乖離がないか（ある場合は `ANALYZE` 済みか）
- JOINの `loops` 値が過大になっていないか

**インデックスの管理**
- 追加するインデックスは本当に使われるか（EXPLAIN で確認済みか）
- インデックスの追加は `CREATE INDEX CONCURRENTLY` を使っているか（本番テーブルのロックを避けるため）
- 不要なインデックスを増やしていないか（インデックスはINSERT/UPDATEを遅くする）

**N+1問題**
- ORMを使っている場合、関連エンティティのイーガーロードを設定しているか
- 修正後に実際のクエリ発行回数が減ったことを確認しているか（pg_stat_statements または開発ツール）

---

## 練習問題

### 問題1: EXPLAIN の読み方

以下の EXPLAIN 出力を読んで、問題点と改善方法を答えてください。

```
EXPLAIN SELECT * FROM orders WHERE user_id = 42;

                          QUERY PLAN
---------------------------------------------------------------
 Seq Scan on orders  (cost=0.00..25000.00 rows=10 width=64)
   Filter: (user_id = 42)
```

<details>
<summary>回答を見る</summary>

**問題点：**
- `Seq Scan`（シーケンシャルスキャン）が発生している = テーブル全件を読んでいる
- `cost` の上限値 25000.00 は大きく、全件スキャンのコスト

**改善方法：`user_id` にインデックスを追加**

```sql
CREATE INDEX idx_orders_user_id ON orders (user_id);
```

**改善後の EXPLAIN（期待値）：**
```
Index Scan using idx_orders_user_id on orders  (cost=0.43..8.46 rows=10 width=64)
  Index Cond: (user_id = 42)
```

**解説：** `Seq Scan` は全件スキャンを意味し、件数が多いテーブルでは遅くなります。`Index Scan` や `Index Only Scan` が表示されればインデックスが使われています。`EXPLAIN ANALYZE` を使うと実際の実行時間も確認できます。

</details>

### 問題2: N+1 問題の解決

以下のような処理（疑似コード）がN+1問題を起こしています。SQLで1クエリに改善してください。

```python
# N+1問題のコード
articles = db.query("SELECT id, title FROM articles LIMIT 10")
for article in articles:
    author = db.query(f"SELECT name FROM users WHERE id = {article.user_id}")
    print(article.title, author.name)
```

<details>
<summary>回答を見る</summary>

**改善後：JOIN で1クエリに統合**

```sql
SELECT a.id, a.title, u.name AS author_name
FROM articles AS a
JOIN users AS u ON a.user_id = u.id
LIMIT 10;
```

**解説：** N+1問題は「1回のクエリでN件取得 → N件それぞれに追加クエリ = N+1回のクエリ」という非効率なパターンです。JOIN でまとめると1回のクエリで全データを取得できます。ORM（ActiveRecord, Sequelize等）を使っている場合は「Eager Loading」（includes, preload等）で解決します。N=10の場合は11クエリ→1クエリになります。

</details>

### 問題3: EXPLAIN ANALYZE の活用

以下の遅いクエリを最適化してください。EXPLAIN ANALYZE でどの部分に問題があるかを特定する手順も示してください。

```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM users AS u
LEFT JOIN orders AS o ON u.id = o.user_id
WHERE EXTRACT(YEAR FROM o.created_at) = 2024
GROUP BY u.id, u.name;
```

<details>
<summary>回答を見る</summary>

**問題の特定手順：**

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id) AS order_count
FROM users AS u
LEFT JOIN orders AS o ON u.id = o.user_id
WHERE EXTRACT(YEAR FROM o.created_at) = 2024
GROUP BY u.id, u.name;
```

**問題点：**
1. `EXTRACT(YEAR FROM o.created_at) = 2024` は関数でカラムを加工しているためインデックスが使えない
2. LEFT JOIN なのに WHERE で `o.created_at` を条件にすると、NULL行（注文なしユーザー）が除外される（実質 INNER JOIN になる）

**改善版：**

```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM users AS u
LEFT JOIN orders AS o
  ON u.id = o.user_id
  AND o.created_at >= '2024-01-01'
  AND o.created_at < '2025-01-01'   -- 範囲比較でインデックスを使用
GROUP BY u.id, u.name;
```

**解説：** ① 関数変換をやめて範囲比較に変更（インデックスが使える）、② 日付条件を JOIN の ON 句に移動（LEFT JOIN の NULL を保持するため）。`EXPLAIN ANALYZE` の出力で `Seq Scan` の行と実際の実行時間（`actual time`）を確認して改善効果を測定します。

</details>
