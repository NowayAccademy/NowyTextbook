# 条件分岐と繰り返しを理解しよう
値や状況に応じて処理を変えたり、同じ処理を何度も実行したりするための基本を押さえます。

## 本章の目標

本章では以下を目標にして学習します。

- 条件分岐がなぜ必要か説明できること
- <code>if</code> / <code>else if</code> / <code>else</code> を使い分けられること
- <code>switch</code> の特徴と <code>break</code> の意味を説明できること
- <code>for</code>・拡張 <code>for</code>・<code>while</code>・<code>do-while</code> の違いを選べること
- <code>break</code> と <code>continue</code> の違いを説明できること

## 1. 条件分岐とは

プログラムは通常、上から順に実行されます。**条件分岐**は、「条件が成り立つかどうか」で**実行する処理を切り替える**仕組みです。

現実世界で例えると：

| 状況 | プログラムのイメージ |
| --- | --- |
| 信号が青なら渡る、赤なら止まる | <code>if (青) { 渡る } else { 止まる }</code> |
| 会員なら割引、そうでなければ定価 | <code>if (会員) { 割引 } else { 定価 }</code> |
| 点数で A/B/C を出し分ける | <code>else if</code> を重ねる |

> **ポイント**
>
> 分岐がないプログラムは「一本道」だけです。ユーザーの入力やデータの内容に応じて動きを変えるには、条件分岐が欠かせません。

## 2. if 文（if・else if・else）

### 基本形

条件は <code>boolean</code>（<code>true</code> / <code>false</code>）になる式を書きます。

```java
int score = 85;

if (score >= 80) {
    System.out.println("合格です");
}
```

### else と else if

```java
int score = 55;

if (score >= 80) {
    System.out.println("優秀");
} else if (score >= 60) {
    System.out.println("合格");
} else {
    System.out.println("再試験");
}
```

- <code>else if</code> はいくつでも続けられます（上から順に評価され、**最初に真になったブロックだけ**実行されます）。
- <code>else</code> は省略可能です（どれにも当てはまらないときの処理が不要なら書かない）。

### 1行だけのとき（ブレース省略）

```java
if (x > 0)
    System.out.println("正の数");
```

**ブレース <code>{}</code> を省略できるのは文が1つのときだけ**です。チーム規約によっては「常にブレースを付ける」ことも多く、現場では**付けておく方が安全**です。

> **注意**
>
> 条件に <code>=</code>（代入）を書いてしまうミスは現場でもよく起きます。比較は <code>==</code> や <code>&gt;=</code> など比較演算子を使います。  
> 文字列の比較は <code>==</code> ではなく <code>equals()</code> です（lesson3 の復習）。

```java
// 意図：x が 0 と等しいか
if (x == 0) { }

// よくある誤り（代入になってしまう。コンパイラが警告することも）
// if (x = 0) { }  // 多くの場合コンパイルエラー（int には使えないなど）
```

## 3. ネストした if（入れ子）

<code>if</code> の中にさらに <code>if</code> を書けます。条件が重なるときに使います。

```java
boolean isLoggedIn = true;
boolean isAdmin = false;

if (isLoggedIn) {
    if (isAdmin) {
        System.out.println("管理画面へ");
    } else {
        System.out.println("一般画面へ");
    }
} else {
    System.out.println("ログインしてください");
}
```

深く入れ子にすると読みにくくなるので、**論理演算子でまとめる**・**早期 return（メソッド内）**・**ガード節**などでフラットにする工夫が現場では重要です（まずは入れ子の意味を押さえましょう）。

> **ポイント**
>
> 「どの <code>else</code> がどの <code>if</code> に対応するか」は、**直近の <code>if</code> にぶら下がる**ルールです。迷ったらブレースとインデントをそろえて構造をはっきりさせましょう。

## 4. switch 文

**1つの値**が、**いくつかの候補のどれか**に当てはまるときに分岐を書きやすくする構文です。

### 古典的な switch

```java
int day = 3;  // 1=月 … 7=日 とする
switch (day) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
        System.out.println("平日");
        break;
    case 6:
    case 7:
        System.out.println("週末");
        break;
    default:
        System.out.println("不正な値");
        break;
}
```

- <code>case</code> のあとに <code>break;</code> がないと、**次の <code>case</code> も続けて実行**されます。意図的に使うこともありますが、**忘れるとバグ**の原因になります。
- <code>default</code> は「どの case にも当てはまらない」とき（省略可能ですが、想定外値の受け皿にすると安全なことが多いです）。

### String や enum も switch にできる

```java
String command = "save";
switch (command) {
    case "save":
        System.out.println("保存");
        break;
    case "load":
        System.out.println("読込");
        break;
    default:
        System.out.println("不明");
        break;
}
```

