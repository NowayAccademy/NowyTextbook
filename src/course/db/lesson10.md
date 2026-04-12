# 設計パターン（履歴・論理削除・物理削除）
時系列データの保持と削除方針の判断基準を学びます

## 本章の目標

本章では以下を目標にして学習します。

- 物理削除と論理削除の違いとそれぞれのトレードオフを説明できること
- 論理削除を実装するときの注意点（WHERE条件）を押さえられること
- 有効期間モデルと履歴テーブルパターンを設計の選択肢として使えること

## 1. なぜ削除・変更履歴が必要か

### 現場で「データを消してしまった」が大問題になる理由

データベースの `DELETE` は一見シンプルですが、業務システムでは「消していいデータ」と「絶対に消してはいけないデータ」があります。

**監査（Audit）の観点**  
金融・医療・EC・SaaSなど多くの業種では「いつ・誰が・何を変更/削除したか」の記録が法令・コンプライアンス上必要です。

**トレーサビリティの観点**  
「なぜこの注文金額になったのか」「過去のユーザー設定はどうだったか」を遡れないと、障害調査やカスタマーサポートができません。

**ロールバックの観点**  
誤削除が発生したとき、バックアップからの全体復元ではなく「そのデータだけ戻す」ためにも履歴が役立ちます。

> **ポイント**  
> 「削除する」という操作はシンプルですが、業務システムでは「消えた」ことへの影響が大きい。まず「本当に消していいのか」を問う習慣をつけましょう。

> **現場メモ**  
> 筆者が関わったプロジェクトで、リリース後にお客様から「先月退会したユーザーの購入履歴を確認したい」という問い合わせが来ました。しかしそのシステムでは退会時に `DELETE` で物理削除していたため、注文テーブルに外部キーで紐づいていたユーザー情報が丸ごと消えており、注文の「誰が買ったか」が追跡不能になっていました。Audit要件は設計初期に確認することを強くお勧めします。

## 2. 物理削除（DELETE）のメリット・デメリット

### 物理削除とは

物理削除は `DELETE` 文でレコードをテーブルから完全に取り除くことです。

```sql
-- 物理削除の例
DELETE FROM users
WHERE user_id = 42;

-- 削除後は SELECT しても見つからない
SELECT * FROM users WHERE user_id = 42;
-- 0 rows
```

### メリット

| メリット | 説明 |
| --- | --- |
| シンプル | SELECTに余計なWHERE条件が不要 |
| ストレージ節約 | 不要なデータが蓄積しない |
| パフォーマンス | テーブルが肥大化しないため検索が速い |
| GDPR対応 | 忘れられる権利（個人情報の完全削除）に対応しやすい |

### デメリット

| デメリット | 説明 |
| --- | --- |
| 復元不可 | バックアップなしには取り戻せない |
| 監査証跡なし | 「誰がいつ削除したか」が残らない |
| 参照整合性の問題 | 関連テーブルが外部キー制約でエラーになることがある |

> **注意**  
> 物理削除は「本当にデータが不要なとき」だけ使うべきです。ユーザーの「アカウント削除」操作でも、注文履歴や請求情報は法的に一定期間保持が必要な場合があります。

### 現場での判断基準

物理削除か論理削除かで迷ったら、**まず論理削除を選ぶ**ことを推奨します。理由は以下の通りです。

- 後から「やっぱり履歴が必要だった」となっても、論理削除なら対応できる
- 物理削除で消えてしまったデータは原則として取り戻せない
- 一方、「個人情報の完全削除（GDPRの忘れられる権利）」が要件にあるテーブルは最初から物理削除前提で設計する

チームで削除方針を決めずに開発を始めると、コード内で両方のパターンが混在してしまいます。**DB設計の最初のレビューで「このテーブルは物理か論理か」を全テーブル分確認する**慣習を持つことを推奨します。

## 3. 論理削除（deleted_at / is_deleted）のメリット・デメリット

### 論理削除とは

論理削除は「削除フラグ」や「削除日時」をカラムに記録し、実際にはレコードを残したまま「削除されたことにする」設計です。

