# 変数とは
変数の基礎から整理して学びます。

## 本章の目標

本章では以下を目標にして学習します。

- 変数が何のためにあるか説明できること
- 宣言・初期化・代入の違いを区別できること
- 基本型と参照型の違いのイメージを持てること
- 命名規則とスコープ、定数（final）、キャストの基本を使えること
- よくあるミスを見つけて直せること

## 1. 変数とは何か？

### 変数 = データを入れる「箱」

変数とは、**プログラム中でデータを一時的に保存しておく入れ物**です。

現実世界で例えると：

| 現実 | プログラム |
| --- | --- |
| 名前を書いたメモ帳 | <code>String name = "田中太郎"</code> |
| 年齢を書いたふせん | <code>int age = 25</code> |
| 体重計の数値 | <code>double weight = 68.5</code> |

### なぜ変数が必要なの？

```java
// 変数を使わない場合 → 同じ値を何度も書く羽目に
System.out.println("田中太郎さん、こんにちは！");
System.out.println("田中太郎さんのポイントは100点です。");
System.out.println("田中太郎さん、ありがとうございました！");

// 変数を使う場合 → 一箇所変えるだけでOK
String name = "田中太郎";
System.out.println(name + "さん、こんにちは！");
System.out.println(name + "さんのポイントは100点です。");
System.out.println(name + "さん、ありがとうございました！");
```

> **ポイント**  
> 変数はただ「保存する」だけでなく、「意味を持たせる」ためにも使います。<code>100</code> という数字より <code>maxRetryCount = 100</code> と書いた方が、後から読んだときに何の値か一目でわかります。

## 2. 変数の宣言と初期化

### 基本の書き方

```
データ型  変数名  =  値;
  ↓        ↓        ↓
 int     score  =  85;
```

### 宣言・初期化・代入の違い

```java
// ① 宣言だけ（箱を用意する）
int score;

// ② 初期化（宣言と同時に最初の値を入れる）← これが一番よく使う！
int score = 85;

// ③ 後から値を入れる（代入）
int score;
score = 85;

// ④ 値を上書きする
int score = 85;
score = 92;  // 85 → 92 に変わる
```

### 複数の変数をまとめて宣言

```java
// 同じ型の変数は1行でまとめられる（ただし可読性に注意）
int x = 10, y = 20, z = 30;

// 個別に書く方が読みやすいことも多い
int x = 10;
int y = 20;
int z = 30;
```

> **注意**  
> 宣言だけして値を入れていない変数を使おうとするとコンパイルエラーになります。
> ※ローカル変数のみ
>
> ```java
> int score;
> System.out.println(score); // エラー！変数が初期化されていない
> ```

## 3. データ型の種類

Javaの型は大きく**基本型（プリミティブ型）**と**参照型**に分かれます。

### 基本型（プリミティブ型）8種類

| 型名 | サイズ | 扱える値の範囲 | 使いどころ |
| --- | --- | --- | --- |
| <code>byte</code> | 8bit | -128 〜 127 | ファイルの読み書きなど |
| <code>short</code> | 16bit | -32,768 〜 32,767 | ほぼ使わない |
| <code>int</code> | 32bit | 約-21億 〜 約21億 | **整数はこれが基本！** |
| <code>long</code> | 64bit | 約-920京 〜 約920京 | 大きな数、IDなど |
| <code>float</code> | 32bit | 小数点以下6〜7桁 | ほぼ使わない |
| <code>double</code> | 64bit | 小数点以下15桁 | **小数はこれが基本！** |
| <code>boolean</code> | 1bit | <code>true</code> / <code>false</code> | 条件フラグなど |
| <code>char</code> | 16bit | 「'あ'」などの1文字 | 1文字だけ扱いたい時 |

```java
// 実際の使用例
int age = 25;                    // 年齢
long userId = 1234567890123L;    // long型はLをつける
double price = 1980.50;          // 価格
boolean isActive = true;         // 有効フラグ
char grade = 'A';                // 1文字（char は1文字だけ）
```

### 参照型（よく使うもの）

