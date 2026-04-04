# JavaScriptの基本的な構文
変数・条件分岐・ループの骨格を、フロントの文脈で整理します。

## 本章の目標

本章では以下を目標にして学習します。

- `let` / `const` で変数を宣言できること
- `if` / `else` で処理を分岐できること
- `for` で繰り返し処理が書けること

## 1. 変数

```javascript
const userName = "Taro";   // 再代入しない値
let score = 80;            // 変わる値
score = score + 5;
```

現代の JS では **`const` をデフォルト**にし、必要なときだけ `let`、という書き方が一般的です。

> **ポイント**  
> `==` と `===` の違い（型変換の有無）は、バグの温床になりやすいので、**`===` を基本**にするとよいです。

## 2. 条件分岐

```javascript
const age = 20;
if (age >= 18) {
  console.log("成人");
} else {
  console.log("未成年");
}
```

## 3. ループ

```javascript
const items = ["HTML", "CSS", "JS"];
for (let i = 0; i < items.length; i++) {
  console.log(items[i]);
}

for (const name of items) {
  console.log(name);
}
```

## まとめ

- 変数は **`const` 優先**、`let` で更新が必要なときだけ使う  
- `if` で**条件分岐**、`for` で**繰り返し**  
- 配列と組み合わせると**一覧表示**などに直結する  
