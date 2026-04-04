import Card from '../components/Card';

// Card.tsx用のデータ（1コース＝主に1トピック。React は TypeScript 込みの教材）
const courses = [
  {
    id: 'intro',
    title: '初回レッスン',
    url: '/course/intro',
    description: 'あいさつ・ゴール共有、環境構築のフォローなど、初日の土台を整えます。',
    icon: '/src/assets/courseIcon/htmlIcon.png',
    iconColor: '94A3B8',
  },
  {
    id: 'html',
    title: 'HTML',
    url: '/course/html',
    description: 'Webの仕組みの理解と、セマンティックなマークアップ・ハンズオンまで。',
    icon: '/src/assets/courseIcon/htmlIcon.png',
    iconColor: 'FF914d',
  },
  {
    id: 'css',
    title: 'CSS',
    url: '/course/css',
    description: 'セレクタ、Box Model、Flexbox とハンズオンでレイアウトの基礎を習得します。',
    icon: '/src/assets/courseIcon/cssIcon.png',
    iconColor: '0CC0DF',
  },
  {
    id: 'js',
    title: 'JavaScript',
    url: '/course/js',
    description: 'DOM操作、構文、イベント、非同期・HTTP、デバッグ、ハンズオンまで。',
    icon: '/src/assets/courseIcon/javascriptIcon.png',
    iconColor: 'FFDE59',
  },
  {
    id: 'design',
    title: '設計',
    url: '/course/design',
    description: '基本設計・画面遷移図・Figma / draw.io など、実装前の設計の考え方。',
    icon: '/src/assets/courseIcon/dbIcon.png',
    iconColor: 'A855F7',
  },
  {
    id: 'git',
    title: 'Git',
    url: '/course/git',
    description: 'バージョン管理の基本からブランチ・PR・revert までを扱います。',
    icon: '/src/assets/courseIcon/javascriptIcon.png',
    iconColor: 'F05032',
  },
  {
    id: 'react',
    title: 'TypeScript / React',
    url: '/course/react',
    description: '型・コンポーネント・Props・State からハンズオン・ポートフォリオ相談まで。',
    icon: '/src/assets/courseIcon/javascriptIcon.png',
    iconColor: '61DAFB',
  },
  {
    id: 'db',
    title: 'DB',
    url: '/course/db',
    description: 'PostgreSQL環境からSQL・設計・インデックス・EXPLAIN、運用と権限、総合演習まで。',
    icon: '/src/assets/courseIcon/dbIcon.png',
    iconColor: '8C52FF',
  },
  {
    id: 'java',
    title: 'java',
    url: '/course/java',
    description: 'バックエンド開発の主流であるオブジェクト指向言語Javaの基本を習得します。',
    icon: '/src/assets/courseIcon/javaIcon.png',
    iconColor: '7A2F00',
  },
];

const Home = () => {
  return (
    <main className="min-h-screen bg-main text-text p-8">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-text mb-8 border-l-4 border-accent pl-4">
          コースを選択
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} item={course} />
          ))}
        </div>
      </div>
    </main>
  );
};

export default Home;