```java
// String（文字列） ← 最もよく使う参照型
String name = "山田花子";
String message = "Hello, World!";
String empty = "";               // 空文字

// null（何も入っていない状態）
String value = null;
```

> **ポイント**
>
> **基本型**：変数の中に値そのものが入る
>
> **参照型**：変数の中にはデータの「場所（アドレス）」が入る
>
> これが <code>==</code> での比較が String で使えない理由です。

### どの型を使えばいいか迷ったら？

```
整数を使いたい   → int（大きければ long）
小数を使いたい   → double
文字列を使いたい → String
true/false      → boolean
```

## 4. 変数の命名規則

### Javaの命名ルール（必ず守る）

```java
// 正しい変数名
int age = 25;
String firstName = "太郎";
double taxRate = 0.1;
boolean isLoggedIn = false;

// 間違った変数名
int 1count = 0;         // 数字から始めてはいけない
String my-name = "X";   // ハイフンは使えない
int class = 10;         // 予約語は使えない
```

### 命名スタイル（推奨）

Javaでは変数に**キャメルケース（camelCase）** を使います。

```java
// キャメルケース（変数・メソッド名）
int userAge = 20;
String firstName = "太郎";
boolean isEmailVerified = true;
int totalLoginCount = 0;

// アッパーキャメルケース（クラス名）
class UserAccount {}
class EmailService {}

// 大文字スネークケース（定数）
final int MAX_RETRY_COUNT = 3;
final String BASE_URL = "https://example.com";
```

### 命名のコツ：「何が入っているか」がわかる名前を！

```java
// 意味がわからない
int a = 5;
String s = "田中";
boolean f = true;

// 読むだけで意味がわかる
int retryCount = 5;
String userName = "田中";
boolean isAuthenticated = true;
```

> **ポイント**  
> コードは「書く時間」より「読む時間」の方が圧倒的に長いです。6ヶ月後の自分や同僚が読んでも意味がわかる名前をつける習慣をつけましょう。

## 5. 変数のスコープ（有効範囲）

変数には**使える範囲（スコープ）** があります。宣言した <code>{ }</code> の中でしか使えません。

### スコープの基本

```java
public class ScopeExample {

    // ① グローバル変数（クラス全体で使える）
    String name = "田中";

    public void method1() {
        // ② ローカル変数（このメソッドの中だけ）
        int score = 85;
        System.out.println(name);   // インスタンス変数は使える
        System.out.println(score);  // 使える
    }

    public void method2() {
        System.out.println(name);   // インスタンス変数は使える
        // System.out.println(score); // エラー！method1のローカル変数は使えない
    }
}
```

### ブロック内のスコープ

```java
public void example() {
    int total = 0;

    for (int i = 0; i < 5; i++) {
        // i はこの for ブロックの中だけ有効
        total += i;
    }

    System.out.println(total);  // OK（totalはfor外で宣言）
    // System.out.println(i);   // エラー！i はfor外では使えない

    if (total > 5) {
        String message = "合計が5を超えました";
        System.out.println(message);  // OK
    }
    // System.out.println(message);   // エラー！if外では使えない
}
```

> **ポイント**  
> 変数は「生まれた <code>{</code> から <code>}</code> まで」生きています。

## 6. 定数（final）

変更してはいけない値には <code>final</code> をつけます。

```java
// final をつけると、以降の変更が禁止される
final int MAX_SCORE = 100;
final double TAX_RATE = 0.1;
final String APP_NAME = "MyApp";

MAX_SCORE = 200;  // コンパイルエラー！
```

### なぜ定数を使うの？

```java
// マジックナンバー（意味不明な数字）
if (age >= 20) { }
double tax = price * 0.1;
if (retryCount >= 3) { }

// 定数を使って意味を明確に
final int ADULT_AGE = 20;
final double CONSUMPTION_TAX_RATE = 0.1;
final int MAX_RETRY_COUNT = 3;

if (age >= ADULT_AGE) { }
double tax = price * CONSUMPTION_TAX_RATE;
if (retryCount >= MAX_RETRY_COUNT) { }
```

