# トランザクションとページング
BEGIN/COMMIT/ROLLBACKによるトランザクション制御と、OFFSETに頼らないページング手法を学びます

## 本章の目標

本章では以下を目標にして学習します。

- BEGIN / COMMIT / ROLLBACK の基本操作ができること
- SAVEPOINT を使って部分的なロールバックができること
- PostgreSQL のオートコミットの挙動を理解できること
- トランザクション内でエラーが起きたときの挙動を理解できること
- 長時間トランザクションのリスクを説明できること
- OFFSET ページングの問題点を理解できること
- カーソルベースページング（キーセットページング）を実装できること

---

## 1. トランザクションとは

トランザクションとは、**複数の DML（INSERT/UPDATE/DELETE）操作をひとまとめにする仕組み**です。

### なぜトランザクションが必要か

銀行振込を例に考えましょう。

```
Aさんの口座から 1万円を引く
Bさんの口座に  1万円を足す
```

この2つの処理は「必ずセットで成功 or セットで失敗」でなければなりません。  
もし途中でサーバーがクラッシュして「Aさんの口座だけ引かれた」状態になると大問題です。

トランザクションを使えば、途中で失敗しても「最初からなかったこと（ロールバック）」にできます。

```sql
-- 銀行振込のイメージ
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE id = 1;  -- A から引く
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;  -- B に足す

COMMIT;   -- 両方成功したら確定
```

もし2行目でエラーが起きても、ROLLBACK すれば1行目の UPDATE もなかったことになります。

### ACID 特性

トランザクションには4つの性質があります。

| 特性 | 意味 |
|------|------|
| 原子性（Atomicity） | 全部成功 or 全部失敗。中途半端な状態にならない |
| 一貫性（Consistency） | トランザクション前後でデータの整合性が保たれる |
| 分離性（Isolation） | 複数のトランザクションが互いに干渉しない |
| 永続性（Durability） | COMMIT したデータはクラッシュしても失われない |

> **ポイント**  
> トランザクションは「全部成功するか、全部なかったことにするか」を保証します。  
> 実務では銀行振込・在庫更新・注文処理など、複数テーブルにまたがる操作で必ず使います。

---

## 2. BEGIN / COMMIT の基本

本章で使うサンプルテーブルを用意します。

```sql
CREATE TABLE accounts (
    id      SERIAL PRIMARY KEY,
    name    TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0
);

INSERT INTO accounts (id, name, balance) VALUES
(1, '田中 太郎', 50000),
(2, '鈴木 花子', 30000),
(3, '山田 次郎', 10000);
```

### 基本的なトランザクション

```sql
-- トランザクション開始
BEGIN;

-- DML 操作
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;

-- 内容を確認
SELECT id, name, balance FROM accounts WHERE id IN (1, 2);
-- id=1: 40000, id=2: 40000 と表示される（まだコミットしていない）

-- 問題なければ確定
COMMIT;

-- コミット後に確認
SELECT id, name, balance FROM accounts WHERE id IN (1, 2);
-- コミットされたので同じ結果が返る
```

> **ポイント**  
> BEGIN ～ COMMIT の間はどんなに SELECT しても、他のセッションからは変更前の値が見えます。  
> これが「分離性」です。自分のセッションでは変更後の値が見えますが、COMMIT するまで  
> 他のセッションには反映されません。

---

## 3. ROLLBACK（取り消し）

COMMIT の代わりに ROLLBACK を使うと、BEGIN 以降のすべての変更が取り消されます。

```sql
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;

-- やっぱりやめる
ROLLBACK;

-- ROLLBACK 後の確認
SELECT id, name, balance FROM accounts WHERE id IN (1, 2);
-- 元の値 (50000, 30000) のまま
```

```sql
-- 確認してから判断するパターン
BEGIN;

DELETE FROM accounts WHERE balance < 5000;
-- DELETE 1 （山田次郎が削除対象）

SELECT COUNT(*) FROM accounts;
-- 2 になっている

-- 削除してよいか確認後に決定
-- よければ：COMMIT;
-- ダメなら：ROLLBACK;
ROLLBACK;   -- 今回はやめる
```

