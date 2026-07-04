"use client";

import React from "react";

/**
 * 轻量 Markdown 渲染组件，支持：
 * - # ## ### 标题
 * - **加粗** / *斜体* / ~~删除线~~
 * - `行内代码` / ```代码块```
 * - > 引用块
 * - --- 分割线
 * - - / * 无序列表、1. 有序列表
 * - | 表格（GFM 风格）
 * - 段落自动分行
 */

// ─── 行内语法解析 ────────────────────────────────────────
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|~~([^~]+)~~|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1])       parts.push(<strong key={m.index} className="font-semibold text-foreground">{m[2]}</strong>);
    else if (m[3])  parts.push(<em key={m.index} className="italic text-foreground/80">{m[4]}</em>);
    else if (m[5])  parts.push(<code key={m.index} className="font-mono text-[11px] bg-surface-2 px-1.5 py-0.5 rounded text-data-bright border border-border/40">{m[6]}</code>);
    else if (m[7])  parts.push(<del key={m.index} className="text-muted/60 line-through">{m[7]}</del>);
    else if (m[8])  parts.push(<a key={m.index} href={m[9]} target="_blank" rel="noopener noreferrer" className="text-data-bright underline underline-offset-2 hover:text-data transition-colors">{m[8]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ─── 表格解析 ────────────────────────────────────────────
function parseTable(lines: string[]): React.ReactNode | null {
  if (lines.length < 2) return null;
  const sep = lines[1];
  if (!/^\|[-| :]+\|$/.test(sep.trim())) return null;

  const headers = lines[0].split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(h => h.trim());
  const aligns = sep.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(a => {
    a = a.trim();
    if (a.startsWith(":") && a.endsWith(":")) return "center";
    if (a.endsWith(":")) return "right";
    return "left";
  });

  const rows = lines.slice(2).map(row =>
    row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim())
  );

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-semibold text-foreground text-${aligns[i] ?? "left"}`}>
                {parseInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "" : "bg-surface-2/40"}>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-3 py-1.5 text-foreground/80 border-t border-border/30 text-${aligns[ci] ?? "left"}`}>
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 代码块提取 ──────────────────────────────────────────
interface Block {
  type: "code" | "table" | "lines";
  lang?: string;
  content: string;
  lines?: string[];
}

function splitBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    // 代码块
    const fenceMatch = lines[i].match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const start = i + 1;
      let end = start;
      while (end < lines.length && !lines[end].startsWith("```")) end++;
      blocks.push({ type: "code", lang, content: lines.slice(start, end).join("\n") });
      i = end + 1;
      continue;
    }
    // 表格（连续 | 开头的行）
    if (lines[i].trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "table", content: "", lines: tableLines });
      continue;
    }
    // 普通行块（到下一个代码块或表格停止）
    const textLines: string[] = [];
    while (i < lines.length && !lines[i].match(/^```/) && !lines[i].trim().startsWith("|")) {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.length > 0) blocks.push({ type: "lines", content: "", lines: textLines });
  }
  return blocks;
}

// ─── 普通行渲染 ──────────────────────────────────────────
function renderLine(line: string, key: number): React.ReactNode {
  const h3 = line.match(/^###\s+(.+)/);
  if (h3) return <h3 key={key} className="text-sm font-bold text-foreground mt-4 mb-1.5 flex items-center gap-1.5"><span className="w-0.5 h-4 rounded-full bg-data inline-block" />{parseInline(h3[1])}</h3>;
  const h2 = line.match(/^##\s+(.+)/);
  if (h2) return <h2 key={key} className="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-2"><span className="w-0.5 h-5 rounded-full bg-pitch-bright inline-block" />{parseInline(h2[1])}</h2>;
  const h1 = line.match(/^#\s+(.+)/);
  if (h1) return <h1 key={key} className="text-lg font-black text-foreground mt-5 mb-2">{parseInline(h1[1])}</h1>;

  if (/^---+$/.test(line.trim())) return <hr key={key} className="border-border/60 my-4" />;

  // 引用块
  const bq = line.match(/^>\s?(.*)/);
  if (bq) return (
    <div key={key} className="flex gap-2.5 my-1">
      <div className="w-0.5 rounded-full bg-pitch-bright/50 shrink-0" />
      <p className="text-muted/90 italic leading-relaxed">{parseInline(bq[1])}</p>
    </div>
  );

  // 无序列表
  const ul = line.match(/^[-*+]\s+(.+)/);
  if (ul) return (
    <div key={key} className="flex items-start gap-2 my-0.5 pl-1">
      <span className="text-pitch-bright shrink-0 mt-1.5 text-[8px]">◆</span>
      <span className="leading-relaxed">{parseInline(ul[1])}</span>
    </div>
  );

  // 有序列表
  const ol = line.match(/^(\d+)\.\s+(.+)/);
  if (ol) return (
    <div key={key} className="flex items-start gap-2 my-0.5 pl-1">
      <span className="text-data shrink-0 font-mono text-[11px] mt-0.5 min-w-[18px] text-right">{ol[1]}.</span>
      <span className="leading-relaxed">{parseInline(ol[2])}</span>
    </div>
  );

  if (!line.trim()) return <div key={key} className="h-2" />;

  return <p key={key} className="my-0.5 leading-7">{parseInline(line)}</p>;
}

// ─── 主组件 ─────────────────────────────────────────────
export default function MiniMarkdown({
  content,
  className = "",
  compact = false,
}: {
  content: string;
  className?: string;
  /** compact 模式下字体更小，适合悬浮球等空间紧凑场景 */
  compact?: boolean;
}) {
  const lines = content.split("\n");
  const blocks = splitBlocks(lines);

  return (
    <div className={`${compact ? "text-xs" : "text-sm"} leading-7 ${className}`}>
      {blocks.map((block, bi) => {
        if (block.type === "code") {
          return (
            <div key={bi} className="my-3 rounded-xl border border-border/60 bg-zinc-900/80 overflow-hidden">
              {block.lang && (
                <div className="px-3 py-1 border-b border-border/40 bg-surface-2/60 text-[10px] text-muted font-mono">
                  {block.lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-[12px] font-mono text-foreground/90 leading-relaxed">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }
        if (block.type === "table" && block.lines) {
          return <div key={bi}>{parseTable(block.lines)}</div>;
        }
        // 普通行块
        return (
          <div key={bi}>
            {(block.lines ?? []).map((line, li) => renderLine(line, li))}
          </div>
        );
      })}
    </div>
  );
}
