"use client";

import React from "react";

/**
 * 轻量 Markdown 渲染组件，支持：
 * - **加粗** / *斜体*
 * - # ## ### 标题
 * - --- 分割线
 * - `代码`
 * - 无序列表 - item
 * - 有序列表 1. item
 * - 段落自动分行
 */

function parseLine(line: string, key: number): React.ReactNode {
  // 标题
  const h3 = line.match(/^###\s+(.+)/);
  if (h3) return <h3 key={key} className="text-sm font-bold text-foreground mt-3 mb-1">{parseInline(h3[1])}</h3>;
  const h2 = line.match(/^##\s+(.+)/);
  if (h2) return <h2 key={key} className="text-base font-bold text-foreground mt-4 mb-1">{parseInline(h2[1])}</h2>;
  const h1 = line.match(/^#\s+(.+)/);
  if (h1) return <h1 key={key} className="text-lg font-black text-foreground mt-4 mb-2">{parseInline(h1[1])}</h1>;

  // 分割线
  if (/^---+$/.test(line.trim())) return <hr key={key} className="border-border my-3" />;

  // 无序列表
  const ul = line.match(/^[-*]\s+(.+)/);
  if (ul) return (
    <div key={key} className="flex items-start gap-2 my-0.5">
      <span className="text-pitch-bright mt-0.5 shrink-0">·</span>
      <span>{parseInline(ul[1])}</span>
    </div>
  );

  // 有序列表
  const ol = line.match(/^(\d+)\.\s+(.+)/);
  if (ol) return (
    <div key={key} className="flex items-start gap-2 my-0.5">
      <span className="text-data shrink-0 font-mono text-xs mt-0.5 w-4 text-right">{ol[1]}.</span>
      <span>{parseInline(ol[2])}</span>
    </div>
  );

  // 空行
  if (!line.trim()) return <div key={key} className="h-2" />;

  // 普通段落
  return <p key={key} className="my-0.5 leading-7">{parseInline(line)}</p>;
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // 正则：**加粗** | *斜体* | `代码`
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} className="font-bold text-foreground">{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={m.index} className="italic text-muted">{m[4]}</em>);
    else if (m[5]) parts.push(<code key={m.index} className="font-mono text-[11px] bg-surface-2 px-1 py-0.5 rounded text-data-bright">{m[6]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function MiniMarkdown({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.split("\n");
  return (
    <div className={`text-sm leading-7 ${className}`}>
      {lines.map((line, i) => parseLine(line, i))}
    </div>
  );
}
