# 式と演算子を理解しよう
Javaで計算・比較・判定を行うための演算子を体系的に学びます。

## 本章の目標

本章では以下を目標にして学習します。

- 式の基本を説明できる
- 算術・代入・比較・論理演算子を使い分けられる
- 三項演算子 を正しく読める
- 優先順位が曖昧なときに括弧で意図を明示できる

## 1. 式とは何か

「式」とは、評価されると**値を返す**コードの断片です。変数、リテラル、演算子の組み合わせで構成されます。

```java
// これらはすべて「式」
42                  // リテラル -> int値 42 を返す
x + y               // 加算式 -> xとyの合計を返す
x > 0               // 比較式 -> boolean値を返す
"Hello" + " World"  // 文字列結合式
```

> **ポイント**
>
> 式は「文（Statement）」と異なります。  
> <code>x + y;</code> は式文ですが、<code>if (...) {...}</code> は式ではなく文です。

## 2. 算術演算子

数値の四則演算などを行う最も基本的な演算子です。

| 演算子 | 意味 | 例 | 結果 |
| --- | --- | --- | --- |
| `+` | 加算 | `10 + 3` | 13 |
| `-` | 減算 | `10 - 3` | 7 |
| `*` | 乗算 | `10 * 3` | 30 |
| `/` | 除算 | `10 / 3` | 3（整数除算） |
| `%` | 剰余（余り） | `10 % 3` | 1 |
| `++` | インクリメント（+1） | `x++` / `++x` | 後置 / 前置で異なる |
| `--` | デクリメント（-1） | `x--` / `--x` | 後置 / 前置で異なる |

```java
int a = 10, b = 3;

System.out.println(a + b);          // -> 13
System.out.println(a / b);          // -> 3  ※整数同士の割り算は整数になる
System.out.println(a % b);          // -> 1  ※割り切れない余り

// 浮動小数点にキャストすると小数になる
System.out.println((double) a / b); // -> 3.3333...

// 前置 vs 後置インクリメント
int x = 5;
System.out.println(x++);  // -> 5（出力後に+1）
System.out.println(x);    // -> 6

int y = 5;
System.out.println(++y);  // -> 6（+1後に出力）
```

> **ポイント**
>
> 整数÷整数は整数になります。<code>10 / 3 = 3</code>（余りは切り捨て）。  
> 小数が欲しい場合は <code>(double)</code> などでキャストしてください。

## 3. 代入演算子

変数に値を代入する演算子です。算術演算と組み合わせた複合代入演算子もよく使います。

| 演算子 | 意味 | 展開形 |
| --- | --- | --- |
| `=` | 代入 | `x = 5` |
| `+=` | 加算して代入 | `x = x + 5` |
| `-=` | 減算して代入 | `x = x - 5` |
| `*=` | 乗算して代入 | `x = x * 5` |
| `/=` | 除算して代入 | `x = x / 5` |
| `%=` | 剰余を代入 | `x = x % 5` |

```java
int score = 100;
score += 20;   // score = 120
score -= 30;   // score = 90
score *= 2;    // score = 180
score /= 3;    // score = 60
score %= 7;    // score = 4（60 ÷ 7 の余り）
```

## 4. 比較演算子

2つの値を比較し、`boolean`（true / false）を返します。`if` 文や `while` 文の条件でよく使います。

| 演算子 | 意味 | 例（x=5, y=3） | 結果 |
| --- | --- | --- | --- |
| `==` | 等しい | `x == 5` | true |
| `!=` | 等しくない | `x != y` | true |
| `>` | 大きい | `x > y` | true |
| `<` | 小さい | `x < y` | false |
| `>=` | 以上 | `x >= 5` | true |
| `<=` | 以下 | `y <= 3` | true |

```java
int x = 5, y = 3;
System.out.println(x == 5);  // -> true
System.out.println(x > y);   // -> true
System.out.println(x != y);  // -> true

// if文と組み合わせる
if (x > 0) {
    System.out.println("xは正の数です");
}
```

> **ポイント**
>
> 文字列の比較に <code>==</code> は使わないでください。   
> オブジェクトの参照を比較してしまいます。文字列は <code>.equals()</code> メソッドを使うのが正解です。

```java
// NG: 参照比較（意図しない結果になることがある）
String s1 = new String("hello");
String s2 = new String("hello");
System.out.println(s1 == s2);       // -> false（参照が異なる）

// OK: 値の比較
System.out.println(s1.equals(s2));  // -> true
```

## 5. 論理演算子

複数の条件を組み合わせて `boolean` を返します。

