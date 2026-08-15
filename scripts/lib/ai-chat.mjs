/**
 * ChatGPT 兼容接口（DeepSeek / OpenAI 等）
 */

export function loadEnvFile(filePath, fs) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function getChatApiConfig() {
  return {
    endpoint: process.env.CHATGPT_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions',
    token: process.env.CHATGPT_ACCESS_TOKEN || '',
    model: process.env.CHATGPT_MODEL || 'deepseek-v4-flash',
    maxChars: Number(process.env.CHATGPT_MAX_CHARS || 7000),
  };
}

export function hasChatApiConfig() {
  const { endpoint, token } = getChatApiConfig();
  return Boolean(endpoint && token);
}

/**
 * @param {{ system: string, user: string, temperature?: number }} opts
 * @returns {Promise<string>}
 */
export async function chatCompletion(opts) {
  const { endpoint, token, model } = getChatApiConfig();
  if (!endpoint || !token) {
    throw new Error('缺少 CHATGPT_ENDPOINT / CHATGPT_ACCESS_TOKEN');
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw);
  const text = json?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error(`无效响应: ${raw.slice(0, 300)}`);
  return text;
}

/** 从模型输出里抠 JSON 对象 */
export function extractJsonObject(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('响应中无 JSON 对象');
  return JSON.parse(candidate.slice(start, end + 1));
}
