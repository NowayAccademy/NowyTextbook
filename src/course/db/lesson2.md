# 環境構築
PostgreSQLをインストールし、SQLクライアントから接続して最初のSQLを実行します

## 本章の目標

本章では以下を目標にして学習します。

- PostgreSQLをインストールし、サービスとして起動・停止できること
- A5:SQL Mk-2からDBに接続し、SQLを実行して結果を確認できること
- psqlコマンドラインの基本操作（\l、\c、\dt）を使えること

## 1. PostgreSQLのインストール

### Macの場合（Homebrew推奨）

Homebrewはmacのパッケージマネージャーです。ターミナルを開いて以下を実行します。

```bash
# Homebrewのインストール（まだの場合）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# PostgreSQLのインストール（バージョン16を例に）
brew install postgresql@16

# パスを通す（.zshrc や .bash_profile に追記）
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# バージョン確認
psql --version
# psql (PostgreSQL) 16.x
```

> **ポイント**  
> Homebrewを使うと、バージョン管理や更新が簡単になります。会社の環境によっては別の方法（インストーラ使用など）が指定される場合もあります。

### Windowsの場合（インストーラー推奨）

1. [PostgreSQL公式サイト](https://www.postgresql.org/download/windows/)にアクセス
2. 「Download the installer」をクリック
3. バージョンを選択（16.x 推奨）し、Windowsインストーラーをダウンロード
4. ダウンロードした `.exe` ファイルを実行
5. インストールウィザードに従って進める

**インストール時の設定ポイント：**

| 項目 | 設定 |
| --- | --- |
| インストールディレクトリ | デフォルトのまま（`C:\Program Files\PostgreSQL\16`） |
| データディレクトリ | デフォルトのまま |
| パスワード | 忘れずにメモしておく（`postgres` ユーザーのパスワード） |
| ポート | `5432`（デフォルト） |
| ロケール | デフォルトのまま |

```bash
# Windowsのコマンドプロンプトでバージョン確認
psql --version
# psql (PostgreSQL) 16.x
```

> **注意**  
> インストール時に設定した `postgres` ユーザーのパスワードは必ずメモしてください。後の接続設定で必要になります。忘れると再設定が面倒です。

## 2. PostgreSQLの起動・停止確認

### Macの場合

```bash
# PostgreSQLを起動する
brew services start postgresql@16

# PostgreSQLを停止する
brew services stop postgresql@16

# PostgreSQLの状態を確認する
brew services list | grep postgresql
# postgresql@16 started ...（startedなら起動中）
```

### Windowsの場合

サービスとして自動起動されますが、手動で確認・操作する場合：

```
# 方法1: Windowsサービスから確認
Windowsキー + R → services.msc → postgresql-x64-16 を探す

# 方法2: コマンドプロンプト（管理者権限）
net start postgresql-x64-16   # 起動
net stop  postgresql-x64-16   # 停止
```

### 起動確認のSQL

```bash
# psqlコマンドでローカルに接続テスト
psql -U postgres -c "SELECT version();"
# PostgreSQL 16.x on ... というバージョン情報が返れば成功
```

> **ポイント**  
> PostgreSQLが起動していないとクライアントから接続できません。「接続できない」と思ったら、まずサービスが起動しているか確認するのが鉄則です。

## 3. A5:SQL Mk-2 のインストールと初期設定

### A5:SQL Mk-2 とは

A5:SQL Mk-2は、無料で使えるWindows向けの高機能SQLクライアントです。  
ER図の自動生成機能もあり、本コースでよく使います。

**ダウンロード：** https://a5m2.mmatsubara.com/

> **ポイント**  
> Macの場合は代替として **DBeaver**（https://dbeaver.io/）や **TablePlus** を使うと良いです。本資料ではA5:SQL Mk-2の手順を中心に説明しますが、DBeaverも操作の考え方は同じです。

### A5:SQL Mk-2 のインストール手順（Windows）

1. 上記サイトから最新版の zip をダウンロード
2. 任意のフォルダに解凍（インストーラー不要）
3. `A5M2.exe` を実行

### 初期設定

起動後、メニューから「データベース」→「データベースの追加と削除」を選び、接続設定を追加します。

## 4. 接続設定（host, port, database, user, password）

### A5:SQL Mk-2での接続設定

「データベースの追加と削除」→「追加」→「PostgreSQL」を選択

| 設定項目 | 値 | 説明 |
| --- | --- | --- |
| **ホスト名** | `localhost` | ローカルPCで動いているので localhost |
| **ポート番号** | `5432` | PostgreSQLのデフォルトポート |
| **データベース名** | `postgres` | 最初は初期DBに接続する |
| **ユーザーID** | `postgres` | 初期管理ユーザー |
| **パスワード** | （インストール時に設定したもの） | |

> **ポイント**  
> 接続情報は機密情報です。スクリーンショットを共有する際はパスワードをマスクする習慣をつけましょう。

> **現場メモ**  
> 「本番DBの接続情報を `.env` ファイルに書いてGitHubにpushしてしまった」という事故は珍しくありません。私が関わったプロジェクトでも、新しいメンバーが `.gitignore` を確認せずにpushしてしまったことがありました。GitHubの場合、pushした瞬間にBotがクロールしていることがあり、数分以内に不審なアクセスが発生することもあります。接続情報は絶対にコードやGitに含めてはいけません。`.env` は必ず `.gitignore` に含める、接続情報は環境変数で渡す、という2つのルールを最初から徹底してください。

### 接続文字列の形式（参考）

アプリケーションコードでDBに接続するときは、以下のような形式で接続情報を指定します。

```
postgresql://ユーザー名:パスワード@ホスト:ポート/データベース名

例：
postgresql://postgres:mypassword@localhost:5432/myapp_db
```

## 5. データベースの作成（CREATE DATABASE）

### 演習用データベースを作成する

接続できたら、演習用のデータベースを作成します。  
`postgres` という初期データベースにはあまり手を加えず、専用のDBを作る習慣をつけましょう。

```sql
-- データベースを作成する
CREATE DATABASE learning_db;

-- 文字コードと照合順序を明示的に指定する場合
CREATE DATABASE learning_db
    ENCODING = 'UTF8'
    LC_COLLATE = 'ja_JP.UTF-8'
    LC_CTYPE = 'ja_JP.UTF-8'
    TEMPLATE = template0;

-- 既存のデータベース一覧を確認する
SELECT datname FROM pg_database;
```

### データベースを作成したら接続先を変更する

A5:SQL Mk-2の接続設定のデータベース名を `learning_db` に変更するか、  
新しい接続設定を追加します。

> **注意**  
> PostgreSQLでは1つの接続は1つのデータベースに対して行います。`USE データベース名` というMySQLの構文はPostgreSQLでは使えません。別のDBに切り替えるには再接続が必要です。

## 6. 最初のSQL実行

### 動作確認のSQL

接続が成功したら、以下のSQLを実行して動作を確認します。

```sql
-- 定数を返すだけのSQL（接続確認に使う）
SELECT 1;
-- ?column?
-- ----------
--          1

-- バージョン情報を確認する
SELECT version();
-- version
-- -------------------------------------------------
-- PostgreSQL 16.x on x86_64-apple-darwin..., 64-bit

-- 現在の接続ユーザーとデータベースを確認する
SELECT current_user, current_database();
-- current_user | current_database
-- -------------+-----------------
-- postgres     | learning_db

-- 現在日時を取得する
SELECT NOW();
-- now
-- -------------------------------
-- 2024-01-15 10:30:00.123456+09
```

> **ポイント**  
> `SELECT 1` は「接続が正しくできているか」の確認に使う定番のSQLです。特に意味のある値ではありませんが、DBが応答してくれることを確認できます。

## 7. psqlコマンドライン（基本コマンド）

### psqlとは

`psql` はPostgreSQLに付属するコマンドラインクライアントです。  
GUIツールが使えない環境（サーバー上など）で特に役立ちます。

```bash
# psqlを起動して接続する
psql -U postgres -d learning_db
# -U : ユーザー名
# -d : データベース名
# -h : ホスト（省略時はlocalhost）
# -p : ポート（省略時は5432）
```

### よく使うメタコマンド

psqlには `\` で始まる特殊なコマンド（メタコマンド）があります。

```
\l          -- データベース一覧を表示（list databases）
\c db名     -- 別のデータベースに接続（connect）
\dt         -- 現在のDBのテーブル一覧を表示（describe tables）
\d テーブル名 -- テーブルの構造を表示（describe）
\du         -- ユーザー一覧を表示
\timing     -- SQL実行時間の表示をオン/オフ
\q          -- psqlを終了（quit）
```

```bash
# 実際の操作例
psql -U postgres

postgres=# \l
# データベース一覧が表示される

postgres=# \c learning_db
# You are now connected to database "learning_db" as user "postgres".

learning_db=# \dt
# テーブル一覧が表示される（まだ何もなければ「リレーションが見つかりません」）

learning_db=# SELECT NOW();
# 現在時刻が表示される

learning_db=# \q
# psqlを終了
```

> **ポイント**  
> psqlのメタコマンドはSQLではないため、末尾に `;` は不要です。SQLには `;` が必要です。この違いに注意してください。

## 8. よくあるつまずき

### 問題1：接続できない（Connection refused）

> 参照：[4. 接続設定](#4-接続設定host-port-database-user-password)

```
psql: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed:
No such file or directory
```

**原因と対処：**
- PostgreSQLが起動していない → `brew services start postgresql@16`（Mac）でサービスを起動する
- ポートが違う → 設定ファイルやサービスのポートを確認する

### 問題2：認証エラー（Authentication failed）

> 参照：[7. psqlコマンドライン](#7-psqlコマンドライン基本コマンド)

```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed:
FATAL: password authentication failed for user "postgres"
```

**原因と対処：**
- パスワードが間違っている → インストール時のパスワードを確認する
- パスワードを忘れた場合は、`pg_hba.conf` を編集して一時的に認証なしに変更し、パスワードをリセットする

### 問題3：データベースが存在しない

> 参照：[8. よくあるつまずき](#8-よくあるつまずき)

```
FATAL: database "learning_db" does not exist
```

**原因と対処：**
- DBを作成していない → `psql -U postgres -c "CREATE DATABASE learning_db;"`

### 問題4：Macで `brew services` が使えない

```bash
# Homebrewが古い可能性がある
brew update
brew upgrade

# またはpg_ctlを使って直接起動する
pg_ctl -D /opt/homebrew/var/postgresql@16 start
```

> **ポイント**  
> エラーメッセージをよく読むと、原因がほぼ書かれています。英語でも「何が問題か」のキーワードを拾う習慣をつけましょう。

> **現場メモ**  
> 本番サーバーに `psql` でSSH接続して調査する機会は実務でよくあります。GUIツールが使えない環境でも `\dt`・`\d テーブル名`・`\timing` を使いこなすと作業効率が大きく変わります。特に `\timing` はSQLの実行時間をミリ秒単位で表示してくれるので、パフォーマンス調査のときに重宝します。また、本番DB作業では `BEGIN; ... ROLLBACK;` のパターン（先にBEGINでトランザクションを開始し、変更内容を確認してからCOMMIT or ROLLBACK）を徹底することで、意図しないデータ変更のリスクを下げられます。

## ポイント

- 接続情報（ホスト・ポート・ユーザー・パスワード）をコードやGitリポジトリに含めていないか
- `.env` ファイルが `.gitignore` に追加されているか
- 本番環境と開発環境で別々のDB接続情報を使うように設定されているか
- データベース名が環境ごとに区別できるようになっているか（例：`myapp_dev`、`myapp_prod`）
- 新メンバーでも環境構築できるように接続手順がドキュメント化されているか

## まとめ

| テーマ | 要点 |
| --- | --- |
| インストール（Mac） | Homebrewで `brew install postgresql@16` |
| インストール（Windows） | 公式サイトからインストーラーを使う |
| 起動確認 | `brew services list` / Windowsサービスで確認 |
| A5:SQL Mk-2 | host, port, database, user, password の5項目で接続 |
| CREATE DATABASE | 演習用DBを作成し、そこで作業する習慣をつける |
| 接続確認 | `SELECT 1` や `SELECT version()` で動作確認 |
| psqlメタコマンド | `\l`（DB一覧）`\c`（接続切替）`\dt`（テーブル一覧）`\q`（終了） |
| トラブルシューティング | まずサービスの起動確認、次にパスワード確認 |

---

## 練習問題

### 問題1: データベースへの接続

psql コマンドラインで、ホスト `localhost`・ポート `5432`・データベース名 `myapp_db`・ユーザー名 `app_user` で接続するコマンドを書いてください。

<details>
<summary>回答を見る</summary>

```bash
psql -h localhost -p 5432 -d myapp_db -U app_user
```

**解説：** `-h` はホスト、`-p` はポート、`-d` はデータベース名、`-U` はユーザー名を指定します。接続後にパスワードを求められます。よく使う接続先は `.pgpass` ファイルや接続文字列（`postgresql://user:pass@host/db`）で管理すると便利です。

</details>

### 問題2: psql メタコマンド

psql に接続後、以下の操作をするメタコマンドを答えてください。

1. 現在のサーバーにあるデータベース一覧を表示する
2. `myapp_db` に接続を切り替える
3. 現在のデータベースにあるテーブル一覧を表示する
4. `users` テーブルのカラム定義を確認する

<details>
<summary>回答を見る</summary>

```
1. \l
2. \c myapp_db
3. \dt
4. \d users
```

**解説：** `\l`（list databases）、`\c`（connect）、`\dt`（describe tables）、`\d`（describe）はよく使うメタコマンドです。`\?` でメタコマンド一覧、`\q` で psql を終了できます。

</details>

### 問題3: 接続できないときのトラブルシューティング

`psql` で接続しようとしたら以下のエラーが出ました。まず確認すべきことを順番に答えてください。

```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed:
No such file or directory
```

<details>
<summary>回答を見る</summary>

**確認手順：**

1. **PostgreSQLサービスが起動しているか確認する**
   ```bash
   # Mac (Homebrew)
   brew services list | grep postgresql
   # 起動していなければ
   brew services start postgresql@16
   ```

2. **ポート番号が正しいか確認する**
   - デフォルトは 5432。別ポートで起動している場合は `-p` で指定する

3. **ソケットファイルのパスが正しいか確認する**
   - OS やインストール方法によってソケットパスが異なる場合がある

**解説：** "No such file or directory" はソケットファイルが存在しない = PostgreSQL が起動していないことを意味します。まずサービスの起動確認が最初の一手です。起動しているのに接続できない場合は、ホスト名・ポート・`pg_hba.conf` の認証設定を順に確認します。

</details>
