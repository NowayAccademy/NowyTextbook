import React from 'react';
import { Link } from 'react-router-dom';

interface CourseItem {
  id: string;
  title: string;
  url: string;
  icon: string;
  description: string;
  iconColor: string;
}

interface CardProps {
  item: CourseItem;
}

// Homeで使用しているカードのコンポーネント
const Card: React.FC<CardProps> = ({ item }) => {
  return (
    <Link to={item.url}>
      <div 
        className="flex flex-col bg-card border border-accent rounded-xl p-6 cursor-pointer hover:bg-accent/10 transition-colors duration-200 shadow-[0_0_10px_rgba(0,255,255,0.05)] hover:shadow-[0_0_15px_rgba(0,255,255,0.15)] mb-2"
      >
        <div className="mb-1 w-full">
          <img src={item.icon} alt={`${item.title}のアイコン`} className="w-full h-32 object-contain" />
        </div>
        <h3 className="font-bold text-center" style={{ color: `#${item.iconColor}` }}>{item.title}</h3>
      </div>
      <h2 className="text-xl font-bold text-text">{item.title}</h2>
      <p className="opacity-90 leading-relaxed text-sm">{item.description}</p>
    </Link>
  );
};

export default Card;