> **ポイント**  
> 本番環境での UPDATE / DELETE は必ず `BEGIN` から始めましょう。  
> 実行後に結果を SELECT で確認し、問題なければ COMMIT、おかしければ ROLLBACK できます。  
> これが「事故ゼロ」に向けた最も大切な習慣です。

---

## 4. SAVEPOINT / ROLLBACK TO SAVEPOINT

トランザクション全体ではなく、**途中の特定の地点まで戻す** ことができます。

```sql
BEGIN;

-- 最初の操作
UPDATE accounts SET balance = balance - 5000 WHERE id = 1;
-- id=1: 45000

-- セーブポイントを作成
SAVEPOINT before_transfer;

-- 追加の操作
UPDATE accounts SET balance = balance + 5000 WHERE id = 2;
-- id=2: 35000

-- ここまでの確認
SELECT id, name, balance FROM accounts;

-- この UPDATE だけを取り消したい
ROLLBACK TO SAVEPOINT before_transfer;
-- id=2 の変更が取り消される（id=1: 45000, id=2: 30000 に戻る）

-- 別の操作を試みる
UPDATE accounts SET balance = balance + 5000 WHERE id = 3;
-- id=3: 15000

-- 最終確認後にコミット
COMMIT;
-- id=1: 45000, id=2: 30000, id=3: 15000
```

### SAVEPOINT の削除

```sql
-- SAVEPOINT が不要になったら削除できる
RELEASE SAVEPOINT before_transfer;
```

> **ポイント**  
> SAVEPOINT は「複数ステップの処理の途中でやり直しが発生するかもしれない」場合に使います。  
> 実務では長いバッチ処理で「ここまでは確実にコミットしたい」という場面で活用します。

---

## 5. オートコミットの挙動（PostgreSQL のデフォルト）

PostgreSQL では、BEGIN なしで SQL を実行すると **自動的にコミット（オートコミット）** されます。

```sql
-- BEGIN なし → 自動コミット（取り消し不可）
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
-- 即座にコミットされる。ROLLBACK できない！
```

```sql
-- psql などのクライアントでオートコミットを無効にする
\set AUTOCOMMIT off   -- psql の場合

-- アプリケーションコードでは接続時の設定で制御する
```

> **注意**  
> psql（コマンドラインツール）では `\set AUTOCOMMIT off` でオートコミットを無効にできますが、  
> デフォルトはオンです。本番環境で直接 psql で操作するときは特に注意が必要です。  
> アプリケーションコードでは、ORM やドライバの設定でオートコミットを制御してください。

---

## 6. トランザクション内でエラーが起きた場合の挙動

PostgreSQL では、トランザクション内でエラーが発生すると、  
**そのトランザクションは「エラー状態」になり、COMMIT できなくなります。**

```sql
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
-- 成功

UPDATE accounts SET balance = balance + 10000 WHERE id = 999;
-- id=999 は存在するが、外部キー制約違反などのエラーが発生したとする
-- ERROR: ...

-- この時点でトランザクションはエラー状態
UPDATE accounts SET balance = 0 WHERE id = 2;
-- ERROR: current transaction is aborted, commands ignored until end of transaction block

COMMIT;
-- ROLLBACK が実行されたのと同じ扱い（変更はすべて取り消し）
```

エラー状態から回復するには ROLLBACK が必要です。

```sql
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE id = 1;

-- エラーが発生
UPDATE accounts SET balance = balance + 10000 WHERE id = 999;
-- ERROR: ...

-- エラー状態から回復
ROLLBACK;

-- 改めて正しいクエリで BEGIN から始める
BEGIN;
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
COMMIT;
```

> **注意**  
> エラーが発生してもそのまま COMMIT しようとしても、PostgreSQL は自動的に ROLLBACK します。  
> エラー後は必ず ROLLBACK してから、正しい処理を BEGIN から書き直しましょう。

---

## 7. 長時間トランザクションのリスク

トランザクションを長時間オープンにしたままにすると、様々な問題が起きます。

### ロック保持の問題

```sql
BEGIN;

-- この UPDATE は accounts テーブルの id=1 の行をロックする
UPDATE accounts SET balance = balance - 10000 WHERE id = 1;

-- ここで作業を止める（COMMIT も ROLLBACK もしない）
-- → id=1 の行は他のセッションから UPDATE できない状態になる！
```

