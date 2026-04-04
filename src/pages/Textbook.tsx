import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import Sidebar from "../components/Sidebar";

const courseImageModules = import.meta.glob("../course/**/images/*", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const splitMarkdownByH2 = (markdown: string) => {
  const lines = markdown.split("\n");
  const introLines: string[] = [];
  const sections: string[] = [];
  let currentSection: string[] = [];
  let inSection = false;

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      if (currentSection.length > 0) {
        sections.push(currentSection.join("\n").trim());
      }
      currentSection = [line];
      inSection = true;
      return;
    }

    if (inSection) {
      currentSection.push(line);
    } else {
      introLines.push(line);
    }
  });

  if (currentSection.length > 0) {
    sections.push(currentSection.join("\n").trim());
  }

  return {
    intro: introLines.join("\n").trim(),
    sections,
  };
};

// 本章の目標カード＋分割レイアウト（Java lesson と同じ見た目）を使うコース
const COURSES_WITH_GOAL_CARD_LAYOUT = [
  "java",
  "intro",
  "html",
  "css",
  "js",
  "design",
  "react",
  "git",
  "db",
] as const;

// Sidebar用のデータ
const courseLessons: Record<string, { title: string; url: string }[]> = {
  intro: [
    { title: "1. 初回レッスン（導入）", url: "/course/intro/lesson1" },
    { title: "2. 環境構築のフォロー", url: "/course/intro/lesson2" },
  ],
  html: [
    { title: "1. Webの仕組みとフロントエンド", url: "/course/html/lesson1" },
    { title: "2. HTMLの基本構造と必須タグ", url: "/course/html/lesson2" },
    { title: "3. DOMとセマンティックタグ", url: "/course/html/lesson3" },
    { title: "4. よく使うタグ", url: "/course/html/lesson4" },
    { title: "5. HTMLハンズオン", url: "/course/html/lesson5" },
  ],
  js: [
    { title: "1. JavaScriptの役割とDOM", url: "/course/js/lesson1" },
    { title: "2. JavaScriptの基本構文", url: "/course/js/lesson2" },
    { title: "3. イベント処理", url: "/course/js/lesson3" },
    { title: "4. 同期と非同期・HTTP", url: "/course/js/lesson4" },
    { title: "5. よく使うUIパターン", url: "/course/js/lesson5" },
    { title: "6. デバッグ", url: "/course/js/lesson6" },
    { title: "7. JavaScriptハンズオン", url: "/course/js/lesson7" },
  ],
  design: [
    { title: "1. 基本設計（画面レイアウト）", url: "/course/design/lesson1" },
    { title: "2. 画面遷移図", url: "/course/design/lesson2" },
    { title: "3. 設計ツール（Figma等）", url: "/course/design/lesson3" },
  ],
  css: [
    { title: "1. CSSの適用とセレクタ", url: "/course/css/lesson1" },
    { title: "2. Box Modelと余白", url: "/course/css/lesson2" },
    { title: "3. Flexbox", url: "/course/css/lesson3" },
    { title: "4. CSSハンズオン", url: "/course/css/lesson4" },
  ],
  git: [
    { title: "1. Gitとは", url: "/course/git/lesson1" },
    { title: "2. 基本操作と概念", url: "/course/git/lesson2" },
    { title: "3. リモートと共有", url: "/course/git/lesson3" },
    { title: "4. ブランチとマージ", url: "/course/git/lesson4" },
    { title: "5. PRとタグ", url: "/course/git/lesson5" },
    { title: "6. 履歴の修正と取り消し", url: "/course/git/lesson6" },
    { title: "7. ハンズオン（PRとrevert）", url: "/course/git/lesson7" },
  ],
  react: [
    { title: "1. TSとReactの必要性", url: "/course/react/lesson1" },
    { title: "2. 型について", url: "/course/react/lesson2" },
    { title: "3. TS：型定義の基本", url: "/course/react/lesson3" },
    { title: "4. TS：関数とinterface", url: "/course/react/lesson4" },
    { title: "5. コンポーネント思考", url: "/course/react/lesson5" },
    { title: "6. JSXとレンダリング", url: "/course/react/lesson6" },
    { title: "7. Props", url: "/course/react/lesson7" },
    { title: "8. TSXでPropsの型", url: "/course/react/lesson8" },
    { title: "9. Stateの概念", url: "/course/react/lesson9" },
    { title: "10. useState", url: "/course/react/lesson10" },
    { title: "11. TSとReactの統合", url: "/course/react/lesson11" },
    { title: "12. 条件付きレンダリング", url: "/course/react/lesson12" },
    { title: "13. Reactハンズオン", url: "/course/react/lesson13" },
    { title: "14. ポートフォリオ・QA", url: "/course/react/lesson14" },
  ],
  db: [
    { title: "1. オリエンテーション（学習計画）", url: "/course/db/lesson1" },
    { title: "2. 環境構築（A5:SQL Mk-2・PostgreSQL）", url: "/course/db/lesson2" },
    { title: "3. RDBMSの概念", url: "/course/db/lesson3" },
    { title: "4. トランザクションとACID", url: "/course/db/lesson4" },
    { title: "5. SELECT/WHERE/ORDER/LIMIT・ページング", url: "/course/db/lesson5" },
    { title: "6. NULLの扱い", url: "/course/db/lesson6" },
    { title: "7. 条件検索（LIKE/IN/EXISTS/BETWEEN）", url: "/course/db/lesson7" },
    { title: "8. 日付・時刻と型変換", url: "/course/db/lesson8" },
    { title: "9. GROUP BY・HAVING", url: "/course/db/lesson9" },
    { title: "10. INNER JOIN・LEFT JOIN", url: "/course/db/lesson10" },
    { title: "11. ER図の基本記法", url: "/course/db/lesson11" },
    { title: "12. 正規化と多対多", url: "/course/db/lesson12" },
    { title: "13. 履歴・論理削除・物理削除", url: "/course/db/lesson13" },
    { title: "14. テーブル定義書", url: "/course/db/lesson14" },
    { title: "15. インデックス設計", url: "/course/db/lesson15" },
    { title: "16. INSERT/UPDATE/DELETEと安全運用", url: "/course/db/lesson16" },
    { title: "17. EXPLAINとチューニング", url: "/course/db/lesson17" },
    { title: "18. 運用（ANALYZE/VACUUM・移行・バックアップ）", url: "/course/db/lesson18" },
    { title: "19. セキュリティと権限", url: "/course/db/lesson19" },
    { title: "20. 総合演習", url: "/course/db/lesson20" },
  ],
  java: [
    { title: "1. Java言語とは", url: "/course/java/lesson1" },
    { title: "2. 変数とは", url: "/course/java/lesson2" },
    { title: "3. 式と演算子", url: "/course/java/lesson3" },
    { title: "4. 条件分岐と繰り返し", url: "/course/java/lesson4" },
    { title: "5. 配列", url: "/course/java/lesson5" },
    { title: "6. メソッド", url: "/course/java/lesson6" },
    { title: "7. クラス", url: "/course/java/lesson7" },
    { title: "8. オブジェクト指向", url: "/course/java/lesson8" },
    { title: "9. 継承", url: "/course/java/lesson9" },
    { title: "10. 多態性", url: "/course/java/lesson10" },
    { title: "11. カプセル化", url: "/course/java/lesson11" },
  ],
};

