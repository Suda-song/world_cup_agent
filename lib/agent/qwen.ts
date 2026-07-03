interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface QwenResult {
  source: "qwen" | "local";
  model?: string;
  content: string;
  error?: string;
}

export async function chatWithQwen(
  messages: ChatMessage[],
  fallback: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<QwenResult> {
  const key = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!key) return { source: "local", content: fallback };

  const baseUrl =
    process.env.QWEN_BASE_URL || "https://coding.dashscope.aliyuncs.com/v1";
  const model = process.env.QWEN_MODEL || "qwen3.7-plus";
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  try {
    const payload = {
      model,
      messages,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.maxTokens ?? 900,
    };

    console.log("[Qwen][request]", JSON.stringify({ url, ...payload }, null, 2));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log("[Qwen][error]", JSON.stringify({ status: res.status, body: body.slice(0, 1000) }, null, 2));
      throw new Error(`Qwen API error ${res.status}: ${body.slice(0, 240)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Qwen returned empty content");
    console.log("[Qwen][response]", JSON.stringify({ model, content }, null, 2));
    return { source: "qwen", model, content };
  } catch (err) {
    console.log(
      "[Qwen][fallback]",
      JSON.stringify({ error: err instanceof Error ? err.message : "qwen-error" }, null, 2),
    );
    return {
      source: "local",
      content: fallback,
      error: err instanceof Error ? err.message : "qwen-error",
    };
  }
}