```sql
-- 論理削除フラグのカラム追加パターン
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- 論理削除の実行（DELETE ではなく UPDATE）
UPDATE users
SET deleted_at = NOW()
WHERE user_id = 42;

-- 「削除されていない」レコードのみ取得
SELECT * FROM users
WHERE deleted_at IS NULL;
```

```sql
-- is_deleted（Boolean）パターン
ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET is_deleted = TRUE
WHERE user_id = 42;

SELECT * FROM users
WHERE is_deleted = FALSE;
```

> **ポイント**  
> `deleted_at TIMESTAMPTZ` パターンは「いつ削除されたか」の情報も持てるため、`is_deleted BOOLEAN` より多くの情報が得られます。現場では `deleted_at` が好まれることが多いです。

### メリット

| メリット | 説明 |
| --- | --- |
| データ復元が容易 | `UPDATE deleted_at = NULL` で復活できる |
| 監査証跡 | 「いつ削除されたか」が残る |
| 外部キー問題が起きにくい | レコードが残っているので参照整合性が壊れない |
| 調査・デバッグが容易 | 削除済みデータも遡れる |

### デメリット

| デメリット | 説明 |
| --- | --- |
| WHERE条件が増える | 全クエリに `WHERE deleted_at IS NULL` が必要 |
| 条件漏れのバグ | フィルタを忘れると削除済みデータが表示される |
| テーブルが肥大化 | データが蓄積し続ける |
| UNIQUE制約と相性が悪い | メールアドレスのUNIQUE制約などと競合する（後述） |

> **現場メモ**  
> 論理削除か物理削除かをチームで決めずに開発を始めると、コード内で両方のパターンが混在してしまいます。筆者が関わったプロジェクトでも、「このテーブルはdeletedフラグがあるが、あのテーブルはただDELETEしている」という状態になり、バグの温床になりました。最初のDB設計レビューで必ず決める慣習を持つことを推奨します。

## 4. 論理削除実装の注意点

### 全てのクエリにフィルタが必要

論理削除の最大の落とし穴は、**削除済みを除外するWHERE条件の漏れ**です。

```sql
-- NG: deleted_at のフィルタを忘れた
SELECT * FROM users WHERE email = 'alice@example.com';
-- 削除済みのユーザーも返ってしまう！

-- OK: 必ず IS NULL チェックを入れる
SELECT * FROM users
WHERE email = 'alice@example.com'
  AND deleted_at IS NULL;
```

> **現場メモ**  
> `deleted_at IS NULL` の書き忘れは、論理削除を導入したプロジェクトで最も頻繁に起きるバグです。実際に筆者が経験したインシデントとして、「退会済みユーザーがログインできてしまう」という問題がありました。認証クエリに `AND deleted_at IS NULL` が抜けていたためです。この種のバグはテスト環境では発見しにくく（削除済みデータが少ないため）、本番で初めて表面化することが多い点が厄介です。コードレビューでは「論理削除テーブルへのSELECTに必ずフィルタがあるか」を意識して確認するようにしています。

### PostgreSQLでビューを使って安全にする

```sql
-- 論理削除を意識しなくていいビューを作る
CREATE VIEW active_users AS
SELECT * FROM users WHERE deleted_at IS NULL;

-- ビュー経由でクエリを書けば安全
SELECT * FROM active_users WHERE email = 'alice@example.com';
```

> **ポイント**  
> ビューを作成しておくと、「フィルタ漏れ」のリスクを減らせます。ただしビューの存在を知らない開発者が直接テーブルを参照するケースも多いので、チーム内でのルール化が重要です。

### UNIQUE制約との競合問題

```sql
-- 問題：同じメールで再登録できない
CREATE TABLE users (
  user_id    SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,  -- 削除済みユーザーと衝突する
  deleted_at TIMESTAMPTZ
);

-- 解決策: UNIQUE制約を削除し、代わりに部分インデックスを使う
DROP INDEX users_email_key;

CREATE UNIQUE INDEX users_email_active_unique
ON users (email)
WHERE deleted_at IS NULL;  -- 削除されていない行だけにUNIQUEを保証
```

> **ポイント**  
> 部分インデックス（Partial Index）はPostgreSQLの強力な機能です。「削除されていないメールアドレスは重複禁止」という実務要件にぴったり合います。

### 論理削除テーブルのインデックス設計

