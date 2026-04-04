# SQL 更新と安全運用
INSERT・UPDATE・DELETE・事故防止と制約違反の読み方

## 本章の目標
本章では以下を目標にして学習します。

- `INSERT` / `UPDATE` / `DELETE` を**意図を限定した形**で書けること
- 本番で起きがちな事故を防ぐ**手順習慣**を説明できること
- 代表的な制約違反エラーを読み、原因に結びつけられること

## 1. INSERT

```sql
INSERT INTO customers (name, email)
VALUES ('山田太郎', 'yamada@example.com');
```

複数行：

```sql
INSERT INTO customers (name, email)
VALUES
  ('a', 'a@example.com'),
  ('b', 'b@example.com');
```

> **ポイント**  
> アプリからは**プリペアドステートメント**で値を渡し、文字列連結で組み立てない。

## 2. UPDATE（最も事故りやすい）

```sql
UPDATE orders
SET status = 'shipped'
WHERE id = 12345;
```

### 事故防止の手順例

1. **まず `SELECT` で対象行を確認**（同じ `WHERE`）  
2. **トランザクション**で実行し、件数を確認  
3. 本番は**メンテナンス窓口・承認フロー**があることが多い  

> **ポイント**  
> `WHERE` を忘れた `UPDATE` / `DELETE` は**全件更新・全件削除**。クライアントの確認ダイアログ設定も活用する。

## 3. DELETE

```sql
DELETE FROM cart_items
WHERE cart_id = 99 AND added_at < NOW() - INTERVAL '30 days';
```

論理削除設計のテーブルでは、**物理 DELETE を禁止**する運用もあります。

> **ポイント**  
> 外部キーがあると `DELETE` が**弾かれる**ことがある。意図どおりか確認する。

## 4. 制約違反の読み方（例）

| メッセージのイメージ | 原因の方向 |
| --- | --- |
| unique violation | 一意制約・主キー重複 |
| foreign key violation | 参照先に行がない、子が残っている |
| not null violation | NULL 不可列に NULL |
| check violation | CHECK 条件を満たさない |

> **ポイント**  
> エラーに**制約名**が出る場合、DDL の名前をたどると早いです。

## まとめ

- 更新系は **`WHERE` の確認 → 件数確認 → 実行**の順を習慣にする  
- `INSERT`/`UPDATE`/`DELETE` は**権限・バックアップ・承認**とセットが実務  
- 制約エラーは**一意・外部キー・NOT NULL・CHECK**の4系統を意識して読む  
