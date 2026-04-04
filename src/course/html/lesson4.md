# その他よく使うタグ
リスト、リンク、画像など、ページで頻出する要素を押さえます。

## 本章の目標

本章では以下を目標にして学習します。

- `ul` / `ol` / `li` を使い分けられること
- `a` で内部・外部リンクを書けること
- `img` の `src` / `alt` の役割を説明できること

## 1. リスト

**順序なし**（箇条書き）は `ul` + `li`、**順序あり**は `ol` + `li` です。

```html
<ul>
  <li>HTML</li>
  <li>CSS</li>
  <li>JavaScript</li>
</ul>

<ol>
  <li>環境構築</li>
  <li>HTML</li>
  <li>CSS</li>
</ol>
```

## 2. リンク（アンカー）

`href` に移動先を指定します。別タブで開くときは `target` と `rel` を組み合わせます。

```html
<a href="https://example.com">外部サイトへ</a>
<a href="/about.html">同一サイト内の別ページ</a>
<a href="https://example.com" target="_blank" rel="noopener noreferrer">新しいタブで開く</a>
```

> **ポイント**  
> `target="_blank"` には **`rel="noopener noreferrer"`** を付けるのが安全面で推奨されます。

## 3. 画像

`src` に画像の URL、`alt` に**代替テキスト**（画像が見えないとき・読み上げ用）を書きます。

```html
<img src="./images/logo.png" alt="会社のロゴ">
```

装飾のみで意味がない画像は `alt=""` にする判断もあります（文脈による）。

## まとめ

- 箇条書きは `ul`、番号付きは `ol`、項目は常に `li`  
- リンクは `a` + `href`。外部を新規タブにする場合は `rel` に注意  
- 画像は `src` と**意味のある `alt`** をセットで考える  
