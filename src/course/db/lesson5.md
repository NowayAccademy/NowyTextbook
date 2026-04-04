# SQL 基礎：SELECT・WHERE・ORDER BY・LIMIT・OFFSET
行の絞り込みと並び替え、ページングの注意点を学びます

## 本章の目標
本章では以下を目標にして学習します。

- `SELECT` で取得列を指定し、`WHERE` で条件絞り込みができること
- `ORDER BY` で並び替え、`LIMIT` / `OFFSET` で件数制御ができること
- **ページングで OFFSET が増えると遅くなりやすい**理由を説明できること

## 1. SELECT と FROM

取得したい列をカンマ区切りで書き、`FROM` にテーブル名を書きます。

```sql
SELECT id, name, created_at
FROM customers;
```

`*` はすべての列を意味しますが、**本番系では列を明示**した方が安全なことが多いです。

> **ポイント**  
> 不要な列を取らないと、**転送量・メモリ・インデックス利用**の面でも有利です。

## 2. WHERE（条件）

```sql
SELECT *
FROM orders
WHERE status = 'shipped'
  AND total_amount >= 5000;
```

文字列は**クォート**、数値は型に合わせて書きます。

> **ポイント**  
> `WHERE` に関数をべた塗りすると**インデックスが効きにくい**ことがあります（例：`WHERE DATE(created_at) = ...`）。

## 3. ORDER BY（並び替え）

```sql
SELECT id, name
FROM products
ORDER BY price DESC, id ASC;
```

複数列のときは、**先に書いた列が優先**されます。

> **ポイント**  
> 並びが安定しないとページングで**同じ行が重複／欠落**することがあるため、**タイブレーク用に主キーなどを足す**のが定番です。

## 4. LIMIT と OFFSET（ページング）

```sql
SELECT id, name
FROM products
ORDER BY id
LIMIT 20 OFFSET 40;
```

- **`LIMIT`**：最大件数  
- **`OFFSET`**：先頭からスキップする行数  

### 注意点（OFFSET の罠）

`OFFSET` が大きいと、DB は**先頭から大量の行を読み飛ばす**ため遅くなりやすいです。  
実務では **キーセットページング**（`WHERE id > :last_id ORDER BY id LIMIT n`）なども検討します。

> **ポイント**  
> 「とりあえず `LIMIT 10 OFFSET 100000`」は、データ量が増えると**一覧APIのボトルネック**になりがちです。

## 5. よくあるつまずき

- `ORDER BY` を忘れて `LIMIT` だけ使うと、**どの行が返るか不定**になり得る  
- `NULL` の並び順は方言や設定の影響を受けることがある  

> **ポイント**  
> 仕様として順序が必要なら、**必ず `ORDER BY` を明示**します。

## まとめ

- `SELECT` / `WHERE` / `ORDER BY` は検索の基本である  
- `LIMIT` + `OFFSET` は手軽だが、**大きな OFFSET は重くなりやすい**  
- 安定したページングには **`ORDER BY` のタイブレーク**と、必要なら**キーセット方式**を検討する  