他のセッションが `UPDATE accounts WHERE id = 1` しようとすると、  
このトランザクションが終わるまでずっと待ち続けます（デッドロックの原因にも）。

### VACUUM の妨害

PostgreSQL では不要になった行を VACUUM という処理が掃除しますが、  
長時間トランザクションがあると「その時点以降の行は不要と判断できない」ため、  
VACUUM が進まずテーブルが肥大化します。

```sql
-- 長時間実行中のトランザクションを確認する
SELECT
    pid,
    now() - pg_stat_activity.xact_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.xact_start) > INTERVAL '5 minutes'
  AND state != 'idle';
```

> **注意**  
> アプリケーションで DB 接続をオープンにしたまま外部 API コールや重い処理を挟むのは  
> 長時間トランザクションの典型的な原因です。  
> DB 操作の直前に BEGIN し、できるだけ短時間で COMMIT するよう設計しましょう。

> **現場メモ**  
> 長時間トランザクションによる障害は、本番で突然「DB全体が遅くなった」という形で現れることが多く、原因の特定に時間がかかります。筆者が関わったインシデントでは、夜間バッチが大量データを1トランザクションで処理していたため、バッチ実行中はユーザー向けのAPIがすべてロック待ちになっていました。`pg_stat_activity` で長時間実行中のトランザクションを確認したとき「なぜこのクエリが1時間以上実行されているのか」と初めて気づいた、という経験があります。本番DBでは定期的に `SELECT pid, now() - xact_start AS duration, query FROM pg_stat_activity WHERE state != 'idle'` を確認する監視を入れることを推奨します。また、トランザクション内でメール送信やSlack通知などの外部API呼び出しをしているコードは即座に修正対象です。

---

## 8. OFFSET ページングの問題

Web アプリでよく見る「前の10件 / 次の10件」のようなページング。  
単純な実装として OFFSET + LIMIT がありますが、大量データでは問題が出ます。

### OFFSET ページングの実装

```sql
-- ページ1（1〜10件目）
SELECT id, name, price FROM products ORDER BY id LIMIT 10 OFFSET 0;

-- ページ2（11〜20件目）
SELECT id, name, price FROM products ORDER BY id LIMIT 10 OFFSET 10;

-- ページ100（991〜1000件目）
SELECT id, name, price FROM products ORDER BY id LIMIT 10 OFFSET 990;

-- ページ10000（99991〜100000件目）
SELECT id, name, price FROM products ORDER BY id LIMIT 10 OFFSET 99990;
```

### OFFSET の問題点

**1. 大きな OFFSET は遅い**

```sql
-- これは99990行を読み飛ばしてから10行を返す
-- DB は最初の100000行をスキャンしてから10行を返す → 非常に遅い
SELECT id, name, price FROM products ORDER BY id LIMIT 10 OFFSET 99990;
```

OFFSET 値が大きくなるほどスキャン行数が増え、指数的に遅くなります。

```
OFFSET 0    → 10行スキャン
OFFSET 100  → 110行スキャン
OFFSET 1000 → 1010行スキャン
OFFSET 10000 → 10010行スキャン  ← ここから急激に遅くなる
```

**2. ページをめくる間にデータが変わるとズレる**

```
ページ1（1〜10件）を見ている間に、id=3 の行が削除される
↓
ページ2（OFFSET 10）に移動すると、元の11件目が10件目にずれる
→ 10件目のデータがスキップされて表示されない！
```

> **ポイント**  
> OFFSET ページングは「ページ数が少ない」「データ量が少ない」場合は問題ありません。  
> 数百万件のデータや「次のページ」が無限にある SNS のような UI では、  
> カーソルベースページングを使いましょう。

---

## 9. カーソルベースページング（キーセットページング）の概念

カーソルベースページング（キーセットページング）は、  
「前のページの最後のアイテムの値」を次のページ取得の条件に使う方法です。

### 基本的な考え方

```
ページ1：id が小さい順に 10件取得 → 最後の id は 10
ページ2：id > 10 という条件で 10件取得 → 最後の id は 20
ページ3：id > 20 という条件で 10件取得 → 最後の id は 30
```

OFFSET の代わりに「前のページの最後の id」を使って「続き」から取得します。

