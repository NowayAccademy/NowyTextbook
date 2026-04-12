# CTE（WITH句）
WITH句で複雑なクエリを分解して読みやすくし、再帰CTEでツリー構造を扱います

## 本章の目標

本章では以下を目標にして学習します。

- WITH句を使ってクエリを読みやすく分解できること
- 複数のCTEを連鎖させて複雑な処理を段階的に書けること
- CTEとサブクエリ・VIEWの違いを理解して使い分けられること
- 再帰CTEを使って組織ツリーやカテゴリ階層を扱えること
- 無限再帰を防ぐための制限を書けること

---

## 1. CTEとは（Common Table Expression）

### CTEの概念

**CTE（Common Table Expression：共通テーブル式）**は、クエリの中で一時的に名前付きの結果セットを定義する仕組みです。`WITH` キーワードを使って書くため「WITH句」とも呼ばれます。

イメージとしては「作業用の一時テーブルに名前をつけて、その後のSELECTで使い回す」感じです。料理で例えると、「下ごしらえした食材に名前をつけて保管しておき、後で使う」ようなものです。

```sql
-- テーブル準備
CREATE TABLE employees (
    emp_id      INT PRIMARY KEY,
    emp_name    TEXT,
    department  TEXT,
    salary      INT,
    manager_id  INT
);

INSERT INTO employees VALUES
    (1, '社長 山田',   '経営', 1000000, NULL),
    (2, '部長 鈴木',   '開発', 700000,  1),
    (3, '部長 田中',   '営業', 680000,  1),
    (4, '課長 佐藤',   '開発', 550000,  2),
    (5, '課長 伊藤',   '開発', 530000,  2),
    (6, '一般 渡辺',   '開発', 400000,  4),
    (7, '一般 中村',   '営業', 380000,  3),
    (8, '一般 小林',   '営業', 360000,  3);
```

---

## 2. 基本的なCTE構文（WITH name AS (...)）

### CTEの書き方

```sql
-- 基本構文
WITH cte名 AS (
    -- ここにSQLを書く
    SELECT ...
)
SELECT *
FROM cte名;
```

```sql
-- 実例: 高給与社員のみを抽出するCTE
WITH high_salary_employees AS (
    SELECT emp_id, emp_name, department, salary
    FROM employees
    WHERE salary >= 500000
)
SELECT *
FROM high_salary_employees
ORDER BY salary DESC;
```

```sql
-- CTEを複数回参照する例
WITH dept_stats AS (
    SELECT
        department,
        AVG(salary) AS avg_salary,
        MAX(salary) AS max_salary,
        COUNT(*)    AS emp_count
    FROM employees
    GROUP BY department
)
SELECT
    department,
    avg_salary,
    max_salary,
    emp_count
FROM dept_stats
WHERE avg_salary > 500000;
```

> **ポイント**  
> CTEは `WITH` から始まり、最後に必ず `SELECT`（または `INSERT`/`UPDATE`/`DELETE`）が続きます。CTEの定義だけでは何も実行されません。

---

## 3. CTEを使うメリット（可読性・再利用性）

### サブクエリと比べての違い

```sql
-- サブクエリで書いた場合（ネストが深くて読みにくい）
SELECT
    d.department,
    d.avg_salary,
    e.emp_name
FROM (
    SELECT department, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department
) d
INNER JOIN employees e ON e.department = d.department
WHERE e.salary > d.avg_salary
ORDER BY d.department, e.salary DESC;

-- CTEで書いた場合（段階的で読みやすい）
WITH dept_avg AS (
    SELECT department, AVG(salary) AS avg_salary
    FROM employees
    GROUP BY department
)
SELECT
    da.department,
    da.avg_salary,
    e.emp_name,
    e.salary
FROM dept_avg da
INNER JOIN employees e ON e.department = da.department
WHERE e.salary > da.avg_salary
ORDER BY da.department, e.salary DESC;
```

> **ポイント**  
> CTEを使うと「まず部門別平均を計算し、次にその平均より高い社員を探す」という処理の意図が段階的に読み取れます。コードレビューや後の保守がしやすくなります。

---

## 4. 複数CTEの連鎖

### 複数のCTEを定義して組み合わせる

複数のCTEをカンマで区切って定義でき、後のCTEで前のCTEを参照できます。

