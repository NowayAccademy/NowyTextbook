import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Sidebar from '../components/Sidebar';

// Sidebar用のデータ
const courseLessons: Record<string, { title: string; url: string }[]> = {
  html: [
    { title: '1. HTMLとは', url: '/course/html/lesson1' },
    { title: '2. DOMについて', url: '/course/html/lesson2' },
  ],
  css: [
    { title: '1. CSSとは', url: '/course/css/lesson1' },
  ],
  js: [
    { title: '1. JSとは', url: '/course/js/lesson1' },
  ],
  db: [
    { title: '1. DBとは', url: '/course/db/lesson1' },
  ],
  java: [
    { title: '1. Javaとは', url: '/course/java/lesson1' },
  ],
};

// 教材ページ用のコンポーネント
const Textbook = () => {
  const { courseId, lessonId } = useParams();
  const [content, setContent] = useState('');
  const course = courseId || 'html';
  const target = lessonId || 'lesson1';
  const currentLessons = courseLessons[course] || [];

  // courseIdから動的にフォルダを取得
  useEffect(() => {
    import(`../course/${course}/${target}.md?raw`)
      .then((module) => setContent(module.default))
      .catch(() => setContent('# 404\n教材が見つかりませんでした。'));
  }, [course, target]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar lessons={currentLessons} />
      <main className="flex-1 p-8 overflow-y-auto bg-textbook-bg text-textbook-text">
        <div className="max-w-4xl mx-auto markdown-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
};

export default Textbook;