> **ポイント**  
> カーソルベースページングのメリット：  
> - 1ページ目も1000万ページ目も同じ速さで取得できる（インデックスを活用）  
> - データが追加・削除されても「次のページ」が正確に取れる  
> 
> デメリット：  
> - 「3ページ目に直接ジャンプ」ができない（前から順番にたどる必要がある）  
> - ページ番号を URL に表示する UI とは相性が悪い

---

## 10. カーソルベースページングの実装例

サンプルデータを用意します。

```sql
CREATE TABLE articles (
    id           SERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    published_at TIMESTAMP NOT NULL DEFAULT NOW(),
    author_id    INTEGER NOT NULL
);

-- 大量データを挿入（生成例）
INSERT INTO articles (title, published_at, author_id)
SELECT
    '記事タイトル ' || i,
    NOW() - (INTERVAL '1 second' * i),
    (i % 10) + 1
FROM generate_series(1, 100000) AS i;
```

### id 基準のカーソルページング

```sql
-- ページ1（最初の10件）
SELECT id, title, published_at
FROM articles
ORDER BY id ASC
LIMIT 10;
-- → 最後の id が 10 だったとする

-- ページ2（id > 10 の10件）
SELECT id, title, published_at
FROM articles
WHERE id > 10          -- 前ページの最後の id
ORDER BY id ASC
LIMIT 10;
-- → 最後の id が 20 だったとする

-- ページ3（id > 20 の10件）
SELECT id, title, published_at
FROM articles
WHERE id > 20
ORDER BY id ASC
LIMIT 10;
```

アプリケーションコードのイメージ（疑似コード）：

```sql
-- パラメータ :last_id = 前ページの最後のアイテムの id（初回は 0）
SELECT id, title, published_at
FROM articles
WHERE id > :last_id
ORDER BY id ASC
LIMIT :page_size;
```

### 複数列ソートのカーソルページング

id だけでなく、複数列でソートする場合はタプル比較を使います。

```sql
-- published_at の降順（同時刻の場合は id の降順）でのページング
-- 前ページの最後: published_at = '2024-03-01 12:00:00', id = 500

SELECT id, title, published_at
FROM articles
WHERE (published_at, id) < ('2024-03-01 12:00:00', 500)
ORDER BY published_at DESC, id DESC
LIMIT 10;
```

> **ポイント**  
> タプル比較 `(col1, col2) < (val1, val2)` を使うと、複数列でのカーソルページングが  
> すっきり書けます。PostgreSQL ではこの構文が使えます。

### 前方向と後方向

```sql
-- 前方向（次のページ）
SELECT id, title, published_at
FROM articles
WHERE id > :last_id
ORDER BY id ASC
LIMIT 10;

-- 後方向（前のページ）
SELECT id, title, published_at
FROM articles
WHERE id < :first_id
ORDER BY id DESC
LIMIT 10;
-- 取得後にアプリ側で順序を反転する
```

---

## 11. OFFSET とカーソルベースの使い分け基準

| 条件 | 推奨手法 |
|------|---------|
| 総データ件数が1万件未満 | OFFSET でも問題なし |
| 管理画面などページ番号ジャンプが必要 | OFFSET |
| SNS のタイムライン・無限スクロール | カーソルベース |
| 大量データ（数百万件以上）のページング | カーソルベース |
| データが頻繁に追加・削除される | カーソルベース（データのズレを防ぐ） |

```sql
-- OFFSET ページングのパフォーマンス確認
EXPLAIN ANALYZE
SELECT id, title FROM articles ORDER BY id LIMIT 10 OFFSET 99990;
-- → Seq Scan や大きな rows 数が出れば遅い

-- カーソルベースのパフォーマンス確認
EXPLAIN ANALYZE
SELECT id, title FROM articles WHERE id > 99990 ORDER BY id LIMIT 10;
-- → Index Scan が使われて rows が少ない
```

> **ポイント**  
> `EXPLAIN ANALYZE` でクエリの実行計画を確認しましょう。  
> カーソルベースではインデックス（主キー）を活用できるため、  
> 何ページ目でも同じ速さで実行できます。

---

## 12. よくあるミス

### ミス1：BEGIN を忘れてオートコミットで実行する