```sql
WITH
-- ステップ1: 部門別の統計を計算
dept_stats AS (
    SELECT
        department,
        AVG(salary) AS avg_salary,
        COUNT(*)    AS emp_count
    FROM employees
    GROUP BY department
),
-- ステップ2: 平均給与でランキング
dept_ranked AS (
    SELECT
        department,
        avg_salary,
        emp_count,
        RANK() OVER (ORDER BY avg_salary DESC) AS salary_rank
    FROM dept_stats
),
-- ステップ3: 上位2部門のみ取得
top_departments AS (
    SELECT *
    FROM dept_ranked
    WHERE salary_rank <= 2
)
-- 最終結果を取得
SELECT
    td.department,
    td.avg_salary,
    td.emp_count,
    e.emp_name,
    e.salary
FROM top_departments td
INNER JOIN employees e ON e.department = td.department
ORDER BY td.salary_rank, e.salary DESC;
```

> **ポイント**  
> 複数CTEは `WITH` の中でカンマ区切りで書きます。後から定義したCTEは前のCTEを参照できますが、前のCTEが後のCTEを参照することはできません（順方向のみ）。

---

## 5. CTE vs サブクエリ（どちらを使うべきか）

### 使い分けの基準

```sql
-- 【サブクエリが適している場面】
-- シンプルな1回だけの条件フィルタ
SELECT emp_name
FROM employees
WHERE salary > (SELECT AVG(salary) FROM employees);

-- 【CTEが適している場面】
-- 同じ集計結果を複数回参照する場合
WITH avg_salary AS (
    SELECT AVG(salary) AS avg FROM employees
)
SELECT
    emp_name,
    salary,
    salary - (SELECT avg FROM avg_salary) AS diff  -- CTEを参照
FROM employees
WHERE salary > (SELECT avg FROM avg_salary);       -- 同じCTEを再利用
```

| 比較項目 | サブクエリ | CTE |
|----------|------------|-----|
| 書き方 | クエリ内にネスト | WITH句で先に定義 |
| 可読性 | ネストが深いと読みにくい | 段階的で読みやすい |
| 再利用 | 同じ内容を何度も書く必要がある | 同一CTEを複数箇所で参照できる |
| デバッグ | 部分的な確認が難しい | CTEを個別に実行して確認できる |
| パフォーマンス | DBによって最適化される | DBによって最適化される |

> **ポイント**  
> 複雑なクエリ、複数回参照する集計、段階的な処理にはCTEが向いています。シンプルな1回限りの条件にはサブクエリで十分です。迷ったらCTEを使う方が後の保守が楽になることが多いです。

> **現場メモ**  
> CTEを学ぶと「今まで苦労して書いていたクエリがこんなにシンプルになるのか」と感動するエンジニアが多いです。筆者が研修で一番「わかりやすかった」と言われたのもCTEの「段階的に処理を書いていける」という特性です。実務では特に「集計クエリのデバッグ」にCTEが役立ちます。WITH句の各ブロックを個別に SELECT して中間結果を確認できるため、「どのステップで行数がおかしくなっているか」を素早く特定できます。レポートやバッチ処理のような複雑なSQLを書く際は、最初からCTEで各処理を分けて書くことをお勧めします。

---

## 6. CTE vs VIEW（一時的か永続的か）

### VIEWとの違い

```sql
-- VIEW: データベースに保存される永続的な仮想テーブル
CREATE VIEW high_salary_view AS
SELECT emp_id, emp_name, salary
FROM employees
WHERE salary >= 500000;

-- 作成後は何度でも参照できる
SELECT * FROM high_salary_view;

-- CTE: クエリの実行中のみ存在する一時的なもの
WITH high_salary_cte AS (
    SELECT emp_id, emp_name, salary
    FROM employees
    WHERE salary >= 500000
)
SELECT * FROM high_salary_cte;  -- このクエリが終わるとCTEも消える
```

| 比較項目 | CTE | VIEW |
|----------|-----|------|
| 保存場所 | クエリ内（一時的） | データベース（永続的） |
| スコープ | 1つのクエリの中のみ | どこからでも参照可能 |
| 変更 | クエリを書き換えるだけ | ALTER/DROP VIEWが必要 |
| 権限管理 | なし | VIEWに権限を付与できる |
| 再帰 | WITH RECURSIVE が使える | 通常のVIEWは再帰不可 |

> **ポイント**  
> 「このクエリの中だけで使う一時的な整理」にはCTE、「チームで共有して繰り返し使うクエリ」にはVIEWが向いています。VIEWの詳細はlesson12で学びます。

---

## 7. 再帰CTE（WITH RECURSIVE）の概念

### 再帰CTEとは

**再帰CTE**は、CTE自身が自分自身を参照することで、階層構造（ツリー）を繰り返し辿る仕組みです。組織ツリー、カテゴリ階層、ファイルシステムなどのデータを扱うときに非常に強力です。

イメージとしては「数字を1から10まで順番に数える」ときに「前の数字に1を足す」という操作を繰り返すような感覚です。

