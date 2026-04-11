# 実践ハンズオン：自己紹介ページを作ろう  
1章から7章にかけて、Webページを作るための「部品（タグ）」と「構造のルール」を学んできました。  
本章では、それらの知識を総動員して、あなた自身の「自己紹介ページ（ポートフォリオの原型）」をゼロからコーディングしてみましょう。  

## 本章の目標  

本章では以下を目標にして学習します。  

- これまで学んだHTMLタグを組み合わせ、意味のあるWebページを構築できること  
- セマンティックタグを用いて、適切な文書構造を作れること  
- エラー（画像が表示されないなど）に気づき、自分でパスやタグを修正できること  

## 1. 準備：ファイルの作成  
まずは土台となるファイルを用意します。    
お使いのエディタ（VSCodeなど）を開き、新しく `index.html` という名前でファイルを作成してください。  
また、同じ階層に `images` というフォルダを作り、あなた自身の写真や好きなアイコン画像を `profile.jpg` という名前で保存しておきましょう。  

```text
📁 あなたの作業フォルダ
 ├── 📄 index.html  （今からコードを書くファイル）
 └── 📁 images
      └── 🖼️ profile.jpg （プロフィール用の画像）
```

## 2. 骨組みとヘッダー・フッターの作成  
最初に、HTMLの必須構造と、セマンティックタグ（意味を持つタグ）を使ってページの全体像を作ります。  
タイトルなどは自分の名前に書き換えてみましょう。  
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>山田太郎の自己紹介</title>
</head>
<body>

  <header>
    <h1>My Profile</h1>
    <p>駆け出しエンジニアの自己紹介ページです</p>
  </header>

  <main>
    
  </main>

  <footer>
    <p>&copy; 2026 Yamada Taro</p>
  </footer>

</body>
</html>
```  
一度ブラウザで開いてみてください。まだ質素ですが、これがすべてのWebページの土台（DOMツリーの根幹）になります。  

## 3. メインコンテンツの作成（画像・表・リスト）  
先ほど書いた`<main>`と`</main>`の間に、自己紹介のコンテンツを追加していきます。  
情報の意味ごとに`<section>`で区切っていくのがポイントです。  

```html
<main>
    <section>
      <h2>About Me</h2>
      <img src="./images/profile.jpg" alt="私のプロフィール画像">
      <p>初めまして！プログラミングスクールNOWAYでフロントエンドの学習をしています。<br>使いやすいWebサービスを作れるエンジニアを目指しています。</p>
    </section>
    <section>
      <h2>Profile</h2>
      <table>
        <tr>
          <th>名前</th>
          <td>山田 太郎</td>
        </tr>
        <tr>
          <th>職業</th>
          <td>エンジニア志望</td>
        </tr>
        <tr>
          <th>目標</th>
          <td>自社開発企業への転職</td>
        </tr>
      </table>
    </section>
    <section>
      <h2>Skills & Hobbies</h2>
      <ul>
        <li>HTML / CSS（学習中）</li>
        <li>カフェ巡り</li>
        <li>映画鑑賞</li>
      </ul>
    </section>
  </main>
```  

## 4. お問い合わせフォームの作成（フォームとラベル）  
最後に、あなたに連絡を取るためのお問い合わせフォームを追加します。  
`<main>`タグの中の、一番下に追加してみましょう。ユーザーが使いやすいように、しっかり`<label>`を使って紐付けを行います。  
```html
<section>
  <h2>Contact</h2>
  <form>
    <p>
      <label for="visitor-name">お名前：</label>
      <input type="text" id="visitor-name" placeholder="例：鈴木 一郎">
    </p>
    <p>
      <label for="visitor-email">メールアドレス：</label>
      <input type="email" id="visitor-email" placeholder="例：info@example.com">
    </p>
    <p>お問い合わせの種類：</p>
    <p>
      <input type="radio" name="inquiry-type" id="job" value="job">
      <label for="job">お仕事のご相談</label>
      <input type="radio" name="inquiry-type" id="other" value="other">
      <label for="other">その他</label>
    </p>
    <button type="submit">送信する</button>
  </form>
</section>
```  
Webブラウザで確認してみましょう。  
ブラウザで画面を更新（リロード）してください。  
文字（「お仕事のご相談」など）をクリックして、ラジオボタンが選択状態になれば、`<label>`と`<input>`の紐付けは完璧です！

## 5. 完成
これで、HTMLだけで構成された立派な自己紹介ページが完成しました。  
CSS（デザイン）を当てていないため白黒のシンプルな画面ですが、裏側の「DOMツリー」は非常に美しく、コンピュータにとって意味が分かりやすいセマンティックな構造になっています。  

## まとめ
- 複数のタグを組み合わせることで、情報が整理されたWebページを作ることができる。  
- `<header>`や`<main>`、`<section>`を使うことで、どこに何が書かれているか明確になる。  
- この美しいHTMLの骨組みに対して、CSSを使って自由自在にデザインを当てていくのが次のステップ。   