| 演算子 | 意味 | 説明 |
| --- | --- | --- |
| `&&` | AND（かつ） | 両方が true のとき true |
| `\|\|` | OR（または） | どちらか一方が true のとき true |
| `!` | NOT（否定） | true -> false、false -> true に反転 |

```java
int age = 20;
boolean hasLicense = true;

// AND: 両方の条件を満たすか
if (age >= 18 && hasLicense) {
    System.out.println("運転できます");  // -> 実行される
}

// OR: どちらかを満たすか
boolean isWeekend = true;
boolean isHoliday = false;
if (isWeekend || isHoliday) {
    System.out.println("休日です");  // -> 実行される
}

// NOT: 条件を反転
boolean isLoggedIn = false;
if (!isLoggedIn) {
    System.out.println("ログインしてください");  // -> 実行される
}
```

> **ポイント**
>
> 短絡評価：<code>&&</code> は左辺が false なら右辺を評価しません。<code>||</code> は左辺が true なら右辺を評価しません。  
> NullPointerException を防ぐテクニックとして活用されます。

```java
// nullチェック + メソッド呼び出しを短絡評価で安全に書く
String name = null;
if (name != null && name.length() > 0) {
    System.out.println("名前あり");  // nameがnullでも例外が出ない
}
```

## 6. 三項演算子

`if-else` を1行で書ける演算子です。シンプルな条件分岐に使います。

**構文**

```text
条件 ? trueの場合の値 : falseの場合の値
```

```java
int score = 75;
String result = (score >= 60) ? "合格" : "不合格";
System.out.println(result);  // -> 合格

// if-elseと同等の処理
String result2;
if (score >= 60) {
    result2 = "合格";
} else {
    result2 = "不合格";
}

// ネストも可能（ただし可読性が下がるので注意）
String grade = (score >= 90) ? "A" : (score >= 70) ? "B" : "C";
System.out.println(grade);  // -> B
```

> **ポイント**
>
> ネストが2段以上になると読みにくくなります。複雑な条件分岐は素直に <code>if-else</code> か <code>switch</code> を使いましょう。

## 7. 演算子の優先順位

複数の演算子が混在するとき、どの順番に評価されるかが優先順位です。**上が先（優先度が高い）**。

| 優先度 | 演算子 | 分類 |
| --- | --- | --- |
| 高 | `++` `--`（後置） | 単項 |
|  | `++` `--`（前置）、`!` | 単項 |
|  | `*` `/` `%` | 乗除算 |
|  | `+` `-` | 加減算 |
|  | `<` `<=` `>` `>=` `instanceof` | 比較 |
|  | `==` `!=` | 等値 |
|  | `&&` | 論理AND |
|  | `\|\|` | 論理OR |
|  | `? :` | 三項 |
| 低 | `=` `+=` `-=` `*=` `/=` `%=` | 代入 |

```java
// 優先順位の例
int result  = 2 + 3 * 4;     // -> 14（* が先に評価される）
int result2 = (2 + 3) * 4;   // -> 20（括弧が最優先）

boolean check = 5 > 3 && 2 < 4 || 1 == 2;
// = (5 > 3 && 2 < 4) || 1 == 2
// = (true && true)   || false
// = true || false
// -> true
```
> **ポイント**
>
> 優先順位を暗記するより、括弧で意図を明示する習慣をつけましょう。チームでの可読性が大幅に上がります。

## 8. まとめ

| テーマ | 要点 |
| --- | --- |
| 式と文 | 式は評価すると値を返す。文は処理のまとまり（<code>x + y;</code> は式文、<code>if</code> ブロックなどは文） |
| 算術演算子 | <code>+ - * / %</code>、<code>++</code> <code>--</code>。整数同士の <code>/</code> は整数になる（小数はキャストなど） |
| 代入演算子 | <code>=</code> と <code>+=</code> <code>-=</code> などの複合代入で簡潔に書ける |
| 比較演算子 | <code>== !=</code> <code>&lt;</code> <code>&gt;</code> など。文字列の比較は <code>==</code> ではなく <code>equals()</code> |
| 論理演算子 | <code>&&</code> と論理OR（縦線2つ）、<code>!</code>。短絡評価で null チェックなどを安全に書ける |
| 三項演算子 | <code>条件 ? 真のとき : 偽のとき</code>。ネストが深くなるなら <code>if-else</code> を検討 |
| 優先順位 | 表を暗記するより、**括弧で評価順を明示**する習慣がチーム開発で有効 |

> **ポイント**
>
> 演算子は一覧で暗記するより、サンプルをIDEで動かして値を変えて試すと定着しやすいです。優先順位に迷ったら括弧で意図をはっきりさせ、チームでも読みやすいコードを心がけましょう。手を動かした分だけ身につきます。