再帰CTEは必ず2つの部分から構成されます：
1. **アンカー部分**：再帰の起点（最初の行）
2. **再帰部分**：前の結果を使って次の行を生成する

---

## 8. 再帰CTEの構文（アンカー部分 + 再帰部分）

### 基本構文

```sql
WITH RECURSIVE cte_name AS (
    -- アンカー部分（再帰の起点）
    SELECT ...初期値...

    UNION ALL

    -- 再帰部分（cte_nameを参照して次の行を生成）
    SELECT ...
    FROM cte_name
    WHERE ...終了条件...
)
SELECT * FROM cte_name;
```

### 1から10までの数字を生成する例

```sql
WITH RECURSIVE numbers AS (
    -- アンカー: 最初の値
    SELECT 1 AS n

    UNION ALL

    -- 再帰: 前の値に1を足す
    SELECT n + 1
    FROM numbers
    WHERE n < 10  -- 終了条件（これがないと無限ループ！）
)
SELECT n FROM numbers;
```

### 組織ツリーを辿る再帰CTE

```sql
-- 社長（id=1）から全部下を取得する
WITH RECURSIVE org_tree AS (
    -- アンカー: 社長から始める
    SELECT
        emp_id,
        emp_name,
        manager_id,
        0 AS depth,           -- 階層の深さ
        emp_name AS path      -- 所属パス
    FROM employees
    WHERE emp_id = 1          -- 社長のIDを指定

    UNION ALL

    -- 再帰: 直属の部下を追加していく
    SELECT
        e.emp_id,
        e.emp_name,
        e.manager_id,
        ot.depth + 1,
        ot.path || ' > ' || e.emp_name  -- パスを連結
    FROM employees e
    INNER JOIN org_tree ot ON e.manager_id = ot.emp_id
)
SELECT
    emp_id,
    REPEAT('  ', depth) || emp_name AS indented_name,  -- インデントで階層表現
    depth,
    path
FROM org_tree
ORDER BY path;
```

**結果イメージ**

| emp_id | indented_name     | depth | path                           |
|--------|-------------------|-------|--------------------------------|
| 1      | 社長 山田         | 0     | 社長 山田                      |
| 2      | 　部長 鈴木       | 1     | 社長 山田 > 部長 鈴木           |
| 3      | 　部長 田中       | 1     | 社長 山田 > 部長 田中           |
| 4      | 　　課長 佐藤     | 2     | 社長 山田 > 部長 鈴木 > 課長 佐藤 |

> **ポイント**  
> `WITH RECURSIVE` は、同じCTEを自己参照するため **UNION ALL** で接続します。アンカー部分が最初の行を生成し、再帰部分が終了条件を満たすまで繰り返し実行されます。

---

## 9. 再帰CTEの使い所（組織ツリー・カテゴリ階層）

### カテゴリ階層の展開

```sql
CREATE TABLE categories (
    cat_id    INT PRIMARY KEY,
    cat_name  TEXT,
    parent_id INT
);

INSERT INTO categories VALUES
    (1, '全商品',   NULL),
    (2, '食品',     1),
    (3, '電子機器', 1),
    (4, '野菜',     2),
    (5, '果物',     2),
    (6, 'スマホ',   3),
    (7, 'PC',       3),
    (8, 'にんじん', 4),
    (9, 'りんご',   5);

-- 「果物」カテゴリ以下の全商品を取得
WITH RECURSIVE cat_tree AS (
    -- アンカー: 「果物」から始める
    SELECT cat_id, cat_name, parent_id, 0 AS depth
    FROM categories
    WHERE cat_name = '果物'

    UNION ALL

    -- 再帰: 子カテゴリを追加
    SELECT c.cat_id, c.cat_name, c.parent_id, ct.depth + 1
    FROM categories c
    INNER JOIN cat_tree ct ON c.parent_id = ct.cat_id
)
SELECT cat_id, cat_name, depth
FROM cat_tree
ORDER BY depth, cat_id;
```

### 祖先を辿る（下から上へ）

```sql
-- 「一般 渡辺」（id=6）から社長までの経路を辿る
WITH RECURSIVE ancestors AS (
    SELECT emp_id, emp_name, manager_id
    FROM employees
    WHERE emp_id = 6  -- 渡辺から開始

    UNION ALL

    SELECT e.emp_id, e.emp_name, e.manager_id
    FROM employees e
    INNER JOIN ancestors a ON e.emp_id = a.manager_id
)
SELECT emp_id, emp_name
FROM ancestors;
```

> **ポイント**  
> 再帰CTEは「子から親方向」も「親から子方向」も自在に辿れます。JOINの向きを変えるだけで両方向の探索が可能です。

---

