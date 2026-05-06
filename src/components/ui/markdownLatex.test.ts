import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownLatexViewer } from "./MarkdownLatexViewer";

describe("MarkdownLatexViewer", () => {
  it("renders inline math with KaTeX markup", () => {
    const html = renderToStaticMarkup(createElement(MarkdownLatexViewer, { value: "ลำดับ $x_{n+1}=f(x_n)$" }));

    expect(html).toContain("katex");
    expect(html).toContain("x");
  });

  it("renders display math with KaTeX markup", () => {
    const html = renderToStaticMarkup(createElement(MarkdownLatexViewer, { value: "\n$$\n\\lim_{n\\to\\infty}x_n=L\n$$\n" }));

    expect(html).toContain("katex-display");
    expect(html).toContain("lim");
  });

  it("does not render raw script as active HTML", () => {
    const html = renderToStaticMarkup(createElement(MarkdownLatexViewer, { value: '<script>alert("xss")</script>' }));

    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
  });
});

describe("Markdown + LaTeX workflow wiring", () => {
  it("uses MarkdownLatexEditor for student proposal abstract", () => {
    const source = readFileSync(join(process.cwd(), "src/app/student/proposal/page.tsx"), "utf8");

    expect(source).toContain('MarkdownLatexEditor name="abstract_of_talk"');
    expect(source).toContain('MarkdownLatexEditor name="proposed_methods"');
  });

  it("supports teacher proposal comment preview", () => {
    const source = readFileSync(join(process.cwd(), "src/app/teacher/scoring/[assignmentId]/page.tsx"), "utf8");

    expect(source).toContain('MarkdownLatexEditor name="overall_comment"');
    expect(source).toContain('MarkdownLatexEditor name="reason"');
  });

  it("renders student feedback comments while keeping scores out of the page", () => {
    const source = readFileSync(join(process.cwd(), "src/app/student/feedback/page.tsx"), "utf8");

    expect(source).toContain("MarkdownLatexViewer");
    expect(source).not.toContain("totalScore");
  });
});
