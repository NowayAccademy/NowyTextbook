# JavaScriptの役割とDOMへのアクセス
JS がブラウザ上で HTML をどう操作するかの入り口です。

## 本章の目標

本章では以下を目標にして学習します。

- JavaScript が「ユーザーの操作に応じて DOM を変える」役割だと説明できること
- `document.getElementById` で要素を取得する基本が書けること
- 取得した要素の `textContent` などを試せること

## 1. JavaScript の役割（フロント）

HTML/CSS が「静的な土台」だとすると、JavaScript は次のような働きをします。

- クリック・入力など**イベント**に反応する  
- DOM のテキストや属性を**書き換える**  
- 後の章では、**サーバーと非同期通信**も扱います  

> **ポイント**  
> 「ページが読み込まれたあとに動く」のが典型的です。`<script>` の置き場所や読み込み順は、実装で詰まりやすいのでメモしておきましょう。

## 2. DOM への参照

ブラウザは HTML を DOM として保持します。JavaScript から**ノードを取得**して操作します。

```html
<p id="message">こんにちは</p>
<script>
  const el = document.getElementById("message");
  console.log(el.textContent);
  el.textContent = "書き換えました";
</script>
```

`getElementById` は **id が一意**であることが前提です。

## 3. 他の取得方法（名前だけ）

現場では次のような API もよく使います（詳細はハンズオンで）。

- `querySelector` / `querySelectorAll` … CSS セレクタ風に取得  
- `getElementsByClassName` … クラス名で複数取得  

## まとめ

- JS は**イベント**と**DOM 操作**の中心役である  
- `document.getElementById` で**1要素**を取りやすい  
- 取得後に**プロパティ**で表示や属性を変えられる  
