# 配列を理解しよう
同じ型のデータをまとめて扱うための「配列」の宣言・利用・よくある落とし穴を押さえます。

## 本章の目標

本章では以下を目標にして学習します。

- 配列がなぜ必要か説明できること
- 宣言・生成・初期化の3パターンを書き分けられること
- インデックスと <code>length</code> を正しく使えること
- 拡張 <code>for</code> で配列を走査できること
- 多次元配列のイメージを持てること

## 1. 配列とは

**配列**は、**同じ型**の要素を**決められた個数**、**連続したメモリ上**に並べて扱う仕組みです。変数が1つずつだと、点数が100人分あるときに <code>score1</code> … <code>score100</code> のように書けなくなります。

| イメージ | 説明 |
| --- | --- |
| 連続した箱 | 0 番目から <code>length - 1</code> 番目まで番号（インデックス）が付く |
| 長さ固定 | 一度作った配列の要素数は（通常の配列では）変えられない |
| 同じ型だけ | <code>int[]</code> ならすべて <code>int</code> |

> **ポイント**
>
> 配列の**有効なインデックスは 0 〜 <code>length - 1</code>** です。「人間向けの1番目」はプログラムではインデックス <code>0</code> になります。

## 2. 宣言・生成・初期化

### 要素数だけ決めてから代入

```java
int[] scores;           // 宣言（まだ箱はない）
scores = new int[3];    // 長さ3の配列を生成（初期値0）
scores[0] = 80;
scores[1] = 92;
scores[2] = 70;
```

### 宣言と同時に生成

```java
double[] temps = new double[5];
```

### 初期値リストで一気に

```java
String[] days = { "月", "火", "水", "木", "金" };
// 長さは5。new String[] は省略形
```

> **ポイント**
>
> <code>int[] a</code> と <code>int a[]</code> はどちらも合法ですが、**<code>型[] 名前</code>** の書き方が一般的です。

## 3. インデックスと length

```java
int[] nums = { 10, 20, 30 };
System.out.println(nums.length);  // 3（フィールド。メソッドではない）
System.out.println(nums[0]);      // 10
System.out.println(nums[nums.length - 1]);  // 最後の要素 30
```

> **注意**
>
> 存在しないインデックスにアクセスすると実行時に <code>ArrayIndexOutOfBoundsException</code> になります。  
> 典型的なミス：<code>for (int i = 0; i <= nums.length; i++)</code> のように **<code>&lt;= length</code>** にしてしまう（正しくは <code>i &lt; length</code>）。

## 4. 配列とループ

### 通常の for

```java
int[] scores = { 88, 76, 90 };
for (int i = 0; i < scores.length; i++) {
    System.out.println((i + 1) + "人目: " + scores[i]);
}
```

### 拡張 for（要素値だけ欲しいとき）

```java
int sum = 0;
for (int s : scores) {
    sum += s;
}
System.out.println("合計: " + sum);
```

> **ポイント**
>
> **インデックスが必要**（隣と比較、入れ替えなど）は通常 <code>for</code>、**全要素をただ処理**なら拡張 <code>for</code> が読みやすいことが多いです。

## 5. 配列の参照（代入の意味）

配列型の変数には、**要素そのものではなく「配列オブジェクトへの参照」**が入ります。

```java
int[] a = { 1, 2, 3 };
int[] b = a;       // 同じ配列を指す
b[0] = 99;
System.out.println(a[0]);  // 99（a から見ても変わる）
```

> **ポイント**
>
> 「コピーしたつもりが参照だけコピーしていた」は現場でも起きます。**中身の複製**が必要なら <code>java.util.Arrays.copyOf</code> やループでのコピーなど別手段が必要です（ここでは「参照がある」ことだけ押さえましょう）。

## 6. 多次元配列（二次元）

「配列の配列」として表や座標のようなデータを扱えます。

```java
int[][] matrix = {
    { 1, 2, 3 },
    { 4, 5, 6 }
};
System.out.println(matrix[0][1]);  // 2

for (int i = 0; i < matrix.length; i++) {
    for (int j = 0; j < matrix[i].length; j++) {
        System.out.print(matrix[i][j] + " ");
    }
    System.out.println();
}
```

行ごとに列数が違う「ギザギザ配列」も作れますが、初心者のうちは**長方形の表**として使うイメージで十分です。

## 7. まとめ

| テーマ | 要点 |
| --- | --- |
| 配列の役割 | 同じ型をまとめて管理。インデックスは <code>0</code> 始まり |
| 宣言・生成 | <code>new 型[長さ]</code> または <code>{ ... }</code> で初期化 |
| <code>length</code> | 要素の個数。<code>length - 1</code> が最後のインデックス |
| ループ | <code>i &lt; arr.length</code> を基本。拡張 <code>for</code> も活用 |
| 参照 | 代入は参照の共有。コピーとは別物 |
| 二次元 | <code>[][]</code> とループの二重構造で表を扱う |

> **ポイント**
>
> 配列はあとから学ぶ <code>List</code> などと比べて**長さ固定**という制約があります。まずは境界（<code>0</code> 〜 <code>length - 1</code>）を体に染み込ませると、バグが激減します。サンプルを動かしながらインデックスと値の対応を確かめてみてください。