論理削除を導入したテーブルはインデックスにも注意が必要です。

```sql
-- NG: deleted_at にインデックスがない状態で大量データを検索
SELECT * FROM users WHERE email = 'alice@example.com' AND deleted_at IS NULL;
-- テーブルが肥大化するとフルスキャンになりパフォーマンスが低下する

-- OK: 未削除行だけを対象にした部分インデックスを作成
CREATE INDEX idx_users_email_active ON users (email)
WHERE deleted_at IS NULL;

-- これにより、活きているデータだけのコンパクトなインデックスになる
-- 削除済みデータが増えてもインデックスサイズは変わらない
```

> **現場メモ**  
> 論理削除テーブルに通常のインデックスを貼っても、削除済みデータが蓄積するにつれてインデックスが肥大化し、パフォーマンスが劣化します。あるプロジェクトでは運用1年後に「最近検索が遅くなった」という報告があり、調べると論理削除テーブルに部分インデックスがなく、削除済みデータが全体の90%を占めていました。`WHERE deleted_at IS NULL` の部分インデックスに切り替えたところ、クエリ時間が10分の1以下になりました。

## 5. 有効期間モデル（valid_from, valid_to）

### 有効期間モデルとは

「ある期間だけ有効なデータ」を管理するためのパターンです。価格・税率・契約など「時間とともに変わるマスタデータ」に適しています。

```sql
-- 商品の価格履歴テーブル（有効期間モデル）
CREATE TABLE product_prices (
  price_id    SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(product_id),
  price       NUMERIC(10, 2) NOT NULL,
  valid_from  DATE NOT NULL,
  valid_to    DATE,  -- NULL = 現在も有効（無期限）
  CONSTRAINT chk_valid_range CHECK (valid_to IS NULL OR valid_from < valid_to)
);

-- データ挿入例（キャンペーン価格）
INSERT INTO product_prices (product_id, price, valid_from, valid_to)
VALUES
  (101, 1200.00, '2024-01-01', '2024-03-31'),  -- 通常価格
  (101,  980.00, '2024-04-01', '2024-04-30'),  -- 春キャンペーン
  (101, 1200.00, '2024-05-01', NULL);           -- 通常価格（現在も有効）

-- 現在有効な価格を取得
SELECT price
FROM product_prices
WHERE product_id = 101
  AND valid_from <= CURRENT_DATE
  AND (valid_to IS NULL OR valid_to > CURRENT_DATE);

-- 過去の特定日時点の価格を取得（タイムトラベルクエリ）
SELECT price
FROM product_prices
WHERE product_id = 101
  AND valid_from <= '2024-04-15'
  AND (valid_to IS NULL OR valid_to > '2024-04-15');
```

### 使い所

| ユースケース | 説明 |
| --- | --- |
| 商品価格・料金の履歴 | キャンペーン価格、値上げ前後の価格管理 |
| 社員の所属部署 | 異動を日付で管理、過去の在籍状況を再現できる |
| 契約・サブスクリプション | 契約期間の開始・終了を管理 |
| 税率・手数料 | 法改正前後の税率を正確に使い分ける |

> **ポイント**  
> 有効期間モデルは「過去に遡って正確な状態を再現したい」ときに強力です。「あの日の価格はいくらだったか」を正確に答えられます。

> **現場メモ**  
> ECサイトのプロジェクトで、注文テーブルが商品テーブルの現在価格を参照する設計になっていたことがありました。値上げ後に過去の注文を集計すると、当時と違う金額が表示されるというバグが発覚しました。有効期間モデルを導入するか、注文テーブルに注文時点の単価をスナップショットとして持たせることで解決しましたが、データ移行に多大なコストがかかりました。価格や税率など「変わりうる値を過去の記録に使っている」場合は、設計段階で必ず有効期間モデルを検討してください。

## 6. 履歴テーブルパターン

### 変更前後を別テーブルに保存する

「誰が・いつ・何を・どう変えたか」を完全に記録したい場合、**履歴テーブル（監査テーブル）**を用います。

