# トランザクションとロック
ACIDの保証・分離レベル・悲観ロック・楽観ロック・デッドロックを理解します

## 本章の目標

本章では以下を目標にして学習します。

- ACID特性の意味を説明できること
- 分離レベルとそれぞれの問題（ダーティリード・ファントムリード等）を理解できること
- 悲観ロック・楽観ロック・デッドロックの仕組みと対策を説明できること

## 1. トランザクションとは

### 「一連の処理をひとまとめにする」

トランザクション（Transaction）とは、**複数のSQL操作をひとまとめにして「全部成功するか、全部失敗するか」を保証する**仕組みです。

### なぜトランザクションが必要か

銀行振込を例に考えます。

```
A さんの口座から 10,000円 引く  → 成功
B さんの口座に 10,000円 足す   → ここでシステム障害！
```

この場合、Aさんの口座から10,000円が消えたのに、Bさんには届かないという最悪の事態が起きます。

トランザクションを使えば、**「2つの操作が両方成功しなければ、どちらも適用しない」**と保証できます。

```sql
-- 銀行振込のトランザクション例
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE account_id = 1;  -- Aから引く
UPDATE accounts SET balance = balance + 10000 WHERE account_id = 2;  -- Bに足す

COMMIT;  -- 両方成功したら確定
```

> **ポイント**  
> トランザクションは「全部やる or 全部やらない」という原子性（Atomicity）を保証します。途中でエラーが起きたら `ROLLBACK` で元に戻せます。

> **現場メモ**  
> 新人のころ、「ROLLBACKが実行される」ケースを考慮せずに実装していて、本番で痛い目に遭いました。たとえば、トランザクション内でメール送信やS3アップロードといった外部処理を呼んでしまうと、DBはROLLBACKできても外部処理は取り消せません。コードレビューで必ず「このトランザクションがROLLBACKされたときに、外部への副作用は残っていないか」を確認するようにしています。

## 2. ACID（アシッド）

トランザクションが保証する4つの特性を **ACID** と呼びます。

### A: Atomicity（原子性）

トランザクション内の操作は「**全部成功** or **全部失敗**」のどちらかになります。途中の状態はありません。

```sql
BEGIN;
UPDATE accounts SET balance = balance - 10000 WHERE account_id = 1;
-- ここでエラーが発生
UPDATE accounts SET balance = balance + 10000 WHERE account_id = 999;  -- 存在しないアカウント

ROLLBACK;  -- 上のUPDATEも取り消される（Aさんの口座は元に戻る）
```

### C: Consistency（一貫性）

トランザクションの前後で、データベースは常に「整合性のある状態」を保ちます。

```sql
-- 残高がマイナスにならないという制約
ALTER TABLE accounts ADD CONSTRAINT chk_balance_positive CHECK (balance >= 0);

BEGIN;
UPDATE accounts SET balance = balance - 9999999 WHERE account_id = 1;
-- CHECK制約に違反 → エラー → ROLLBACK される（残高は変わらない）
COMMIT;
```

### I: Isolation（分離性・独立性）

複数のトランザクションが同時に実行されても、**お互いに影響を与えない**ことが保証されます（詳しくは分離レベルで後述）。

### D: Durability（永続性）

`COMMIT` したデータは、**システム障害が起きても消えません**。ディスクに書き込みが保証されます。

| 特性 | 一言でいうと |
| --- | --- |
| Atomicity（原子性） | 全部やるか、全部やらないか |
| Consistency（一貫性） | 制約を壊さない |
| Isolation（分離性） | 他のトランザクションと干渉しない |
| Durability（永続性） | COMMITしたら消えない |

## 3. BEGIN / COMMIT / ROLLBACK の使い方

```sql
-- トランザクション開始
BEGIN;
-- または
START TRANSACTION;

-- 通常のSQL操作
INSERT INTO orders (customer_id, total) VALUES (1, 5000);
UPDATE inventory SET stock = stock - 1 WHERE product_id = 101;

-- 成功したら確定
COMMIT;

-- 失敗したら取り消し
ROLLBACK;
```

### SAVEPOINT（部分的な取り消し）

