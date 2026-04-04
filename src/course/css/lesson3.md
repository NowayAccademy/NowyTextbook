# 実践的なレイアウト：Flexbox
横並び・中央寄せなど、実務で頻出の配置を `display: flex` で行います。

## 本章の目標

本章では以下を目標にして学習します。

- `display: flex` を親に指定すると子が並ぶと説明できること
- `justify-content` と `align-items` の役割の違いが分かること
- ナビゲーションやカード並びの簡単なレイアウトが組めること

## 1. Flexbox の考え方

**親要素（flex コンテナ）**に `display: flex` を指定すると、**子要素（flex アイテム）**が主軸に沿って並びます。

```css
.row {
  display: flex;
  gap: 12px;
}
```

## 2. よく使うプロパティ

| プロパティ | ざっくり効果 |
| --- | --- |
| `justify-content` | **主軸方向**の揃え（横並びなら左右の寄せ） |
| `align-items` | **交差軸方向**の揃え（横並びなら縦位置） |
| `flex-direction` | `row`（横）/ `column`（縦）など |
| `gap` | アイテム間のすき間 |

```css
.centered {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}
```

> **ポイント**  
> 「縦方向の中央」「横いっぱいに均等配置」など、**昔は大変だったパターン**が Flexbox で素直に書けるようになりました。

## 3. Grid との位置づけ

2次元の格子レイアウトには **CSS Grid** も強力です。まずは **Flexbox に慣れてから** Grid に広げると学びやすいです。

## まとめ

- 親に `display: flex` を付けると子が**主軸に沿って並ぶ**  
- `justify-content` / `align-items` で**寄せ**を制御する  
- 実務のナビ・ヘッダー・カード列にそのまま使える  
