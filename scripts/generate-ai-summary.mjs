/**
 * 为 journal 文章生成 AI 摘要包（发布时自动拉取一次）：
 * - aiSummary   吸引阅读的短引言
 * - aiSelfIntro 结合本文的「介绍自己」
 * - aiOutline   文章大纲（多行）
 *
 * 环境变量见 .env.example
 *
 * 用法：
 *   node scripts/generate-ai-summary.mjs
 *   node scripts/generate-ai-summary.mjs --force
 *   node scripts/generate-ai-summary.mjs --slug=hello-world
 *   node scripts/generate-ai-summary.mjs --check
 *   node scripts/generate-ai-summary.mjs --soft   # 无密钥时静默跳过（供 content:build 调用）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import {
  chatCompletion,
  extractJsonObject,
  getChatApiConfig,
  hasChatApiConfig,
  loadEnvFile,
} from './lib/ai-chat.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const journalDir = path.join(root, 'content', 'journal');

loadEnvFile(path.join(root, '.env'), fs);

const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');
const soft = process.argv.includes('--soft');
const slugArg = process.argv.find((a) => a.startsWith('--slug='))?.slice(7);

const BUNDLE_SYSTEM =
  process.env.CHATGPT_INIT_PROMPT ||
  [
    '你是个人博客 ASKUARY 的写作助手。请阅读文章后，只输出一个 JSON 对象（不要 Markdown 代码围栏），字段如下：',
    'summary: 以作者口吻、激发好奇、精炼简短、90字以内、与文章语言一致的引言；',
    'selfIntro: 以站点小助手口吻「介绍自己」，必须点出本文主题/情绪/关键词，让读者感到这篇专属，80字以内；',
    'outline: 字符串数组，3～6 条，概括本文结构或要点（每条不超过 28 字）。',
  ].join('');

function yamlQuote(value) {
  const s = String(value ?? '');
  if (/[:#\n"'|&*>![\]{}]/.test(s) || s.startsWith(' ') || s.endsWith(' ') || s === '') {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function yamlBlock(value) {
  const lines = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n');
  if (!lines.length || (lines.length === 1 && !lines[0])) return '""';
  return ['|', ...lines.map((l) => `  ${l}`)].join('\n');
}

function serializeFrontmatter(data) {
  const lines = ['---'];
  if (data.title != null) lines.push(`title: ${yamlQuote(data.title)}`);
  if (data.date != null) lines.push(`date: ${String(data.date).slice(0, 10)}`);
  if (data.summary) lines.push(`summary: ${yamlQuote(data.summary)}`);
  if (data.aiSummary) lines.push(`aiSummary: ${yamlQuote(data.aiSummary)}`);
  if (data.aiSelfIntro) lines.push(`aiSelfIntro: ${yamlQuote(data.aiSelfIntro)}`);
  if (data.aiOutline) lines.push(`aiOutline: ${yamlBlock(data.aiOutline)}`);
  if (data.showAiSummary === false) lines.push('showAiSummary: false');
  if (Array.isArray(data.tags) && data.tags.length) {
    lines.push('tags:');
    for (const tag of data.tags) lines.push(`  - ${yamlQuote(tag)}`);
  }
  if (data.legacyUrl) lines.push(`legacyUrl: ${yamlQuote(data.legacyUrl)}`);
  if (data.cover) lines.push(`cover: ${yamlQuote(data.cover)}`);
  lines.push('---');
  return lines.join('\n');
}

function normalizeOutline(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .map((x) => (x.startsWith('-') || x.startsWith('•') ? x.replace(/^[•\-]\s*/, '') : x))
      .map((x) => `- ${x}`)
      .join('\n');
  }
  const text = String(raw || '').trim();
  if (!text) return '';
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*•\d.、)]+\s*/, '').trim())
    .filter(Boolean);
  return lines.map((l) => `- ${l}`).join('\n');
}

