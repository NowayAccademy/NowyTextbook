# INSERT と UPSERT
データを挿入するINSERTと、競合時に更新するUPSERT（INSERT ON CONFLICT）を学びます

## 本章の目標

本章では以下を目標にして学習します。

- INSERT の基本構文で1行・複数行のデータを挿入できること
- 列を省略した場合の挙動（DEFAULT・NULL）を理解できること
- INSERT INTO ... SELECT ... で別テーブルからデータをコピーできること
- RETURNING 句で挿入した行の値を受け取れること
- UPSERT（INSERT ON CONFLICT）で「あれば更新、なければ挿入」を実装できること
- EXCLUDED を使って競合した行の値を参照できること

---

## 1. INSERT の基本構文

INSERT 文はテーブルに新しい行を追加します。

### 基本構文

```sql
INSERT INTO テーブル名 (列1, 列2, 列3)
VALUES (値1, 値2, 値3);
```

### 例：商品テーブルへの挿入

まず本章で使うサンプルテーブルを用意します。

```sql
-- 商品テーブル
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    code        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    price       INTEGER NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    category    TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 在庫ログテーブル
CREATE TABLE stock_logs (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    change      INTEGER NOT NULL,
    reason      TEXT,
    logged_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

```sql
-- 列を明示して1行挿入
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 150, 100, '果物');
```

> **ポイント**  
> 列名を明示して INSERT するのがベストプラクティスです。  
> テーブルに後から列が追加されても INSERT 文が壊れにくくなります。

---

## 2. 列を省略した場合の挙動

INSERT 時に列名を省略すると、定義された列の順番通りに値が割り当てられます。

```sql
-- 列名を省略した書き方（テーブルの全列に対して順番に値を指定）
INSERT INTO products
VALUES (DEFAULT, 'BANANA-001', 'バナナ', 120, 50, '果物', DEFAULT, DEFAULT);
```

| 状況 | 挿入される値 |
|------|-------------|
| DEFAULT が指定されている列を省略 | DEFAULT 値が使われる |
| DEFAULT のない列を省略 | NULL が入る（NOT NULL 制約があればエラー） |
| SERIAL / GENERATED 列を省略 | 自動採番される |

```sql
-- category を省略（NULL が入る）
INSERT INTO products (code, name, price)
VALUES ('GRAPE-001', 'ぶどう', 300);
-- category は NULL、stock は DEFAULT の 0、created_at/updated_at は DEFAULT の NOW()
```

> **注意**  
> NOT NULL 制約があり DEFAULT も指定されていない列を省略するとエラーになります。  
> `ERROR: null value in column "name" of relation "products" violates not-null constraint`  
> 必ず必須列は明示的に指定しましょう。

---

## 3. 複数行の INSERT

VALUES に複数組の値を書くことで、1つの INSERT 文で複数行を挿入できます。

```sql
-- 複数行を一度に挿入
INSERT INTO products (code, name, price, stock, category)
VALUES
    ('MANGO-001',   'マンゴー',   500, 30, '果物'),
    ('ORANGE-001',  'オレンジ',   100, 80, '果物'),
    ('SPINACH-001', 'ほうれん草',  80, 60, '野菜'),
    ('CARROT-001',  'にんじん',    60, 90, '野菜');
```

### 1行ずつ INSERT するのと複数行 INSERT の違い

| 方法 | ネットワーク往復 | パフォーマンス |
|------|----------------|--------------|
| 1行ずつ（ループ）| N 回 | 遅い |
| 複数行まとめて | 1回 | 速い |

> **ポイント**  
> アプリケーションから大量データを挿入する場合は、ループで1件ずつ INSERT するより  
> 複数行まとめた INSERT の方が大幅に速くなります。  
> ただし VALUES の数が非常に多い場合は分割して送ることを検討してください。

---

## 4. INSERT INTO ... SELECT ...

別テーブルや同じテーブルから SELECT した結果をそのまま挿入できます。

```sql
-- 別テーブルからコピー
CREATE TABLE products_backup (LIKE products INCLUDING ALL);

