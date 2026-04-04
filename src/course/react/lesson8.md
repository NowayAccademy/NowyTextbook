# TSXでのPropsの型定義
`interface` で props の形を宣言し、予期しないデータを防ぎます。

## 本章の目標

本章では以下を目標にして学習します。

- `interface` で **Props 型**を切り出せること
- 必須・任意（`?`）を区別できること

## 1. Props 型の切り出し

```tsx
interface UserCardProps {
  name: string;
  role?: string;
}

function UserCard({ name, role }: UserCardProps) {
  return (
    <div>
      <strong>{name}</strong>
      {role && <span>（{role}）</span>}
    </div>
  );
}
```

> **ポイント**  
> 型を付けると、**呼び出し側のミス**（存在しない prop、型の食い違い）がエディタで赤くなります。

## 2. 予期せぬデータの防止

外部から来る JSON をそのまま表示に使うときほど、**一度型（またはスキーマ）で検証**する文化があります（上級では zod 等）。

## まとめ

- `interface` で **props の契約**を明示する  
- `?` で**任意プロパティ**  
- チーム開発で**インタフェースがドキュメント**になる  