```sql
-- NG：BEGIN なしで実行するとロールバックできない
DELETE FROM accounts WHERE balance < 1000;
-- 即座にコミットされた。取り消し不可！
```

**対処法：** 常に BEGIN から始める癖をつける。

### ミス2：エラー後に ROLLBACK せず次の操作をする

```sql
BEGIN;
UPDATE accounts SET balance = -99999 WHERE id = 1;
-- CHECK 制約違反などでエラーが出たとする
UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
-- ERROR: current transaction is aborted, commands ignored until end of transaction block
COMMIT;
-- → 暗黙的に ROLLBACK される
```

**対処法：** エラーが出たら ROLLBACK してからやり直す。

### ミス3：OFFSET の値が大きいクエリをそのまま本番に出す

```sql
-- NG：OFFSET が大きいと非常に遅い
SELECT * FROM articles ORDER BY published_at DESC LIMIT 20 OFFSET 500000;
```

**対処法：** EXPLAIN ANALYZE でパフォーマンスを確認し、カーソルベースへ移行する。

### ミス4：カーソルページングで ORDER BY を忘れる

```sql
-- NG：ORDER BY がないと毎回違う順番で返ってくる可能性がある
SELECT id, title FROM articles WHERE id > 100 LIMIT 10;
```

**対処法：** カーソルページングでは必ず ORDER BY を付ける。

```sql
-- OK
SELECT id, title FROM articles WHERE id > 100 ORDER BY id ASC LIMIT 10;
```

### ミス5：長時間トランザクション内で API コールを行う

```sql
-- NG（疑似コード）：トランザクション内で外部処理を行う
BEGIN;
UPDATE orders SET status = '処理中' WHERE id = 1;

-- ここで外部APIを呼び出す（数秒〜数十秒かかることもある）
-- → その間ずっとロックを保持し続ける！

UPDATE orders SET status = '完了' WHERE id = 1;
COMMIT;
```

**対処法：** 外部処理は BEGIN の外で行い、DB 操作だけをトランザクション内に収める。

---

## 13. PRレビューのチェックポイント

### トランザクション設計

- [ ] **トランザクション内で外部 API 呼び出しやファイル I/O などの副作用を行っていないか**
  - ROLLBACK しても外部への影響は戻せない
- [ ] **1 トランザクションの処理量が大きすぎないか（バッチ処理は分割しているか）**
  - 長時間トランザクションはロックと VACUUM 妨害の原因になる
- [ ] **トランザクション内でエラーが起きたときに ROLLBACK されているか**
  - エラー後に COMMIT すると aborted state のまま操作することになる

### ページング

- [ ] **OFFSET ページングを大量データに適用しようとしていないか**
  - OFFSET が大きくなると全件スキャンが走り遅くなる
  - 「次ページ」機能には id 基準のカーソルページングを推奨
- [ ] **ページングに ORDER BY が付いているか**
  - ORDER BY なしでは結果の順序が保証されず、ページをまたいで重複・欠落が起きる
- [ ] **カーソルページングで使う列にインデックスがあるか**
  - `WHERE id > :cursor ORDER BY id LIMIT n` の id 列にインデックスが必要

---

## 14. まとめ

| テーマ | 要点 |
| --- | --- |
| トランザクション | 複数 DML をひとまとめ。全部成功 or 全部失敗（ACID） |
| BEGIN / COMMIT | トランザクション開始と確定 |
| ROLLBACK | トランザクションの全変更を取り消す |
| SAVEPOINT | トランザクション内の途中地点を保存。部分ロールバックが可能 |
| オートコミット | BEGIN なしの DML は即座にコミット。PostgreSQL のデフォルト |
| エラー時の挙動 | エラー後はトランザクションが aborted 状態に。ROLLBACK が必要 |
| 長時間トランザクション | ロック保持・VACUUM 妨害のリスク。できるだけ短くする |
| OFFSET ページング | シンプルだが大量データで遅い。データのズレも起きる |
| カーソルベースページング | 前ページの最後の値を WHERE 条件に使う。常に速い |
| 使い分け | 小規模・ページ番号ジャンプ必要 → OFFSET。大規模・SNS型 → カーソル |
| よくあるミス | BEGIN 忘れ / エラー後 ROLLBACK 忘れ / 大きな OFFSET / ORDER BY 忘れ |
