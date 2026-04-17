# レイアウト手法1（Flexbox）
これまでの章で、要素（箱）のサイズや余白を調整できるようになりました。  
しかし、Webページを作るには「ロゴの右側にメニューを横並びにする」「ボタンを画面のど真ん中に配置する」といったレイアウト操作が必要です。  
本章では、現代のWeb開発で必須となるレイアウト機能「Flexbox」を学習します。  

## 本章の目標  

本章では以下を目標にして学習します。  

- Flexboxの「親要素（コンテナ）」と「子要素（アイテム）」の関係を理解すること  
- `display: flex;` を用いて要素を横並びにできること  
- `justify-content` と `align-items` を使い分け、思い通りの位置に配置できること  

## 1. Flexboxの基本ルール（親と子の関係）  
Flexboxを使う上で、初心者が最も陥りやすい罠があります。  
それは「横に並べたい要素（子）に直接CSSを書いてしまうこと」です。  
Flexboxの絶対ルールは**並べたい要素たちを囲んでいる『親要素』に対して `display: flex;` を指定する**ことです。  
親を指定することで、その中にある子要素たちが自動的に「Flexアイテム」という整列可能なブロックに変化します。  

```html
<div class="container">
  <div class="item">箱1</div>
  <div class="item">箱2</div>
  <div class="item">箱3</div>
</div>
```
```css
/* CSSの記述 */
.container {
  display: flex; /* これを書くだけで、中の要素が横並びになります */
}
```

## 2. 並ぶ方向を決める（flex-direction）  
`display: flex;`を指定すると、デフォルトでは左から右へ「横並び」になります。  
これを縦並びに変えたり、逆順にしたりするのが`flex-direction`です。  
```css
.container {
  display: flex;
  
  /* デフォルト値。左から右へ並ぶ */
  flex-direction: row; 
  
  /* 上から下へ縦並びにする（スマホ対応の時によく使います） */
  flex-direction: column; 
}
```

## 3. 水平方向の配置を決める（justify-content）  
要素の並ぶ軸（横並びなら水平方向）に対して、どのように隙間を空けたり、寄せたりするかを指定します。  
実務で最も活躍するプロパティです。  
```css  
.container {
  display: flex;
  
  /* 中央にギュッと集める */
  justify-content: center;
  
  /* 両端にピタッとくっつけて、残りの要素を等間隔に配置する（ヘッダーで頻出！） */
  justify-content: space-between;
  
  /* 右端（終点）に寄せる */
  justify-content: flex-end;
}
```  
### ヘッダーの作り方  
Webサイトのヘッダーで「左にロゴ」「右にメニュー」という配置をよく見かけますが、これは親要素に`display: flex;`と`justify-content: space-between;`を指定するだけで簡単に作成することができます。  

## 4. 垂直方向の配置を決める（align-items）  
要素の並ぶ軸と交差する方向（横並びなら垂直方向）に対して、要素をどう配置するかを指定します。  
```css  
.container {
  display: flex;
  
  /* 高さいっぱいに引き伸ばす（デフォルト値） */
  align-items: stretch;
  
  /* 縦方向の中心（ど真ん中）に揃える。アイコンと文字のズレを直す時に必須！ */
  align-items: center;
}
```  

## 5. 要素を折り返す（flex-wrap） 
親要素の幅よりも子要素の合計幅が大きくなった場合、デフォルトでは子要素が「絶対に1行に収まろうとしてギュッと縮む」という性質があります。  
はみ出した分を下の行に折り返したい場合は、`flex-wrap`を使用します。  
```css  
.container {
  display: flex;
  
  /* はみ出した子要素を、下の行に折り返して配置する（画像ギャラリーなどで必須） */
  flex-wrap: wrap; 
}
```  

## まとめ

- Flexboxは、並べたい要素の**親要素**に対して`display: flex;`を指定する。  
- `flex-direction`で横並び（row）か縦並び（column）かを決める。  
- `justify-content`で水平方向（並ぶ方向）の配置を調整する（center や space-between が頻出）。  
- `align-items`で垂直方向の配置を調整する（center で縦のど真ん中に揃える）。  
- はみ出した要素を折り返すには`flex-wrap: wrap;`を使う。