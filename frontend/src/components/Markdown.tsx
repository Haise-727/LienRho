"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import React from "react";

// Standard markdown renderer for chat (react-markdown + remark-gfm, the same
// stack most chat UIs use). Tailwind utility classes stand in for a typography
// plugin so we don't pull one in. Renders into an already-styled bubble.

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose-chat text-xs leading-relaxed ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc pl-4 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal pl-4 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="text-sm font-semibold mt-1 mb-0.5">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mt-1 mb-0.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold mt-1 mb-0.5">{children}</h3>,
          code: ({ className: c, children }) => {
            const inline = !String(c ?? "").includes("language-");
            return inline ? (
              <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px]">
                {children}
              </code>
            ) : (
              <code className="block bg-slate-900 text-slate-100 rounded-md p-2 my-1 overflow-x-auto font-mono text-[11px]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-1">{children}</pre>,
          a: ({ href, children }) => (
            <a href={href} className="text-emerald-700 underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-1 overflow-x-auto">
              <table className="border-collapse text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-slate-300 px-2 py-1">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-2 text-slate-500 my-1">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