```sql
BEGIN;

INSERT INTO orders (customer_id, total) VALUES (1, 5000);

SAVEPOINT before_inventory;  -- セーブポイントを設定

UPDATE inventory SET stock = stock - 1 WHERE product_id = 101;
-- ここでエラーが発生したとする

ROLLBACK TO SAVEPOINT before_inventory;  -- セーブポイントまで戻す（orders の INSERT は残る）

-- 別の処理を試みる
UPDATE inventory SET stock = 0 WHERE product_id = 101;

COMMIT;
```

> **ポイント**  
> `SAVEPOINT` はトランザクション全体をロールバックせず、「ある地点まで戻す」ことができます。複雑なバッチ処理で役立ちます。

### 自動コミット（AutoCommit）

PostgreSQLでは、`BEGIN` を書かない1行のSQLは**自動的に1つのトランザクションとして即時COMMITされます**。

```sql
-- これは自動的にトランザクションが作られ即COMMITされる
DELETE FROM logs WHERE created_at < '2020-01-01';
-- → 実行した瞬間に確定（取り消せない！）
```

> **注意**  
> `BEGIN` なしの `DELETE` は即座に確定されます。大量削除などは必ず `BEGIN` して `ROLLBACK` できる状態にしてから実行しましょう。

> **現場メモ**  
> 筆者が新卒のころ、本番DB上で `BEGIN` を付け忘れたまま `DELETE FROM sessions;` を実行してしまい、全セッションデータを消してしまったことがあります。幸いバックアップから復旧できましたが、以来「本番DBでの手動SQL実行は必ず BEGIN から始める」がチームのルールになりました。psqlの設定で `\set AUTOCOMMIT off` にしておくのも一つの手です。

## 4. 分離レベル

### 同時実行で起きる問題

複数のトランザクションが同時に動くと3種類の問題が起きる可能性があります。

| 問題 | 説明 |
| --- | --- |
| ダーティリード | 別トランザクションがまだCOMMITしていない変更を読んでしまう |
| ノンリピータブルリード | 同じトランザクション内で同じ行を2回読んだとき、値が変わっている |
| ファントムリード | 同じトランザクション内で同じ条件で検索したとき、行が増えている |

### 4つの分離レベル

```sql
-- 分離レベルの設定方法
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- または REPEATABLE READ / SERIALIZABLE
```

| 分離レベル | ダーティリード | ノンリピータブルリード | ファントムリード |
| --- | --- | --- | --- |
| READ UNCOMMITTED | 発生する可能性 | 発生する可能性 | 発生する可能性 |
| READ COMMITTED | 防止 | 発生する可能性 | 発生する可能性 |
| REPEATABLE READ | 防止 | 防止 | 発生する可能性（PostgreSQLは防止） |
| SERIALIZABLE | 防止 | 防止 | 防止 |

### 各レベルの実例

```sql
-- READ COMMITTED の動作例（デフォルト）
-- トランザクションAがCOMMITした後の値をトランザクションBが読む

-- トランザクションA
BEGIN;
UPDATE products SET price = 1500 WHERE product_id = 1;
-- まだ COMMIT していない

-- トランザクションB（同時実行）
BEGIN;
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT price FROM products WHERE product_id = 1;
-- → まだ1200が返る（AのCOMMIT前の値）
COMMIT;

-- トランザクションAがCOMMIT後、再度Bが読むと1500が返る（ノンリピータブルリードが起きる）
```

```sql
-- REPEATABLE READ の動作例
-- トランザクション開始時点のスナップショットを使う

BEGIN;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT price FROM products WHERE product_id = 1;
-- → 1200（トランザクション開始時の値）

-- 別のトランザクションが price を 1500 に変更・COMMIT しても…

SELECT price FROM products WHERE product_id = 1;
-- → まだ1200（同一トランザクション内では変わらない）
COMMIT;
```

## 5. PostgreSQLのデフォルト分離レベル

PostgreSQLのデフォルトは **READ COMMITTED** です。

