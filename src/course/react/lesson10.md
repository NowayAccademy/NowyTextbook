# useState Hookの利用
`useState` で state と更新関数を扱います。

## 本章の目標

本章では以下を目標にして学習します。

- `const [value, setValue] = useState(initialValue)` の意味を説明できること
- **更新関数**で state を変えると再レンダリングが走ると理解すること

## 1. 基本形

```tsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      カウント: {count}
    </button>
  );
}
```

- `count` … 現在の値  
- `setCount` … 次の値をセットする関数  

> **ポイント**  
> state は**直接ミュータブルにいじらない**のが原則です。配列やオブジェクトは**コピーしてから**更新します。

## 2. 関数型更新

前の state に依存するときは `setCount((c) => c + 1)` のように**関数を渡す**と安全です。

## まとめ

- `useState` は**値と更新関数のペア**を返す  
- 更新で**再レンダリング**され、画面が追従する  
- 複雑な状態は**useReducer**や**状態管理ライブラリ**の出番（上級）  
