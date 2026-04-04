# NULL の扱い
IS NULL・COALESCE・3値論理・集計時の落とし穴を押さえます

## 本章の目標
本章では以下を目標にして学習します。

- SQL における **NULL は「未知」**であり、通常の比較と異なると説明できること
- `IS NULL` / `IS NOT NULL` と `= NULL` の違いを説明できること
- `COALESCE` の用途と、`COUNT(*)` と `COUNT(列)` の違いを説明できること

## 1. NULL とは何か

SQL の **NULL** は「空文字」や「0」とは別で、**値が未知／未設定**を表す特別な状態です。

> **ポイント**  
> 「NULL は等しくない」ではなく、**等しいかどうかも判定不能**という考え方に近いです。

## 2. 3値論理（TRUE / FALSE / UNKNOWN）

条件式の結果は **TRUE・FALSE・UNKNOWN** の3通りになります。  
`WHERE` 句は **TRUE の行だけ**が残り、**UNKNOWN は除外**されます。

```sql
-- 誤り：常に UNKNOWN になり、1行もヒットしない
SELECT * FROM t WHERE col = NULL;

-- 正しい
SELECT * FROM t WHERE col IS NULL;
```

> **ポイント**  
> `NOT IN` と NULL の組み合わせは、**想定外に0件**になりやすいので要注意です。

## 3. COALESCE

**`COALESCE(a, b, c, ...)`** は、左から最初の **NULL でない値**を返します。

```sql
SELECT name, COALESCE(nickname, name) AS display_name
FROM users;
```

表示用のデフォルト埋め、`ORDER BY` で NULL を後ろに回す工夫などに使います。

> **ポイント**  
> アプリ側の `null` 合体演算子と同じ発想ですが、**SQL でも揃えて書く**と一貫します。

## 4. 集計と NULL

| 式 | NULL をどう数えるか |
| --- | --- |
| `COUNT(*)` | 行数。NULL 列があっても1行として数える |
| `COUNT(列)` | その列が **NULL でない行**だけ数える |
| `SUM` / `AVG` | NULL は**無視**される（行が減ったように見える） |

```sql
SELECT COUNT(*) AS rows_cnt, COUNT(email) AS email_filled
FROM users;
```

> **ポイント**  
> 「件数が合わない」トラブルの原因のひとつが **NULL と COUNT の組み合わせ**です。

## 5. 実務での習慣

- 「未設定」を **NULL と空文字の二重表現**にしない（設計で決める）  
- 外部結合後は **想定外の NULL** が増えるので、`WHERE` の付け方に注意  

> **ポイント**  
> **NULL 許容は便利だが、仕様説明とクエリの複雑さを増やす**トレードオフがあります。

## まとめ

- NULL は **未知**であり、`=` ではなく **`IS NULL`** で判定する  
- 条件は **3値論理**になり、`WHERE` は UNKNOWN を落とす  
- **`COALESCE`** と **`COUNT(*)` / `COUNT(列)`** の違いを意識する  