```sql
-- デフォルトの分離レベルを確認
SHOW default_transaction_isolation;
-- → read committed

-- セッション全体で変更する場合
SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

> **ポイント**  
> ほとんどのWebアプリケーションでは READ COMMITTED で十分です。厳密な整合性が必要な金融系処理では SERIALIZABLE を使うことがあります。ただし、分離レベルが高いほどパフォーマンスが低下します。

### 現場での判断基準

**「分離レベルは変えるな。変えるなら必ずドキュメントに残せ」**というのが筆者の持論です。

READ COMMITTED から REPEATABLE READ や SERIALIZABLE に変更するとパフォーマンスへの影響が出るだけでなく、アプリケーション側でシリアライゼーションエラー（`ERROR: could not serialize access due to concurrent update`）への対処が必要になります。変更する際は以下を必ず残してください。

- なぜ分離レベルを変更したか（ビジネス要件）
- どの範囲（セッション全体 or 特定トランザクション）に適用するか
- シリアライゼーションエラーが起きたときのリトライ処理はあるか

分離レベルを上げることで問題が「見えにくくなる」だけで、本質的な設計の問題が解消されることはありません。まずはデフォルトのまま設計を見直すことを推奨します。

> **現場メモ**  
> あるプロジェクトで、コードレビュー中に `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE;` という一行がアプリの起動スクリプトに入っているのを発見しました。理由を聞いたら「昔誰かが入れたが理由は不明」とのこと。SERIALIZABLEは正しく使えば強力ですが、リトライ処理が実装されていない状態では断続的なエラーを引き起こします。その設定を外したところ、謎のタイムアウトエラーが解消されたという経験があります。

## 6. 悲観ロック（SELECT FOR UPDATE）

### 悲観ロックとは

「他の人が書き換えるかもしれない」と**悲観的に考えて**、読んだ時点でロックをかける方法です。

```sql
-- 在庫管理の例：悲観ロック
BEGIN;

-- 在庫を読むと同時にロック（他のトランザクションのUPDATEを待たせる）
SELECT stock
FROM inventory
WHERE product_id = 101
FOR UPDATE;  -- ← このSELECTがロックを取得

-- stock を確認して処理
-- stock > 0 なら在庫を減らす
UPDATE inventory SET stock = stock - 1 WHERE product_id = 101;

COMMIT;  -- ロックが解放される
```

### FOR UPDATE の動作

```
トランザクションA                    トランザクションB
SELECT ... FOR UPDATE;  → ロック取得
                             SELECT ... FOR UPDATE;  → 待機（ブロック）
UPDATE ...;
COMMIT;  → ロック解放
                                             → 再開（最新データを読む）
```

> **ポイント**  
> `FOR UPDATE` は「自分がCOMMITするまで他のトランザクションに書き換えさせない」強力なロックです。在庫管理・座席予約など「同時に2人が同じリソースを確保しようとするケース」に有効です。

### FOR SHARE（共有ロック）

```sql
-- 読み取りは許可するが、書き込みはブロックする
SELECT * FROM products WHERE product_id = 101 FOR SHARE;
```

### 現場での判断基準

悲観ロックは強力ですが、**使いすぎると処理全体が直列化してしまいます**。

特に「WHERE条件でインデックスが使われていない `FOR UPDATE`」は非常に危険です。インデックスなしで `FOR UPDATE` を実行すると、Seq Scanで対象行を探しながらテーブル全体を実質的にロックしてしまい、他のトランザクションが全て待機状態に陥ります。

また、API呼び出しや複雑な計算処理をトランザクション内で行うと、`FOR UPDATE` で取得したロックがその間ずっと保持されます。ロックの保持時間を最小化するために、**DB操作以外の処理はトランザクションの外で完結させる**ことを強く推奨します。

> **現場メモ**  
> ある機能でユーザーのポイント残高を更新する処理があり、全体のパフォーマンスが急激に低下したことがありました。調査してみると、`SELECT balance FROM user_points WHERE user_id = ? FOR UPDATE` のあとに外部APIへの通信（平均200ms）が挟まっていることが原因でした。APIが遅いとその分ロックが保持され続け、同一ユーザーへの他のリクエストが全部キューに積まれていたのです。API通信をトランザクションの外に出したところ、処理時間が劇的に改善しました。

## 7. 楽観ロック（versionカラム）

### 楽観ロックとは

「競合はまれ」と**楽観的に考えて**、ロックをかけずに処理し、**書き込み時に「誰かが変えていないか確認」する**方法です。

### versionカラムを使った実装

```sql
-- versionカラムを持つテーブル
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  price      NUMERIC(10, 2) NOT NULL,
  version    INT NOT NULL DEFAULT 1  -- 更新のたびに +1 する
);
```

```sql
-- 楽観ロックの流れ

