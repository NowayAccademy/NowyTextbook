# TypeScriptの基礎：関数の型付けとインターフェース
関数シグネチャと `interface` でオブジェクトの形を約束します。

## 本章の目標

本章では以下を目標にして学習します。

- 関数の**引数と戻り値**に型を付けられること
- `interface` で**オブジェクトの形**を定義できること

## 1. 関数の型

```typescript
function add(a: number, b: number): number {
  return a + b;
}

const mul = (a: number, b: number): number => a * b;
```

## 2. interface

```typescript
interface User {
  id: number;
  name: string;
  email?: string; // 省略可能
}

function greet(user: User): string {
  return `Hello, ${user.name}`;
}
```

> **ポイント**  
> API レスポンスや **props** の形を `interface` にすると、**変更の影響**が検査で見えます。

## 3. type との違い（入門）

`type` エイリアスでも似たことができます。チームの**スタイルガイド**に合わせます。

## まとめ

- 関数は**入出力の型**で契約する  
- `interface` は**オブジェクトの形**に向く  
- 変更に**型検査が追随**する  