INSERT INTO products_backup
SELECT * FROM products;
```

```sql
-- 条件付きでコピー（果物カテゴリだけ別テーブルに移す）
CREATE TABLE fruits (
    id       SERIAL PRIMARY KEY,
    code     TEXT UNIQUE NOT NULL,
    name     TEXT NOT NULL,
    price    INTEGER NOT NULL DEFAULT 0,
    stock    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO fruits (code, name, price, stock)
SELECT code, name, price, stock
FROM products
WHERE category = '果物';
```

```sql
-- 集計結果を別テーブルに保存する（データウェアハウスでよく使うパターン）
CREATE TABLE daily_summary (
    summary_date  DATE,
    category      TEXT,
    total_stock   INTEGER,
    total_value   BIGINT
);

INSERT INTO daily_summary (summary_date, category, total_stock, total_value)
SELECT
    CURRENT_DATE           AS summary_date,
    category,
    SUM(stock)             AS total_stock,
    SUM(stock * price)     AS total_value
FROM products
WHERE category IS NOT NULL
GROUP BY category;
```

> **ポイント**  
> `INSERT INTO ... SELECT ...` は、ETL処理（データ変換・集約）やバックアップ作成に  
> よく使われるパターンです。SELECT 部分には GROUP BY や JOIN も使えます。

---

## 5. RETURNING 句

INSERT 後に挿入された行の値を取得できます。  
特に SERIAL や GENERATED カラムの自動採番値を受け取るときに便利です。

```sql
-- 挿入した行の id を取得する
INSERT INTO products (code, name, price, stock, category)
VALUES ('STRAW-001', 'いちご', 250, 40, '果物')
RETURNING id;
```

実行結果：

| id |
|----|
| 6  |

```sql
-- 複数列を RETURNING する
INSERT INTO products (code, name, price, stock, category)
VALUES ('WATER-001', 'スイカ', 800, 15, '果物')
RETURNING id, code, name, created_at;
```

実行結果：

| id | code       | name   | created_at          |
|----|------------|--------|---------------------|
| 7  | WATER-001  | スイカ | 2024-03-01 10:00:00 |

```sql
-- 全列を返す
INSERT INTO products (code, name, price)
VALUES ('MELON-001', 'メロン', 1200)
RETURNING *;
```

> **ポイント**  
> アプリケーション側で INSERT 直後に `lastInsertId` 的な値が必要な場合、  
> RETURNING id を使えば追加の SELECT が不要です。  
> パフォーマンス的にも優れており、PostgreSQL では積極的に使いましょう。

---

## 6. シーケンスの currval / nextval

PostgreSQL の SERIAL 型は内部的にシーケンスを使っています。  
シーケンスを直接操作することもできます。

```sql
-- 次の値を取得して進める（INSERT と同様の効果）
SELECT nextval('products_id_seq');

-- 現在のシーケンス値を確認（同一セッション内で nextval を呼んだ後のみ有効）
SELECT currval('products_id_seq');

-- シーケンス名を確認する
SELECT pg_get_serial_sequence('products', 'id');
-- 結果例: public.products_id_seq
```

```sql
-- INSERT 後に currval で id を取得（RETURNING の方が推奨）
INSERT INTO products (code, name, price) VALUES ('TEST-001', 'テスト', 100);
SELECT currval('products_id_seq');
```

> **注意**  
> `currval` は同一セッション内で `nextval` を呼んだ後でないと使えません。  
> 別セッションでの INSERT とは独立しており、自分のセッションで最後に発行した値を返します。  
> 実務では **RETURNING 句** を使う方がシンプルで安全です。

---

## 7. UPSERT（INSERT ON CONFLICT）の概念と使い所

**UPSERT** とは「INSERT」と「UPDATE」を組み合わせた造語で、  
「レコードがなければ挿入、あれば更新」という処理です。

### なぜ UPSERT が必要か？

たとえば「商品コードをユニークキーとして在庫を管理するテーブル」があるとします。  
同じ商品コードで INSERT すると UNIQUE 制約違反になります。

```sql
-- これは2回目にエラーになる
INSERT INTO products (code, name, price) VALUES ('APPLE-001', 'りんご', 150);
-- ERROR: duplicate key value violates unique constraint "products_code_key"
```

UPSERT を使えば、「既存ならスキップ or 更新」とシームレスに処理できます。

> **ポイント**  
> UPSERT の典型的な使い所：  
> - 外部システムからのデータ同期（あれば更新、なければ挿入）  
> - 設定値のセーブ（ユーザーIDでユニークな設定テーブル）  
> - 集計バッファの日次更新

> **現場メモ**  
> UPSERTは便利ですが「DO NOTHINGにすべきかDO UPDATEにすべきか」の判断ミスによるバグが現場では発生します。例えば「ユーザーの最終ログイン時刻を更新したい」のにDO NOTHINGにしていたせいで初回以降のログイン時刻が更新されなかった、という事故がありました。逆に「初回登録日を上書きしたくない」のにDO UPDATEにしてしまい、再登録のたびに登録日が書き換わる問題も起きています。「競合した場合に何をしたいか」を明確にしてからDO NOTHING / DO UPDATEを選んでください。また、複数行をUPSERTするときに一部だけ競合する場合の挙動も確認しておくことをお勧めします。

---

## 8. INSERT ON CONFLICT DO NOTHING

競合が発生した場合、エラーを出さずに何もしない（スキップする）パターンです。

```sql
-- UNIQUE 制約（code 列）違反になった場合は何もしない
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 150, 100, '果物')
ON CONFLICT (code) DO NOTHING;
```

- 新規レコードの場合：挿入される
- code='APPLE-001' が既に存在する場合：何も起きない（エラーなし）

```sql
-- DO NOTHING で複数行の一括 INSERT も安全になる
INSERT INTO products (code, name, price, stock, category)
VALUES
    ('APPLE-001', 'りんご',  150, 100, '果物'),  -- 既存：スキップ
    ('KIWI-001',  'キウイ',  200,  25, '果物')   -- 新規：挿入
