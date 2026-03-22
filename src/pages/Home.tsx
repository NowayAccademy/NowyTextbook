import React from 'react';
import Card from '../components/Card';

// Card.tsx用のデータ
const courses = [
  { 
    id: 'html',
    title: 'HTML',
    url:'/course/html',
    description: 'Webページの骨組みを作るHTMLの基本を学びます。',
    icon: '/src/assets/courseIcon/htmlIcon.png',
    iconColor: 'FF914d'
  },
  { 
    id: 'css',
    title: 'CSS',
    url:'/course/css',
    description: 'Webページを美しく装飾するためのCSSを習得します。',
    icon: '/src/assets/courseIcon/cssIcon.png',
    iconColor: '0CC0DF'
  },
  { 
    id: 'js',
    title: 'JavaScript',
    url:'/course/js',
    description: '動きのあるインタラクティブなWebサイトを作成します。',
    icon: '/src/assets/courseIcon/javascriptIcon.png',
    iconColor: 'FFDE59'
  },
  { 
    id: 'db',
    title: 'DB',
    url:'/course/db',
    description: 'データベースの基礎知識とSQLを用いたデータ操作を学びます。',
    icon: '/src/assets/courseIcon/dbIcon.png',
    iconColor: '8C52FF'
  },
  { 
    id: 'java',
    title: 'java',
    url:'/course/java',
    description: 'バックエンド開発の主流であるオブジェクト指向言語Javaの基本を習得します。',
    icon: '/src/assets/courseIcon/javaIcon.png',
    iconColor: '7A2F00'
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