-- 1. データを読む（versionを一緒に取得）
SELECT product_id, price, version
FROM products
WHERE product_id = 101;
-- → price: 1200, version: 3

-- 2. アプリで処理（例：価格を1500に変更）

-- 3. 更新時に version を条件に含める
UPDATE products
SET price = 1500, version = version + 1
WHERE product_id = 101
  AND version = 3;  -- 読んだときと同じ version か確認

-- 更新された行数を確認
-- → 1行更新されれば成功（誰も変更していなかった）
-- → 0行更新されれば失敗（他の誰かが先に変更していた → リトライ or エラー）
```

### 悲観ロックと楽観ロックの比較

| 観点 | 悲観ロック | 楽観ロック |
| --- | --- | --- |
| 仕組み | ロックで他を排除 | versionで競合を検知 |
| 競合が多い場合 | 安定（待機が多くなる） | 不向き（リトライが多発） |
| 競合が少ない場合 | 無駄なロックが発生 | 有効（ロックオーバーヘッドなし） |
| デッドロック | 発生しうる | 発生しない |
| 主な用途 | 在庫・座席の確保 | ブログ記事・ユーザープロファイルの更新 |

> **ポイント**  
> Webアプリでは「競合がまれなCRUD」には楽観ロックが向いています。「絶対に競合してはいけない（在庫・残高）」には悲観ロックが適切です。

### 現場での判断基準

楽観ロックをアプリ側で実装するときは、以下の点に注意してください。

**UPDATEの影響行数を必ず確認する**。多くのORMは `updated_rows = 0` の場合にエラーを上げてくれますが、自前実装のときに「0行でも成功扱い」になっているコードを何度か見てきました。面接やコードレビューでも「楽観ロックの競合をどこで検知していますか」という確認は必ずされます。

**versionはアプリ側で計算してはいけない**。`SET version = 4` と固定値で指定するのではなく、`SET version = version + 1` とDB側でインクリメントするのが正しい実装です。アプリ側で計算してしまうと、読み取りと書き込みの間にも競合が入り込む余地が生まれます。

**リトライ上限を必ず設ける**。楽観ロックが競合した場合はリトライする設計が多いですが、上限を設けないと極端な競合時に無限リトライになります。通常は3〜5回でエラーを返す設計にすることを推奨します。

> **現場メモ**  
> 楽観ロックの実装レビューをしていたとき、「競合したら何もしない（0行更新でも正常終了扱い）」という実装を見つけたことがあります。ユーザーの設定変更が黙って失われる仕様になっていました。ユーザー側には何の通知もなく、変更が保存されたように見えてしまいます。このような「サイレントな失敗」は最も見つけにくいバグの一つです。楽観ロックを実装するときは、失敗パスが正しく処理されているかを最初に確認しましょう。

## 8. デッドロックの仕組みと対策

### デッドロックとは

2つのトランザクションが**お互いに相手のロック解放を待ち続け、永遠に進まなくなる**状態です。

```
トランザクションA                    トランザクションB
----                                 ----
1. users テーブルをロック        1. orders テーブルをロック
2. orders テーブルを待つ →      2. users テーブルを待つ →
   (B がロック中)                   (A がロック中)
   
   ← お互いを待ち続けて止まる！ →
```

```sql
-- デッドロックが起きるパターン（実例）

-- トランザクションA
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE account_id = 1;  -- ID=1 をロック
-- （次の操作の前に B が ID=2 をロックする）
UPDATE accounts SET balance = balance + 1000 WHERE account_id = 2;  -- ID=2 を待つ