ON CONFLICT (code) DO NOTHING;
```

> **ポイント**  
> DO NOTHING はべき等な INSERT（何度実行しても同じ結果になる処理）を  
> 実現するのに便利です。  
> バッチ処理や再実行可能なマイグレーションスクリプトでよく使われます。

---

## 9. INSERT ON CONFLICT DO UPDATE SET（競合時の更新）

競合が発生した場合に、既存レコードを更新するパターンです。

```sql
-- price と stock を最新値に更新する UPSERT
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 180, 120, '果物')
ON CONFLICT (code)
DO UPDATE SET
    price      = 180,
    stock      = 120,
    updated_at = NOW();
```

```sql
-- 主キーの競合を対象にする場合は ON CONFLICT (id)
INSERT INTO products (id, code, name, price, stock)
VALUES (1, 'APPLE-001', 'りんご', 180, 120)
ON CONFLICT (id)
DO UPDATE SET
    price = 180,
    stock = 120;
```

> **ポイント**  
> `ON CONFLICT (列名)` の列には UNIQUE 制約または主キーが必要です。  
> 通常の列（制約なし）は指定できません。

---

## 10. EXCLUDED（競合した行の値を参照する）

DO UPDATE SET 内では `EXCLUDED` というキーワードを使って、  
「今回 INSERT しようとした（競合した）行の値」を参照できます。

```sql
-- EXCLUDED を使って INSERT しようとした値をそのまま UPDATE に使う
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 180, 120, '果物')
ON CONFLICT (code)
DO UPDATE SET
    price      = EXCLUDED.price,      -- INSERT しようとした価格
    stock      = EXCLUDED.stock,      -- INSERT しようとした在庫
    name       = EXCLUDED.name,       -- INSERT しようとした名前
    category   = EXCLUDED.category,
    updated_at = NOW();