```sql
-- メインテーブル
CREATE TABLE users (
  user_id    SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 履歴テーブル（変更前後のスナップショット）
CREATE TABLE user_audit_logs (
  log_id      SERIAL PRIMARY KEY,
  user_id     INT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data    JSONB,  -- 変更前のデータ（JSON形式で丸ごと保存）
  new_data    JSONB,  -- 変更後のデータ（JSON形式で丸ごと保存）
  changed_by  TEXT,   -- 変更を行ったアプリユーザー名など
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### PostgreSQLのトリガーで自動記録する

```sql
-- トリガー関数（変更時に自動で履歴を記録する）
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_audit_logs (user_id, operation, old_data, new_data, changed_at)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::JSONB END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::JSONB END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- トリガーの設定（INSERT/UPDATE/DELETE のたびに関数が呼ばれる）
CREATE TRIGGER users_audit
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH ROW EXECUTE FUNCTION log_user_changes();

-- 特定ユーザーの変更履歴を確認
SELECT
  operation,
  old_data ->> 'email'  AS 変更前メール,
  new_data ->> 'email'  AS 変更後メール,
  changed_at
FROM user_audit_logs
WHERE user_id = 42
ORDER BY changed_at DESC;
```

> **ポイント**  
> トリガーを使うと、アプリ側のコードを変えなくても変更履歴が自動で記録されます。ただしトリガーはデバッグが難しくなるため、チームで合意の上で使いましょう。

> **現場メモ**  
> 「Audit Trailは後で追加すればいい」と後回しにして痛い目を見た経験があります。リリース後に「管理者が何をしたか記録が必要」という要件が追加されたとき、稼働中のテーブルにトリガーを後付けする作業は想像以上に大変でした。既存データには履歴がなく、テスト環境では再現しにくいケースも多く、リリース作業に数スプリント費やしました。監査要件（Audit要件）はDB設計の初期段階で確認し、最初から履歴テーブルを用意しておくことを強くお勧めします。面接でも「設計時にAuditをどう考慮したか」はよく聞かれる観点です。

### 現場での判断基準

履歴テーブルか有効期間モデルかで迷ったときの判断軸です。

- **「誰が・いつ変えたか」が必要** → 履歴テーブル（Audit Log）
- **「あの時点でどの値だったか」が必要** → 有効期間モデル（valid_from / valid_to）
- **両方が必要なケースも多い**（例：価格テーブルは有効期間モデルで管理しつつ、誰が価格変更したかのAudit Logも取る）

## 7. 判断軸まとめ（どれを選ぶべきか）

| 状況 | 推奨パターン |
| --- | --- |
| 個人情報など完全削除が必要（GDPR等） | 物理削除（+ 監査ログは別途） |
| 誤削除リスクがある・復元が必要 | 論理削除（deleted_at） |
| 過去の状態を正確に再現したい（価格・税率） | 有効期間モデル（valid_from, valid_to） |
| 誰が何をいつ変えたかの完全な記録が必要 | 履歴テーブル（監査ログ） |
| シンプルさを優先・データ量が多い | 物理削除 |

> **ポイント**  
> これらは組み合わせて使えます。例えば「ユーザーテーブルは論理削除 + 変更は履歴テーブルに記録」という設計も一般的です。

## 8. よくある設計ミス

### ミス1: 全テーブルに論理削除を盲目的に適用する

論理削除は便利ですが、全テーブルに適用するとクエリが複雑になりパフォーマンスも低下します。本当に必要なテーブルだけに適用しましょう。

> **現場メモ**  
> あるプロジェクトでは「念のため全テーブルに論理削除を入れよう」というルールになっていました。ログテーブルや中間テーブルなど、論理削除が不要なテーブルにも `deleted_at` が付いており、全てのクエリで `WHERE deleted_at IS NULL` が必要になりました。結果として、ORM（ORMのSoftDeleteプラグインなど）の設定ミスで `deleted_at IS NULL` が漏れるバグが頻発しました。「論理削除が本当に必要か」をテーブルごとに議論することが重要です。

### ミス2: 削除フラグのフィルタを忘れたまま本番リリース

```sql
-- 本番で発生したバグの例
-- ユーザー一覧APIが退会済みユーザーを返していた
SELECT id, name, email FROM users;
-- → deleted_at IS NULL を忘れていた

