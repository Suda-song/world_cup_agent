import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 舆情分析：把一段观点文字分类为 倾向/类别 + 摘要。
// 全链路优先用 Qwen；无 key 时本地关键词启发式兜底（保证"能通"）。

type Stance = "positive" | "neutral" | "negative";
type Category = "tactics" | "form" | "history" | "opinion";

const POS = ["强", "稳", "火热", "回归", "利好", "夺冠", "碾压", "统治", "状态好", "势头", "崛起", "无敌", "领先", "看好"];
const NEG = ["伤", "停赛", "下滑", "低迷", "崩", "内讧", "不稳", "缺阵", "疲惫", "退役", "危机", "爆冷", "出局", "不看好", "弱"];
const CAT_KW: Record<Category, string[]> = {
  tactics: ["战术", "阵型", "打法", "控球", "反击", "压迫", "防守", "进攻", "克制", "教练"],
  form: ["状态", "心情", "伤", "停赛", "疲劳", "士气", "信心", "健康", "缺阵"],
  history: ["历史", "交锋", "过往", "宿命", "经验", "大赛", "往绩"],
  opinion: ["球迷", "媒体", "舆论", "热议", "看好", "预测", "数据", "民调"],
};

function localAnalyze(text: string): { stance: Stance; category: Category; summary: string } {
  const t = text || "";
  let pos = 0, neg = 0;
  for (const w of POS) if (t.includes(w)) pos++;
  for (const w of NEG) if (t.includes(w)) neg++;
  const stance: Stance = pos > neg ? "positive" : neg > pos ? "negative" : "neutral";

  let category: Category = "opinion";
  let best = 0;
  for (const c of Object.keys(CAT_KW) as Category[]) {
    const hits = CAT_KW[c].filter((w) => t.includes(w)).length;
    if (hits > best) { best = hits; category = c; }
  }
  const summary = t.trim().slice(0, 60);
  return { stance, category, summary };
}

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "empty-text" }, { status: 400 });

  const qwenKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;

  if (qwenKey) {
    try {
      const prompt = `你是足球舆情分析助手。分析下面这段关于球队的观点/舆情文字，输出严格 JSON（不要多余文字）：
{"stance":"positive|neutral|negative","category":"tactics|form|history|opinion","summary":"20字以内中文摘要"}
stance=对该球队是利好/中性/利空；category=战术打法(tactics)/球员状态伤病(form)/历史交锋(history)/舆论数据(opinion)。
文字：${text}`;
      const qwenBase = (process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
      const res = await fetch(
        `${qwenBase}/chat/completions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${qwenKey}` },
          body: JSON.stringify({
            model: process.env.QWEN_MODEL || "qwen-plus",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            max_tokens: 200,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || "";
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          return NextResponse.json({
            source: "qwen",
            stance: parsed.stance,
            category: parsed.category,
            summary: parsed.summary,
          });
        }
      }
    } catch {
      // fall through to local
    }
  }

  return NextResponse.json({ source: "local", ...localAnalyze(text) });
}