-- トランザクションB（同時実行）
BEGIN;
UPDATE accounts SET balance = balance - 500  WHERE account_id = 2;  -- ID=2 をロック
-- （次の操作の前に A が ID=1 をロックする）
UPDATE accounts SET balance = balance + 500  WHERE account_id = 1;  -- ID=1 を待つ
-- → デッドロック！
```

### PostgreSQLの自動検知と対処

PostgreSQLはデッドロックを自動検知し、**一方のトランザクションを強制的にロールバック**させます。

```
ERROR:  deadlock detected
DETAIL:  Process 1234 waits for ShareLock on transaction 5678; blocked by process 5678.
         Process 5678 waits for ShareLock on transaction 1234; blocked by process 1234.
HINT:  See server log for query details.
```

> **現場メモ**  
> デッドロックが本番で初めて起きたとき、原因を特定するのに半日かかりました。最初はアプリのエラーログに `could not serialize access` とだけ出ていて、何が起きているのか全くわかりませんでした。PostgreSQLのサーバーログを掘り起こしたところ、`ERROR: deadlock detected` とともに対象のPIDとクエリが記録されていて、ようやく「これがデッドロックだ」と実感しました。以来、複数テーブルを更新するコードには必ず更新順序をコメントで書くようにしています。例えば `-- ロック取得順: accounts(id昇順) → order_items` のように残しておくと、後から見た人が順序を崩すコードを入れにくくなります。

### デッドロックの対策

**対策1: ロックの取得順序を統一する**

```sql
-- 常に小さいIDから順にロックする
-- NG: A が 1→2、B が 2→1 という逆順でロック取得
-- OK: 両方が ID の昇順（1→2）でロック取得
BEGIN;
SELECT * FROM accounts WHERE account_id = 1 FOR UPDATE;  -- 小さいIDから先に
SELECT * FROM accounts WHERE account_id = 2 FOR UPDATE;  -- 次に大きいID
```

**対策2: トランザクションを短くする**

```sql
-- NG: トランザクション内で時間のかかる処理をする
BEGIN;
SELECT ... FOR UPDATE;
-- （時間のかかる計算や外部APIコール）
UPDATE ...;
COMMIT;

-- OK: ロック取得前に計算を済ませ、ロック期間を最短にする
-- （アプリ側で計算）
BEGIN;
SELECT ... FOR UPDATE;
UPDATE ...;  -- すぐ更新
COMMIT;
```

**対策3: NOWAIT / SKIP LOCKED**

```sql
-- ロックが取れなければ即エラーを返す（待機しない）
SELECT * FROM tasks WHERE status = 'pending' FOR UPDATE NOWAIT;
-- → ロック中なら "could not obtain lock on row in relation..." エラー

-- ロックされた行をスキップして、取得できる行だけ処理する
SELECT * FROM tasks WHERE status = 'pending'
ORDER BY task_id
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- → キューの並行処理に最適
```

> **ポイント**  
> `SKIP LOCKED` はジョブキューの実装に非常に有効です。複数のワーカーが同じキューから仕事を取り合う場合、`SKIP LOCKED` でロック中の行を飛ばして別の行を取得できます。

## 9. よくあるロックトラブル

### トラブル1: トランザクションを長時間開けたままにする

```sql
-- NG: BEGIN後に長い処理
BEGIN;
SELECT * FROM large_table;
-- アプリ側で10分かかる集計処理
-- この間、テーブルのロックが維持され続ける

-- OK: ロック期間を最小限に
-- アプリ側で事前に必要なデータを取得し、DB操作の直前にBEGIN
```

> **現場メモ**  
> ある夜間バッチ処理で、数万件のレコードを1つのトランザクションにまとめて処理していました。そのバッチが動いている間（約30分）、同じテーブルへのINSERTやSELECTが全てロック待ちになり、アプリ全体がスローダウンするという事態が起きました。モニタリングダッシュボードを見ると、バッチ開始と同時にAPIのレスポンスタイムが跳ね上がっていました。バッチを1,000件ずつのチャンクに分割して個別にCOMMITするよう修正したところ、ピーク時のロック待ち時間がほぼゼロになりました。長時間トランザクションは「DBへの爆弾」だと思って設計するようにしています。

### トラブル2: ロック待ちタイムアウトの設定を忘れる

```sql
-- ロック待ちのタイムアウトを設定（5秒待ってもロックが取れなければエラー）
SET lock_timeout = '5s';

