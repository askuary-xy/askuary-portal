/**
 * 后台发布时生成 AI 摘要包（与 scripts/generate-ai-summary.mjs 同构）
 */

export type AiBundle = {
  summary: string;
  selfIntro: string;
  outline: string;
};

function getConfig() {
  return {
    endpoint: process.env.CHATGPT_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
    token: process.env.CHATGPT_ACCESS_TOKEN || '',
    model: process.env.CHATGPT_MODEL || 'deepseek-v4-flash',
    maxChars: Number(process.env.CHATGPT_MAX_CHARS || 7000),
  };
}

export function hasAiConfig(): boolean {
  const { endpoint, token } = getConfig();
  return Boolean(endpoint && token);
}

function normalizeOutline(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .map((x) => `- ${x.replace(/^[•\-]\s*/, '')}`)
      .join('\n');
  }
  const text = String(raw || '').trim();
  if (!text) return '';
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.、)]+\s*/, '').trim())
    .filter(Boolean)
    .map((l) => `- ${l}`)
    .join('\n');
}

function extractJsonObject(text: string): Record<string, unknown> {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('响应中无 JSON 对象');
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

const SYSTEM =
  '你是个人博客 ASKUARY 的写作助手。请阅读文章后，只输出一个 JSON 对象（不要 Markdown 代码围栏），字段：summary（90字内引言）、selfIntro（结合本文的自我介绍，80字内）、outline（字符串数组，3～6 条要点）。';

export async function generateAiBundle(title: string, content: string): Promise<AiBundle> {
  const { endpoint, token, model, maxChars } = getConfig();
  if (!endpoint || !token) throw new Error('缺少 CHATGPT_ENDPOINT / CHATGPT_ACCESS_TOKEN');

  const cleaned = String(content || '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxChars);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.65,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Title：${title}\n\nContent：${cleaned}` },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`无效响应: ${raw.slice(0, 300)}`);

  const obj = extractJsonObject(text);
  const summary = String(obj.summary || obj.aiSummary || '').trim();
  const selfIntro = String(obj.selfIntro || obj.aiSelfIntro || '').trim();
  const outline = normalizeOutline(obj.outline || obj.aiOutline || []);
  if (!summary) throw new Error('模型未返回 summary');

  return {
    summary,
    selfIntro:
      selfIntro ||
      `我是 ASKUARY 的阅读小助手。这篇「${title}」里藏着值得慢读的句子，点开正文一起逛逛吧。`,
    outline: outline || `- ${summary.slice(0, 28)}`,
  };
}