```

### 条件付き更新（価格が下がったときだけ更新する）

```sql
-- 価格が安くなった場合のみ更新する
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 130, 100, '果物')
ON CONFLICT (code)
DO UPDATE SET
    price      = EXCLUDED.price,
    updated_at = NOW()
WHERE products.price > EXCLUDED.price;   -- 現在価格 > 新しい価格のときのみ
```

### 在庫を加算する

```sql
-- 在庫を上書きするのではなく、競合時は加算する
INSERT INTO products (code, name, price, stock, category)
VALUES ('APPLE-001', 'りんご', 150, 50, '果物')
ON CONFLICT (code)
DO UPDATE SET
    stock      = products.stock + EXCLUDED.stock,  -- 既存在庫 + 追加在庫
    updated_at = NOW();
```

`products.stock` は「既存の値」、`EXCLUDED.stock` は「INSERT しようとした値」を指します。

> **ポイント**  
> EXCLUDED を使うと、INSERT 時に指定した値を DO UPDATE 側でも再利用できます。  
> ハードコードを避けられるため、カラムが増えても保守しやすいコードになります。

---

## 11. よくあるミス

### ミス1：列名を省略して列数の不一致エラー

```sql
-- NG：列数が合わない
INSERT INTO products VALUES ('APPLE-001', 'りんご', 150);
-- ERROR: INSERT has more target columns than expressions
```

**対処法：** 列名を明示するか、テーブルの全列分の値を指定する。

```sql
-- OK：列名を明示
INSERT INTO products (code, name, price)
VALUES ('APPLE-001', 'りんご', 150);
```

### ミス2：UNIQUE 制約違反を DO NOTHING と思ったら DO UPDATE だった（逆も然り）

DO NOTHING と DO UPDATE は目的が異なります。  
- 「2重登録を防ぎたいだけ」→ DO NOTHING  
- 「最新データで上書きしたい」→ DO UPDATE SET

### ミス3：ON CONFLICT に制約のない列を指定する

```sql
-- NG：category には UNIQUE 制約がない
INSERT INTO products (code, name, price, category)
VALUES ('APPLE-001', 'りんご', 150, '果物')
ON CONFLICT (category) DO NOTHING;
-- ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**対処法：** ON CONFLICT に指定できるのは UNIQUE 制約か主キーの列のみ。

### ミス4：INSERT の値の型が違う

```sql
-- NG：price は INTEGER なのに文字列を入れる
INSERT INTO products (code, name, price)
VALUES ('APPLE-001', 'りんご', '百五十円');
-- ERROR: invalid input syntax for type integer: "百五十円"
```

**対処法：** 数値型の列には数値を渡す。文字列から変換が必要なら `CAST` か `::` を使う。

```sql
-- OK
INSERT INTO products (code, name, price)
VALUES ('APPLE-001', 'りんご', '150'::INTEGER);
```

---

## 12. まとめ

| テーマ | 要点 |
| --- | --- |
| INSERT 基本構文 | `INSERT INTO テーブル (列...) VALUES (値...)` 列名を明示するのが安全 |
| 列の省略 | DEFAULT 値が入る。DEFAULT がなく NOT NULL なら挿入エラー |
| 複数行 INSERT | VALUES に複数組を指定。ループより高速でオススメ |
| INSERT ... SELECT | SELECT 結果をそのまま挿入。ETL・バックアップに活用 |
| RETURNING 句 | 挿入した行の値（自動採番 id など）を取得できる |
| currval / nextval | シーケンスの現在値・次値を取得する。RETURNING の方が推奨 |
| UPSERT の概念 | INSERT + UPDATE。「なければ挿入、あれば更新」 |
| DO NOTHING | 競合時にスキップ。べき等な INSERT に便利 |
| DO UPDATE SET | 競合時に既存行を更新。更新列を明示的に指定する |
| EXCLUDED | INSERT しようとした行の値を参照するキーワード |
| よくあるミス | 列数不一致 / 制約のない列への ON CONFLICT / 型の不一致 |
