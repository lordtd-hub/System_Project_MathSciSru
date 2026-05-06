"use client";

import clsx from "clsx";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";

type MarkdownLatexViewerProps = {
  value?: string | null;
  emptyText?: string;
  className?: string;
};

export function MarkdownLatexViewer({
  value,
  emptyText = "ยังไม่มีข้อความ",
  className
}: MarkdownLatexViewerProps) {
  return (
    <div className={clsx("markdown-latex-viewer", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
      >
        {value?.trim() ? value : emptyText}
      </ReactMarkdown>
    </div>
  );
}
