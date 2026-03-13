const axios     = require('axios');
const NodeCache = require('node-cache');
const { logger }     = require('./logger');
const { lookupTerm, readGlossary } = require('./glossaryService');

// Cache: TTL 1 giờ, tối đa 5000 keys
const translationCache = new NodeCache({ stdTTL: 3600, maxKeys: 5000 });

const LANG_MAP = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German'
};

// ── Ghép glossary vào system prompt ──────────────────────────────────────────
const buildGlossaryContext = (targetLang) => {
  const glossary = readGlossary();
  const relevant = glossary.entries.filter(e => e[targetLang]).slice(0, 80);
  if (relevant.length === 0) return '';
  const lines = relevant.map(e => {
    const parts = [];
    if (e.en) parts.push(`EN: "${e.en}"`);
    if (e.zh) parts.push(`ZH: "${e.zh}"`);
    parts.push(`→ ${LANG_MAP[targetLang] || targetLang}: "${e[targetLang]}"`);
    return parts.join(' | ');
  });
  return `\n\nGLOSSARY — dùng đúng các bản dịch này khi gặp thuật ngữ:\n${lines.join('\n')}`;
};

// ── Dịch một đoạn text ────────────────────────────────────────────────────────
const translateText = async (text, targetLang = 'vi', sourceLang = 'auto', jobId = null) => {
  if (!text || text.trim() === '')
    return { translated: text, fromCache: false, fromGlossary: false };

  const trimmed = text.trim();

  // 1. Tra từ điển trước
  const hit = lookupTerm(trimmed, targetLang);
  if (hit) {
    logger.info(`Glossary hit: "${trimmed.slice(0, 30)}" → "${hit[targetLang]}"`, { jobId });
    return { translated: hit[targetLang], fromCache: false, fromGlossary: true };
  }

  // 2. Tra cache
  const cacheKey = `${targetLang}:${trimmed}`;
  const cached   = translationCache.get(cacheKey);
  if (cached !== undefined)
    return { translated: cached, fromCache: true, fromGlossary: false };

  // 3. Bỏ qua số / ký hiệu / URL / ký tự đơn
  if (/^[\d\s\.\,\-\+\%\$€£¥\/\(\)\[\]\:\=\#\@\*]+$/.test(trimmed))
    return { translated: trimmed, fromCache: false, fromGlossary: false, skipped: true };
  if (trimmed.length <= 1)
    return { translated: trimmed, fromCache: false, fromGlossary: false, skipped: true };
  if (/^https?:\/\//.test(trimmed))
    return { translated: trimmed, fromCache: false, fromGlossary: false, skipped: true };

  // 4. Gọi Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY chưa được cấu hình');

  const targetLangName  = LANG_MAP[targetLang] || targetLang;
  const glossaryContext = buildGlossaryContext(targetLang);

  const systemPrompt =
    `You are a professional technical translator for industrial and engineering documents.\n` +
    `Translate the given text to ${targetLangName}.\n` +
    `Rules:\n` +
    `- Return ONLY the translated text, no explanation\n` +
    `- Preserve numbers, units, special characters, line breaks\n` +
    `- Keep technical codes unchanged: PFC, SKU, ID, No., SN, etc.\n` +
    `- Keep brand names and model numbers unchanged\n` +
    `- If text is already ${targetLangName}, return as-is\n` +
    `- Use glossary terminology exactly${glossaryContext}`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: trimmed }]
      },
      {
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      }
    );

    const translated = response.data.content[0].text.trim();
    translationCache.set(cacheKey, translated);
    logger.info(`Translated: "${trimmed.slice(0, 40)}" → "${translated.slice(0, 40)}"`, { jobId, targetLang });
    return { translated, fromCache: false, fromGlossary: false };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error(`Translation API error: ${msg}`, { jobId });
    throw new Error(msg);
  }
};

// ── Dịch hàng loạt có rate limit ─────────────────────────────────────────────
const batchTranslate = async (texts, targetLang = 'vi', onProgress = null, jobId = null) => {
  const results    = [];
  const BATCH_SIZE = 5;
  const DELAY_MS   = 350;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch   = texts.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(t => translateText(t, targetLang, 'auto', jobId))
    );
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') results.push({ index: i + idx, ...r.value });
      else results.push({ index: i + idx, translated: batch[idx], error: r.reason?.message });
    });
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, texts.length), texts.length);
    if (i + BATCH_SIZE < texts.length) await new Promise(r => setTimeout(r, DELAY_MS));
    if (i % 50 === 0 && global.gc) global.gc();
  }
  return results;
};

const getCacheStats = () => {
  const s = translationCache.getStats();
  return { hits: s.hits, misses: s.misses, keys: translationCache.keys().length };
};

module.exports = { translateText, batchTranslate, getCacheStats };
