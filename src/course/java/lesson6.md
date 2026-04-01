# メソッドを理解しよう
処理に名前を付けてまとめる「メソッド」の書き方・呼び出し・オーバーロードを、現場で使うイメージで整理します。

## 本章の目標

本章では以下を目標にして学習します。

- メソッドを使う理由を説明できること
- 戻り値・引数・<code>void</code> の違いを区別できること
- メソッドを定義し、呼び出せること
- **オーバーロード**（同名・引数違い）を説明できること
- <code>return</code> の動き（途中終了）を理解すること

## 1. メソッドとは

**メソッド**は、**まとまった処理に名前を付けたもの**です。同じ処理を何度も書かずに、名前で呼び出せます。また、長い <code>main</code> を小さな単位に分けると**読みやすく・直しやすく**なります。

| 用語 | 意味 |
| --- | --- |
| 戻り値 | メソッドが呼び出し元へ返す結果（ない場合は <code>void</code>） |
| 引数 | 呼び出し時に渡す入力の値 |
| シグネチャ | メソッド名＋引数の型と個数（オーバーロードの区別に使う） |

> **ポイント**
>
> 「1メソッド1責任」に近づけるほど、後から読む人が迷いにくくなります。最初は短いメソッドに分ける癖をつけるとよいです。

## 2. メソッドの基本形

```java
public class Calculator {

    // 戻り値 int、名前 add、引数は int が2つ
    public static int add(int a, int b) {
        int sum = a + b;
        return sum;
    }

    public static void main(String[] args) {
        int x = add(3, 5);
        System.out.println(x);  // 8
    }
}
```

- <code>public static</code> は「どこからでも」「インスタンスなしで呼べる」という意味（詳細はクラスの章で深掘りできます）。
- <code>return</code> で値を返すと、その時点でメソッドは終了します。

## 3. void（戻り値なし）

結果を返さず、表示や更新だけ行うときに <code>void</code> を使います。

```java
public static void greet(String name) {
    System.out.println("こんにちは、" + name + "さん");
}

public static void main(String[] args) {
    greet("太郎");
}
```

> **ポイント**
>
> 「何を返すか」がはっきりしているメソッドの方がテストしやすい、という考え方もあります。最初は <code>void</code> で慣れ、慣れたら戻り値で結果を返す形も試してみましょう。

## 4. 引数と戻り値の例

```java
public static boolean isEven(int n) {
    return n % 2 == 0;
}

public static int max(int a, int b) {
    if (a >= b) {
        return a;
    }
    return b;
}
```

複数の <code>return</code> があってもよいです（どれか1つに到達すればその時点で終了）。

## 5. オーバーロード（Overload）

**同じメソッド名で、引数の型や個数が違う**定義を複数用意できます。呼び出し時に、渡した引数に合う方が選ばれます。

```java
public static int add(int a, int b) {
    return a + b;
}

public static int add(int a, int b, int c) {
    return a + b + c;
}

public static double add(double a, double b) {
    return a + b;
}
```

> **注意**
>
> 戻り値の型だけが違うオーバーロードは、Java では**使えません**（呼び分けができないため）。区別できるのは**引数リスト**です。

## 6. メソッドの呼び出し順

```java
public static void main(String[] args) {
    step1();
    step2();
}

public static void step1() {
    System.out.println("1");
}

public static void step2() {
    System.out.println("2");
}
```

<code>main</code> が入口になり、そこから他のメソッドへ処理が飛びます。**スタック**で戻り先が管理されるイメージは、デバッガで「ステップイン」すると実感しやすいです。

## 7. まとめ

| テーマ | 要点 |
| --- | --- |
| メソッドの役割 | 処理の再利用・分割・名前付けで読みやすさ向上 |
| 戻り値 | 型を宣言し <code>return</code> で返す。<code>void</code> は返さない |
| 引数 | 呼び出し側から値を渡す。型と順番が一致する |
| <code>return</code> | 呼び出し元へ戻る。複数あってもよい |
| オーバーロード | 同名でも引数が違えば別メソッドとして共存 |
| <code>static</code> | インスタンスなしで呼ぶ（入門では <code>main</code> からの呼び出しで十分） |

> **ポイント**
>
> メソッドは「小さく・意味が名前からわかる」ようにすると、半年後の自分とチームに優しいコードになります。まずは <code>main</code> から数個に分けるところから、繰り返し練習してみてください。