-- 文実行のタイムアウト
SET statement_timeout = '30s';
```

### トラブル3: 現在のロック状況を確認しない

```sql
-- 現在実行中のクエリとロック情報を確認
SELECT
  pid,
  now() - query_start AS 実行時間,
  state,
  query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY 実行時間 DESC;

-- ロック待ちが発生しているかを確認
SELECT
  blocked_locks.pid    AS ブロックされたPID,
  blocking_locks.pid   AS ブロックしているPID,
  blocked_activity.query AS ブロックされたクエリ
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity
  ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.granted
  AND NOT blocked_locks.granted;
```

> **現場メモ**  
> 本番でロック待ちが発生したとき、このクエリをすぐに実行できるかどうかで対応時間が大きく変わります。筆者のチームでは、インシデント対応手順書にこのクエリをそのままコピペできる形で記載しています。焦っているときにドキュメントを探す時間を省くためです。また、長時間のロックが続いている場合は `SELECT pg_cancel_backend(pid);`（処理中断）や `SELECT pg_terminate_backend(pid);`（強制切断）で対象プロセスを止めることも検討します。

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| トランザクション | 複数SQL操作を「全部成功 or 全部失敗」にまとめる |
| ACID | 原子性・一貫性・分離性・永続性の4特性 |
| BEGIN/COMMIT/ROLLBACK | 明示的なトランザクション制御。`BEGIN` なしは即時COMMIT |
| 分離レベル | READ COMMITTED（デフォルト）→ SERIALIZABLE（最高分離）の順に強い |
| ダーティリード等 | 分離レベルが低いほど発生しうる問題が増える |
| 悲観ロック | `SELECT FOR UPDATE` で読み取り時にロック。競合が多い場面に |
| 楽観ロック | version カラムで競合を検知。競合が少ない場面に向く |
| デッドロック | お互いのロック解放待ち。ロック取得順序の統一・トランザクション短縮で防ぐ |

## ポイント

トランザクション・ロック関連のコードをレビューするとき、筆者が必ず確認するポイントをまとめます。面接でも「DBのロック周りで気をつけていることは？」という質問はよく出ます。

**トランザクションの設計**
- `BEGIN` なしのDMLがないか（特に本番運用スクリプト）
- トランザクションが長時間になる可能性はないか（外部API呼び出し・ループ処理が含まれていないか）
- ROLLBACKが起きたとき、外部への副作用（メール送信・ファイル書き込み等）が残らないか
- エラーハンドリングでROLLBACKが確実に呼ばれるか（例外が発生しても確定されないか）

**ロックの設計**
- `FOR UPDATE` を使う場合、WHERE条件にインデックスが効いているか
- `FOR UPDATE` のあとに時間のかかる処理（外部通信・複雑な計算）がないか
- 複数テーブルをロックする場合、チーム内で更新順序が統一されているか（デッドロック対策）
- `lock_timeout` または `statement_timeout` が設定されているか

**楽観ロックの実装**
- UPDATEの影響行数（`rowcount`）を確認して、0行の場合にエラーを返しているか
- versionのインクリメントはDB側（`version = version + 1`）で行っているか
- リトライ上限が設定されているか

**分離レベル**
- デフォルト（READ COMMITTED）以外の分離レベルを使っている場合、その理由がコメント・ドキュメントに記載されているか
- SERIALIZABLE を使う場合、シリアライゼーションエラーのリトライ処理が実装されているか

---

## 練習問題

### 問題1: トランザクションの設計

> 参照：[1. トランザクションとは](#1-トランザクションとは) ・ [3. BEGIN / COMMIT / ROLLBACK の使い方](#3-begin-commit-rollback-の使い方)

在庫管理システムで「注文時に在庫を減らす」処理をトランザクションで実装してください。在庫が不足している場合はエラーにしてください。

<details>
<summary>回答を見る</summary>

```sql
BEGIN;

-- 在庫を確認・減算（在庫不足の場合は0件更新）
UPDATE products
SET stock = stock - 3
WHERE id = 100 AND stock >= 3;