> **ポイント**
>
> 「候補が少ない・列挙的」なら <code>switch</code>、「範囲や複雑な条件」なら <code>if</code> が向きやすい、とざっくり覚えておくと選びやすいです。

## 5. 繰り返し（ループ）とは

**同じような処理を複数回**実行したいときに使います。回数が決まっている場合も、条件が満たされるまで続ける場合もあります。

| 種類 | 向いていること |
| --- | --- |
| <code>for</code> | 回数が決まっている、カウンタで回す |
| 拡張 <code>for</code> | 配列やコレクションの全要素を順に見る |
| <code>while</code> | 条件が真のあいだ繰り返す（0回もありうる） |
| <code>do-while</code> | 少なくとも1回は実行してから条件を見る |

## 6. for 文

### 通常の for

```java
// 0, 1, 2, 3, 4 を表示
for (int i = 0; i < 5; i++) {
    System.out.println(i);
}
```

- 第1部分：初期化（ループ変数を用意）
- 第2部分：継続条件（<code>true</code> のあいだ繰り返す）
- 第3部分：1回の繰り返しの末尾で実行（多くはカウンタ更新）

ループ変数 <code>i</code> のスコープは <code>for</code> の <code>{}</code> の中だけです。

### 二重ループ（例：九九）

```java
for (int i = 1; i <= 9; i++) {
    for (int j = 1; j <= 9; j++) {
        System.out.print(i * j + "\t");
    }
    System.out.println();
}
```

> **注意**
>
> 条件を間違えると**無限ループ**になります。例：<code>for (int i = 0; i < 5; i--)</code> のように <code>i</code> が減り続けて <code>i &lt; 5</code> がずっと真、など。ループ変数の更新を必ず確認しましょう。

## 7. 拡張 for 文（for-each）

配列や <code>Iterable</code> なコレクションの**要素を先頭から順に**扱うときに簡潔に書けます。

```java
int[] scores = { 80, 92, 70 };
for (int score : scores) {
    System.out.println(score);
}
```

```java
java.util.List<String> names = java.util.List.of("太郎", "花子");
for (String name : names) {
    System.out.println(name);
}
```

> **ポイント**
>
> 拡張 <code>for</code> は「要素を読む」には便利ですが、**インデックスが必要**な処理（隣の要素と比較など）は通常の <code>for</code> の方が向くことがあります。

## 8. while 文と do-while 文

### while

条件が <code>true</code> のあいだ、ブロックを繰り返します。**最初の時点で条件が偽なら1回も実行されません。**

```java
int n = 1;
while (n <= 3) {
    System.out.println(n);
    n++;
}
```

### do-while

**一度実行してから**条件を判定します。少なくとも **1回は必ず** ブロックが走ります。

```java
int n = 1;
do {
    System.out.println(n);
    n++;
} while (n <= 3);
```

入力の検証（「正しい値が入るまで聞き直す」）などで <code>do-while</code> が使われることもあります。

## 9. break と continue

### break

**一番内側の** <code>switch</code> またはループから抜けます。

```java
for (int i = 0; i < 10; i++) {
    if (i == 5) {
        break;  // ループ全体を終了
    }
    System.out.println(i);  // 0〜4
}
```

### continue

**今回の繰り返しだけ**スキップして、次の繰り返しに進みます。

```java
for (int i = 0; i < 5; i++) {
    if (i == 2) {
        continue;  // 2 のときは println を飛ばす
    }
    System.out.println(i);  // 0, 1, 3, 4
}
```

> **ポイント**
>
> <code>break</code> / <code>continue</code> を多用すると読み流しにくくなることがあります。**ネストが深くなったサイン**として見直すとよいです。まずは動作を確実に理解しましょう。

## 10. まとめ

| テーマ | 要点 |
| --- | --- |
| 条件分岐 | 状況に応じて処理を変える。<code>if</code> / <code>else if</code> / <code>else</code> が基本 |
| 比較の注意 | 等しいかは <code>==</code>、文字列は <code>equals()</code>。代入の <code>=</code> と混同しない |
| <code>switch</code> | 値の一致で分岐。<code>break</code> 忘れで fall-through する |
| <code>for</code> | 初期化・条件・更新で回数ループ。ループ変数のスコープは <code>{}</code> 内 |
| 拡張 <code>for</code> | 配列・コレクションの要素を順に処理 |
| <code>while</code> / <code>do-while</code> | 条件ベースの繰り返し。<code>do-while</code> は必ず1回実行 |
| <code>break</code> / <code>continue</code> | ループ脱出／今回だけスキップ。使いすぎに注意 |

> **ポイント**
>
> 条件分岐とループは、あとから出てくる配列・コレクション・メソッド分割とずっと組み合わせて使います。サンプルをコピーして条件や回数を変え、IDE で実行しながら「どの行が何回動いたか」を追うと理解が早くなります。焦らず一歩ずつで大丈夫です。