## 10. よくあるミス（無限再帰の防止）

### ミス1: 終了条件を書き忘れる

```sql
-- 危険な例: WHERE条件なしで無限ループ
-- WITH RECURSIVE infinite AS (
--     SELECT 1 AS n
--     UNION ALL
--     SELECT n + 1 FROM infinite  -- 永遠に増え続ける！
-- )
-- SELECT * FROM infinite;

-- 正しい例: 必ず終了条件を書く
WITH RECURSIVE safe AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM safe WHERE n < 100  -- 100で止まる
)
SELECT * FROM safe;
```

### ミス2: 循環参照データでの無限ループ

```sql
-- データに循環がある場合（A→B→C→A のような参照）は無限ループになる
-- 対策: 訪問済みIDを配列で追跡する
WITH RECURSIVE safe_traverse AS (
    SELECT emp_id, manager_id, ARRAY[emp_id] AS visited
    FROM employees
    WHERE emp_id = 1

    UNION ALL

    SELECT e.emp_id, e.manager_id, st.visited || e.emp_id
    FROM employees e
    INNER JOIN safe_traverse st ON e.manager_id = st.emp_id
    WHERE NOT (e.emp_id = ANY(st.visited))  -- 訪問済みは除外
)
SELECT emp_id FROM safe_traverse;
```

### ミス3: UNION と UNION ALL の間違い

```sql
-- 再帰CTEではUNION ALL を使う（UNION は各ステップで重複除去するため遅い）
-- また、論理的に重複がない場合はUNION ALLで問題ない
WITH RECURSIVE tree AS (
    SELECT emp_id, emp_name, 0 AS depth FROM employees WHERE emp_id = 1
    UNION ALL  -- UNION（ALL なし）にすると毎回重複チェックが走って遅くなる
    SELECT e.emp_id, e.emp_name, t.depth + 1
    FROM employees e INNER JOIN tree t ON e.manager_id = t.emp_id
)
SELECT * FROM tree;
```

### PostgreSQLの再帰深度制限

```sql
-- デフォルトでは再帰深度に制限がある
-- 深いツリーを辿る場合は設定を変更するか、終了条件を確認する
-- PostgreSQLでは max_recursive_depth のような設定はないが、
-- WHEREの終了条件で深さを制限するのが一般的
WITH RECURSIVE bounded_tree AS (
    SELECT emp_id, emp_name, 0 AS depth FROM employees WHERE emp_id = 1
    UNION ALL
    SELECT e.emp_id, e.emp_name, t.depth + 1
    FROM employees e
    INNER JOIN bounded_tree t ON e.manager_id = t.emp_id
    WHERE t.depth < 10  -- 最大10階層まで
)
SELECT * FROM bounded_tree;
```

> **注意**  
> 再帰CTEで無限ループが発生するとクエリが終わらなくなります。必ず終了条件を書き、データに循環参照がある場合は訪問済みチェックを追加しましょう。開発中は `WHERE depth < 5` のように浅い制限で動作を確認してから条件を調整するのが安全です。

---

## 11. PRレビューのチェックポイント

- [ ] **3段以上のネストしたサブクエリがあれば CTE への書き換えを提案する**
  - ネストが深いほどデバッグが難しく、レビューでの意図把握も困難になる
- [ ] **同じサブクエリを複数箇所で繰り返し書いていないか**
  - CTE に切り出して1箇所で定義する
- [ ] **再帰 CTE に LIMIT / `max_recursion_depth` の対策があるか**
  - 循環参照データや終了条件の漏れで無限ループになる可能性を確認
- [ ] **複雑な CTE を書いた場合、各ステップを単独で実行して中間結果を確認したか**
  - CTE のデバッグ方法としてブロックを個別に SELECT する手順を知っているか

---

## 12. まとめ

| テーマ | 要点 |
| --- | --- |
| CTEとは | WITH句で定義する一時的な名前付き結果セット |
| 基本構文 | `WITH name AS (SELECT ...) SELECT * FROM name` |
| メリット | 複雑なクエリを段階的に分解して可読性を上げる |
| 複数CTE | カンマ区切りで複数定義可能。後のCTEは前のCTEを参照できる |
| CTE vs サブクエリ | 複雑・複数回参照にはCTE、シンプルな1回にはサブクエリ |
| CTE vs VIEW | CTEは一時的（クエリ内のみ）、VIEWは永続的（DB保存） |
| 再帰CTEの仕組み | アンカー部分（起点）+ UNION ALL + 再帰部分 |
| 再帰CTEの用途 | 組織ツリー・カテゴリ階層・パス探索 |
| 無限再帰の防止 | 必ず終了条件（WHERE depth < N）を書く |