-- コードレビューのチェックポイント
-- 「論理削除テーブルへのSELECTにフィルタがあるか」を必ず確認する
```

> **現場メモ**  
> 「SoftDeleteを後から導入しようとして大変だった」経験があります。当初は物理削除だったテーブルに、運用後に論理削除を追加する必要が生じたとき、既存のSELECT文が数十箇所あり、全てに `AND deleted_at IS NULL` を漏れなく追加する作業に追われました。既存のSQLはいつの間にか削除済みデータを返すようになっており、しかも既存テストにはその確認がなかったため、修正漏れを後から発見するのに苦労しました。論理削除の方針は**最初のDB設計時**に決め、後から変えないことを推奨します。

### ミス3: valid_to の境界値処理ミス

```sql
-- NG: 境界日のデータが二重に返る可能性がある
WHERE valid_from <= CURRENT_DATE AND valid_to >= CURRENT_DATE;

-- OK: half-open interval（前閉・後開）で統一する
WHERE valid_from <= CURRENT_DATE
  AND (valid_to IS NULL OR valid_to > CURRENT_DATE);
```

> **注意**  
> 有効期間の終了条件には `valid_to > 検索日` と `>` を使うのが一般的です（half-open interval）。チーム内で統一しないと、境界日のデータが2重に返ったり欠落したりします。

### ミス4: 論理削除済みデータのインデックスがない

```sql
-- deleted_at にインデックスがないと、大量データでフルスキャンになる

-- 解決策：未削除行だけの部分インデックスを作成
CREATE INDEX idx_users_active ON users (user_id)
WHERE deleted_at IS NULL;
```

### ミス5: 購入時の単価を商品テーブルから毎回参照する

論理削除とは直接関係ありませんが、「過去の状態を保持しない」設計ミスとして：  
注文時の単価を商品テーブルの現在価格で計算すると、値上げ後に過去の注文金額が変わってしまいます。注文時の情報は注文テーブル（または中間テーブル）にスナップショットとして保存しましょう。

## 9. PRレビューのチェックポイント

シニアエンジニアがこの章のテーマに関連するコードレビューで確認するポイントをまとめます。

### 削除方針の確認

- [ ] **物理削除か論理削除か、チームで決めた方針と一致しているか**
  - 新しいテーブルが追加されたとき、削除方針が既存テーブルと揃っているか確認する
- [ ] **物理DELETEを使っているコードが、本当に消してよいデータか判断されているか**
  - 監査やトレーサビリティが必要なデータに `DELETE` していないか

### 論理削除の実装確認

- [ ] **論理削除テーブルへのSELECTに `deleted_at IS NULL` が必ずあるか**
  - WHERE句の絞り込み、JOIN条件、サブクエリも含めて確認する
- [ ] **論理削除テーブルにUNIQUE制約がある場合、部分インデックスになっているか**
  - `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` の形になっているか
- [ ] **論理削除テーブルに適切な部分インデックスがあるか**
  - よく使うWHERE条件の列に `WHERE deleted_at IS NULL` 付きのインデックスがあるか

### 履歴・有効期間モデルの確認

- [ ] **価格・税率など「変わりうる値」を過去データに使っている場合、スナップショットを保持しているか**
  - 注文テーブルの単価が、商品テーブルを参照しているだけになっていないか
- [ ] **有効期間の境界条件が `valid_to > 検索日`（前閉後開）で統一されているか**
- [ ] **Audit要件があるテーブルに履歴テーブルまたはトリガーが用意されているか**

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| 削除・履歴が必要な理由 | 監査・トレーサビリティ・復元のため |
| 物理削除 | シンプルで高速、ただし復元不可・監査証跡なし |
| 論理削除 | 復元可能・監査証跡あり、全クエリにフィルタが必要 |
| deleted_at vs is_deleted | `deleted_at TIMESTAMPTZ` が情報量で優る |
| 論理削除の落とし穴 | WHERE条件漏れ、UNIQUE制約との競合、インデックス設計 |
| 有効期間モデル | 時間とともに変わるデータ（価格・税率）に有効 |
| 履歴テーブル | 変更前後のスナップショットを保持する完全な監査ログ |
| 選び方 | 要件（復元・監査・パフォーマンス）に応じて組み合わせる |
| 現場での原則 | 削除方針はチームで最初に決める。後から変えるコストは大きい |