function needsBundle(data) {
  const summary = String(data.aiSummary || '').trim();
  const intro = String(data.aiSelfIntro || '').trim();
  const outline = String(data.aiOutline || '').trim();
  if (force) return true;
  return !summary || !intro || !outline;
}

/**
 * @returns {Promise<{ summary: string, selfIntro: string, outline: string }>}
 */
export async function generateAiBundle(title, content) {
  const { maxChars } = getChatApiConfig();
  const cleaned = String(content || '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxChars);

  const text = await chatCompletion({
    system: BUNDLE_SYSTEM,
    user: `Title：${title}\n\nContent：${cleaned}`,
    temperature: 0.65,
  });

  const json = extractJsonObject(text);
  const summary = String(json.summary || json.aiSummary || '').trim();
  const selfIntro = String(json.selfIntro || json.aiSelfIntro || json.intro || '').trim();
  const outline = normalizeOutline(json.outline || json.aiOutline || []);

  if (!summary) throw new Error('模型未返回 summary');
  return {
    summary,
    selfIntro:
      selfIntro ||
      `我是 ASKUARY 的阅读小助手。这篇「${title}」里藏着值得慢读的句子，点开正文一起逛逛吧。`,
    outline: outline || `- ${summary.slice(0, 28)}`,
  };
}

async function checkConfig() {
  const { endpoint, token, model } = getChatApiConfig();
  console.log('[ai-summary] endpoint:', endpoint || '(未设置)');
  console.log('[ai-summary] model:', model);
  console.log('[ai-summary] token:', token ? `已设置（长度 ${token.length}）` : '(未设置)');
  if (!endpoint || !token) {
    console.error('[ai-summary] 请在 .env 填写 CHATGPT_ENDPOINT 与 CHATGPT_ACCESS_TOKEN');
    process.exit(1);
  }
  try {
    const bundle = await generateAiBundle(
      '配置自检',
      '这是一条用于检测 ChatGPT 兼容接口是否可用的短文本。请正常返回 JSON。',
    );
    console.log('[ai-summary] 自检通过:', bundle.summary);
  } catch (err) {
    console.error('[ai-summary] 自检失败:', err.message || err);
    process.exit(1);
  }
}

async function main() {
  if (checkOnly) {
    await checkConfig();
    return;
  }

  if (!hasChatApiConfig()) {
    if (soft) {
      console.log('[ai-summary] 未配置密钥，跳过自动摘要（soft）');
      return;
    }
    console.error('[ai-summary] 缺少 CHATGPT_ENDPOINT / CHATGPT_ACCESS_TOKEN');
    process.exit(1);
  }

  if (!fs.existsSync(journalDir)) {
    console.log('[ai-summary] no content/journal');
    return;
  }

  const files = fs
    .readdirSync(journalDir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !slugArg || f.replace(/\.md$/i, '') === slugArg);

  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const full = path.join(journalDir, file);
    const raw = fs.readFileSync(full, 'utf8');
    const parsed = matter(raw);
    const slug = file.replace(/\.md$/i, '');

    if (!needsBundle(parsed.data)) {
      skipped += 1;
      continue;
    }

    try {
      const title = String(parsed.data.title || slug);
      const bundle = await generateAiBundle(title, parsed.content);
      parsed.data.aiSummary = bundle.summary;
      parsed.data.aiSelfIntro = bundle.selfIntro;
      parsed.data.aiOutline = bundle.outline;
      if (!String(parsed.data.summary || '').trim()) {
        parsed.data.summary = bundle.summary;
      }
      fs.writeFileSync(
        full,
        `${serializeFrontmatter(parsed.data)}\n\n${parsed.content.trim()}\n`,
        'utf8',
      );
      console.log(`[ai-summary] generated: ${slug}`);
      updated += 1;
    } catch (err) {
      console.warn(`[ai-summary] skip ${slug}:`, err.message || err);
    }
  }

  console.log(`[ai-summary] done. updated=${updated}, skipped=${skipped}`);
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
