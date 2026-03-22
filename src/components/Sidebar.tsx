import React from 'react';
import { Link, useParams } from 'react-router-dom';

interface SidebarItem {
  title: string;
  url: string;
}

interface SidebarProps {
  lessons: SidebarItem[];
}

// 教材ページのサイドバーコンポーネント
const Sidebar: React.FC<SidebarProps> = ({lessons}) => {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-accent/30 p-6 hidden md:block bg-card">
      <h2 className="text-lg font-bold text-text mb-6 border-b border-accent/30 pb-2">
        学習メニュー
      </h2>
      <nav className="flex flex-col gap-2">
        <Link
            to="/"
            className="block px-3 py-2 rounded-md hover:bg-accent/10 hover:text-accent transition-colors duration-200 text-sm text-text opacity-90"
          >
            HOMEへ戻る
          </Link>
        {lessons.map((item, index) => (
          <Link
            key={index}
            to={item.url}
            className="block px-3 py-2 rounded-md hover:bg-accent/10 hover:text-accent transition-colors duration-200 text-sm text-text opacity-90"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
