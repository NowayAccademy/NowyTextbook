# SQL の集計：GROUP BY・HAVING
COUNT DISTINCT を含む集計と、よくある落とし穴を学びます

## 本章の目標
本章では以下を目標にして学習します。

- `GROUP BY` でグループ化し、集計関数と組み合わせて書けること
- `HAVING` が**グループに対する条件**であることを `WHERE` と区別できること
- `COUNT(*)` と `COUNT(DISTINCT 列)` の違いを説明できること

## 1. GROUP BY の基本

```sql
SELECT status, COUNT(*) AS cnt
FROM orders
GROUP BY status;
```

`SELECT` に出す列は、**集計関数で包む**か **`GROUP BY` に含める**必要があります（標準SQLの考え方）。

> **ポイント**  
> 「表示したい列をそのまま足す」とエラーになるのは、**どの行の値を出すか一意でない**からです。

## 2. HAVING（グループのフィルタ）

```sql
SELECT customer_id, SUM(total_amount) AS spend
FROM orders
GROUP BY customer_id
HAVING SUM(total_amount) >= 100000;
```

- **`WHERE`**：集計**前**の行を絞る  
- **`HAVING`**：集計**後**のグループを絞る  

> **ポイント**  
> 可能な条件は **`WHERE` に寄せる**方が、処理行数が減りやすいです。

## 3. COUNT DISTINCT

```sql
SELECT COUNT(DISTINCT user_id) AS active_users
FROM events
WHERE event_date = CURRENT_DATE;
```

**ユニーク数**を数えるときに使います。データ量が大きいと重くなりやすいので、**近似でよい**分析なら別手段も検討されます。

> **ポイント**  
> `COUNT(DISTINCT a, b)` のように複合 DISTINCT は方言差があるため、**プロジェクトの方言**で確認する。

## 4. 集計の落とし穴

### JOIN との組み合わせ

結合で**行が増える（多重化）**と、`SUM` や `COUNT` が**水増し**されます。  
対策：`GROUP BY` の前にサブクエリで重複を潰す、`COUNT(DISTINCT id)` を使う（状況による）など。

### NULL

集計対象列に NULL があると、`SUM`/`AVG` は無視、`COUNT(列)` は数えない。

> **ポイント**  
> 「売上サマリがおかしい」の多くは **JOIN の多重化**か **NULL** が原因、という経験則があります。

## まとめ

- `GROUP BY` は**グループ単位のサマリ**を作る  
- `HAVING` は**グループ条件**、`WHERE` は**行条件**  
- JOIN と組み合わせるときは**多重化**に注意し、`COUNT DISTINCT` を適切に使う  