-- 更新件数を確認（アプリ側）
-- affected_rows = 0 の場合はROLLBACKして在庫不足エラーを返す

-- 注文を記録
INSERT INTO orders (product_id, quantity, created_at)
VALUES (100, 3, CURRENT_TIMESTAMP);

COMMIT;
```

**解説：** `WHERE stock >= 3` を UPDATE に含めることで、在庫が足りない場合は0行更新になります（在庫チェックと更新をアトミックに実行）。アプリ側で `affected_rows = 0` を検出したら `ROLLBACK` して在庫不足エラーを返します。SELECT で確認してから UPDATE する方法は、SELECT と UPDATE の間に他のトランザクションが在庫を変更する競合状態（TOCTOU）が発生します。

</details>

### 問題2: デッドロックの理解

> 参照：[8. デッドロックの仕組みと対策](#8-デッドロックの仕組みと対策)

以下の2つのトランザクションが同時に実行されるとデッドロックが発生します。なぜデッドロックが起きるか説明し、回避方法を答えてください。

```sql
-- トランザクション1
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;  -- ①
UPDATE accounts SET balance = balance + 1000 WHERE id = 2;  -- ③（②が完了待ち）

-- トランザクション2（同時実行）
BEGIN;
UPDATE accounts SET balance = balance - 500 WHERE id = 2;   -- ②
UPDATE accounts SET balance = balance + 500 WHERE id = 1;   -- ④（①が完了待ち）
```

<details>
<summary>回答を見る</summary>

**デッドロックの仕組み：**
1. TX1 が id=1 をロック → TX2 が id=2 をロック
2. TX1 が id=2 を待つ → TX2 が id=1 を待つ
3. 互いに相手のロック解放を待ち続けて膠着（デッドロック）

**回避方法：ロックの取得順序を統一する**

```sql
-- 両トランザクションとも id の昇順（小さい方から）でロックを取る
-- トランザクション1（id=1→2の順：変更なし）
BEGIN;
UPDATE accounts SET balance = balance - 1000 WHERE id = 1;
UPDATE accounts SET balance = balance + 1000 WHERE id = 2;
COMMIT;

-- トランザクション2（id=1→2の順に変更）
BEGIN;
UPDATE accounts SET balance = balance + 500 WHERE id = 1;  -- id=1 を先に
UPDATE accounts SET balance = balance - 500 WHERE id = 2;
COMMIT;
```

**解説：** デッドロックは「複数のトランザクションが互いに相手のロックを待つ」状態です。PostgreSQL はデッドロックを検出すると片方を自動ロールバックします。根本的な回避策は「ロックの取得順序をアプリ全体で統一すること」です。

</details>

### 問題3: 適切な分離レベルの選択

> 参照：[4. 分離レベル](#4-分離レベル)

以下のシナリオで適切なトランザクション分離レベルを選んでください。

1. 銀行口座の残高参照（同時に他のトランザクションが入金中でも、完了前のデータは見えてはいけない）
2. ダッシュボードの集計表示（多少古いデータでも問題なく、高速に読み取りたい）
3. 在庫引き当て処理（ファントムリードを防ぎ、完全な整合性が必要）

<details>
<summary>回答を見る</summary>

| シナリオ | 分離レベル | 理由 |
|----------|-----------|------|
| 1 | `READ COMMITTED`（デフォルト） | コミット済みデータのみ読める。PostgreSQL のデフォルトで銀行の通常処理には十分 |
| 2 | `READ COMMITTED` または `REPEATABLE READ` | 高速化のためにはデフォルトで十分。MVCC により読み取りはほぼブロックされない |
| 3 | `SERIALIZABLE` | ファントムリード（範囲クエリの結果が変わる）を防ぐ必要がある場合。シリアライゼーションエラーのリトライ処理が必要 |

**解説：** PostgreSQL のデフォルト（`READ COMMITTED`）はダーティリードを防ぎ、ほとんどのユースケースに対応します。`SERIALIZABLE` は最も強い保証を提供しますが、競合が多い場合にトランザクションが中断されリトライが必要になるため、パフォーマンスと要件のバランスで選択します。

</details>