> **ポイント**  
> 「マジックナンバー」（コード中に突然現れる数字）は悪しき慣習です。定数化することで、値の意味が明確になり、変更箇所も一箇所にまとまります。

## 7. 型変換（キャスト）

### 自動型変換（暗黙的キャスト）

小さい型 → 大きい型は自動で変換されます。

```
byte → short → int → long → float → double
```

```java
int intValue = 100;
long longValue = intValue;    // int → long（自動）
double doubleValue = intValue; // int → double（自動）

System.out.println(longValue);   // 100
System.out.println(doubleValue); // 100.0
```

### 明示的型変換（キャスト）

大きい型 → 小さい型は明示的にキャストが必要です（データが失われる可能性あり）。

```java
double d = 3.99;
int i = (int) d;           // double → int（小数点以下は切り捨て！）
System.out.println(i);     // 3（3.99ではない！）

long big = 1234567890123L;
int small = (int) big;     // long → int（値が溢れる可能性あり！）
```

### String との変換

```java
// 数値 → String
int num = 42;
String str1 = String.valueOf(num);   // "42"
String str2 = Integer.toString(num); // "42"
String str3 = "" + num;              // "42"（簡易的な方法）

// String → 数値
String s = "123";
int parsed = Integer.parseInt(s);        // 123
double parsedD = Double.parseDouble("3.14"); // 3.14

// 変換できない文字列はエラーになる
int error = Integer.parseInt("abc"); // NumberFormatException！
```

## 8. よくあるミスと対処法

### ① 初期化忘れ

```java
// よくあるミス
int count;
count++;  // エラー！初期化されていない

// 初期化してから使う
int count = 0;
count++;
```

### ② String の比較に == を使う

```java
String a = "hello";
String b = "hello";

// == は参照（メモリのアドレス）を比較する
if (a == b) { }         // 場合によっては false になる

// equals() で中身を比較する
if (a.equals(b)) { }    // 正しい比較

// null チェックも忘れずに
if ("hello".equals(userInput)) { }  // userInputがnullでもOK
```

### ③ 整数同士の割り算

```java
// 予想と違う結果になる
int a = 5;
int b = 2;
double result = a / b;
System.out.println(result);  // 2.0（2.5ではない！）

// どちらかをdoubleにする
double result = (double) a / b;   // 2.5
double result2 = a / 2.0;         // 2.5
```

### ④ オーバーフロー

```java
// int の最大値を超えると予想外の値に
int max = Integer.MAX_VALUE;  // 2147483647
int overflow = max + 1;
System.out.println(overflow);  // -2147483648（マイナスになる！）

// 大きな数はlongを使う
long safe = (long) max + 1;
System.out.println(safe);  // 2147483648
```

### ⑤ NullPointerException

```java
String name = null;

// nullに対してメソッドを呼ぶとNullPointerException
System.out.println(name.length());  // エラー！

// nullチェックをしてから使う
if (name != null) {
    System.out.println(name.length());
}

// または三項演算子でデフォルト値を設定
int length = (name != null) ? name.length() : 0;
```

## 9. まとめ

| テーマ | 要点 |
| --- | --- |
| 変数の基本 | データを入れる箱。<code>データ型 変数名 = 値;</code> で宣言 |
| よく使う型 | 整数→<code>int</code>、小数→<code>double</code>、文字列→<code>String</code>、真偽→<code>boolean</code> |
| 命名規則 | キャメルケース、意味がわかる名前をつける |
| スコープ | 宣言した <code>{ }</code> の中だけで有効 |
| 定数 | <code>final</code> をつけると変更不可。マジックナンバーを避ける |
| 型変換 | 小→大は自動、大→小は明示的キャストが必要 |
| よくあるミス | 初期化忘れ、<code>==</code>でString比較、整数割り算、null参照 |

> **ポイント**  
> 変数はプログラミングの「土台」です。最初は型の種類や命名規則を覚えるのが大変かもしれませんが、毎日コードを書くうちに自然と身につきます。焦らず、一歩一歩進めていきましょう！
