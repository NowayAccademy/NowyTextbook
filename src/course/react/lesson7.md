# Propsによるデータ受け渡し
親から子へ一方向にデータを渡す仕組みです。

## 本章の目標

本章では以下を目標にして学習します。

- props が**親→子の入力**だと説明できること
- 子は props を**書き換えない**（イミュータブルに扱う）前提を理解すること

## 1. props とは

**Properties** の略で、親コンポーネントが子に渡す**読み取り専用に近い入力**です。

```tsx
function Greeting(props: { name: string }) {
  return <p>Hello, {props.name}</p>;
}

// 利用側
<Greeting name="Hanako" />
```

## 2. 分割代入

```tsx
function Greeting({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}
```

> **ポイント**  
> 状態を**持たせたい**ときは props ではなく **state**（次章以降）を検討します。

## 3. children

タグの中身は **`children`** として渡せます。

```tsx
import type { ReactNode } from "react";

function Panel({ children }: { children: ReactNode }) {
  return <div className="panel">{children}</div>;
}
```

## まとめ

- props は**親から子への一方向**のデータである  
- 子は**受け取って表示**が基本である  
- `children` で**ラップ構造**を表現できる  
