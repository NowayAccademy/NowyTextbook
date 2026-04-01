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

// Sidebar用のデータ
const courseLessons: Record<string, { title: string; url: string }[]> = {
  html: [
    { title: "1. HTMLとは", url: "/course/html/lesson1" },
    { title: "2. DOMについて", url: "/course/html/lesson2" },
  ],
  css: [{ title: "1. CSSとは", url: "/course/css/lesson1" }],
  js: [{ title: "1. JSとは", url: "/course/js/lesson1" }],
  db: [{ title: "1. DBとは", url: "/course/db/lesson1" }],
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
  const isJavaGoalCardLesson =
    course === "java" &&
    [
      "lesson1",
      "lesson2",
      "lesson3",
      "lesson4",
      "lesson5",
      "lesson6",
      "lesson7",
      "lesson8",
      "lesson9",
      "lesson10",
      "lesson11",
    ].includes(target);
  const lessonLayoutClass = isJavaGoalCardLesson ? "lesson-java-1" : "";
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
    <div className="flex flex-1">
      <Sidebar lessons={currentLessons} />
      <main className="flex-1 overflow-y-auto bg-textbook-bg text-textbook-text px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className={`mx-auto w-full max-w-4xl md-content ${lessonLayoutClass}`}>
          {isJavaGoalCardLesson ? (
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