// 教材ページ用のコンポーネント
const Textbook = () => {
  const { courseId, lessonId } = useParams();
  const [content, setContent] = useState("");
  const course = courseId || "html";
  const target = lessonId || "lesson1";
  const isGoalCardLessonLayout = (
    COURSES_WITH_GOAL_CARD_LAYOUT as readonly string[]
  ).includes(course);
  const lessonLayoutClass = isGoalCardLessonLayout ? "lesson-java-1" : "";
  const currentLessons = courseLessons[course] || [];
  const { intro, sections } = splitMarkdownByH2(content);
  const resolveCourseImage = (src?: string) => {
    if (!src) return src;
    if (!src.startsWith("./images/")) return src;
    const fileName = decodeURIComponent(src.replace("./images/", ""));
    const imageKey = `../course/${course}/images/${fileName}`;
    return courseImageModules[imageKey] ?? src;
  };

  // courseIdから動的にフォルダを取得
  useEffect(() => {
    import(`../course/${course}/${target}.md?raw`)
      .then((module) => setContent(module.default))
      .catch(() => setContent("# 404\n教材が見つかりませんでした。"));
  }, [course, target]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <Sidebar lessons={currentLessons} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-textbook-bg text-textbook-text px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className={`mx-auto w-full max-w-4xl md-content ${lessonLayoutClass}`}>
          {isGoalCardLessonLayout ? (
            <>
              {intro && (
                <div className="lesson-intro mb-6 sm:mb-8">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {intro}
                  </ReactMarkdown>
                </div>
              )}
              {sections.map((section, index) => (
                <section
                  key={index}
                  className={`lesson-section mb-5 sm:mb-6 ${
                    index === 0 ? "lesson-goals" : ""
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      table: ({ children }) => (
                        <div className="my-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="min-w-[720px]">{children}</table>
                        </div>
                      ),
                      img: ({ src, alt }) => (
                        <img
                          src={resolveCourseImage(src)}
                          alt={alt || ""}
                          className="my-4 w-full rounded-lg border border-slate-200"
                        />
                      ),
                    }}
                  >
                    {section}
                  </ReactMarkdown>
                </section>
              ))}
            </>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({ children }) => (
                  <div className="my-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-[720px]">{children}</table>
                  </div>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={resolveCourseImage(src)}
                    alt={alt || ""}
                    className="my-4 w-full rounded-lg border border-slate-200"
                  />
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
      </main>
    </div>
  );
};

export default Textbook;
