# 実践ハンズオン：自己紹介ページをデザインしよう
HTML編で作成した「自己紹介ページ」は、まだ白黒で味気ない状態です。  
本章では、CSSの知識を総動員して、このページをモダンで美しいWebサイトに進化させます。  

## 本章の目標  

本章では以下を目標にして学習します。  

- 外部CSSファイルを読み込み、HTMLにスタイルを適用できること  
- Flexboxを使ってレイアウトを整え、スマホ・PC両対応（レスポンシブ）にすること  
- ボックスモデル（余白）を適切に扱い、読みやすいデザインを作ること  

## 1. 準備：CSSファイルの作成と読み込み  
HTML編の `index.html` と同じ階層に、新しく `style.css` というファイルを作成してください。  
次に、`index.html` の `<head>` タグ内に以下の1行を追加して、CSSを読み込みます。  

```html
<link rel="stylesheet" href="style.css">
```

## 2. 全体設定（リセットとベース） 
まずは、ブラウザごとの余計な余白を消し、計算しやすいように「ボックスモデル」の設定を行います。  
style.css に記述していきましょう。  
```css  
/* プロのおまじない：ボックスサイズの計算を固定する */
*, *::before, *::after {
  box-sizing: border-box;
}

/* 全体のフォントと余白の初期化 */
body {
  margin: 0;
  font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f9f9f9;
}

/* 共通の画像設定（はみ出し防止） */
img {
  max-width: 100%;
  height: auto;
}
```

## 3. ヘッダーとフッターのデザイン  
背景色をつけ、文字を中央に配置して「サイトらしさ」を出します。  
```css  
header {
  background-color: #333;
  color: #fff;
  padding: 40px 20px;
  text-align: center;
}

footer {
  background-color: #333;
  color: #fff;
  text-align: center;
  padding: 20px;
  margin-top: 40px;
}
```  

## 4. メインコンテンツのレイアウト  
各セクションに白い背景をつけ、適切な余白（padding/margin）を設定します。  
```css  
main {
  max-width: 800px;  /* 画面が広くても広がりすぎないように制限 */
  margin: 0 auto;    /* 中央揃え */
  padding: 20px;
}

section {
  background-color: #fff;
  margin-bottom: 20px;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* 軽い影をつけて浮かせる */
}

h2 {
  border-left: 5px solid #007bff; /* 左側のアクセント線 */
  padding-left: 15px;
  margin-bottom: 20px;
  color: #007bff;
}
```  

## 5. Flexboxによるプロフィール配置  
画像と自己紹介文を横に並べます（PC時）。  
```css  
/* About Meセクションの中身を横並びにする */
.about-content {
  display: flex;
  flex-direction: column; /* 基本（スマホ）は縦並び */
  align-items: center;
  gap: 20px;
}

@media (min-width: 768px) {
  .about-content {
    flex-direction: row; /* 画面が広くなったら横並び */
    text-align: left;
  }
  
  .about-content img {
    width: 200px;
    border-radius: 50%; /* 画像を丸くする */
  }
}
```  
※ HTML側で、`<img>`と`<p>`を`<div class="about-content">`で囲んでください。  

## 6. お問い合わせフォームの調整  
入力欄を使いやすく整えます。  
```css  
form p {
  margin-bottom: 15px;
}

label {
  display: block; /* ラベルを独立した行にする */
  font-weight: bold;
  margin-bottom: 5px;
}

input[type="text"],
input[type="email"] {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background-color: #0056b3; /* マウスを乗せた時に色を変える */
}
```  

## 7. 最終確認  
ブラウザで`index.html`を開き、以下のポイントを確認しましょう。  
- デザイン: 白いカード状のセクションが並び、見栄えが良くなっているか？
- レスポンシブ: ブラウザの幅を狭めた時に、画像と文章が縦に並び、はみ出していないか？
- インタラクション: 送信ボタンにマウスを乗せた時に色が変化するか？

## まとめ

- `box-sizing: border-box;`や`margin: 0 auto;`は実務で必ず使う基本設定。  
- モバイルファーストで記述し、`@media`でPC用の横並び（Flexbox）を追加する。  
- 適切な余白（Padding/Margin）と影（box-shadow）を使うことで、一気にプロっぽい質感になる。  