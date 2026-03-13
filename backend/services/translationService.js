const { GoogleGenerativeAI } = require('@google/generative-ai');
const NodeCache               = require('node-cache');
const { logger }              = require('./logger');
const { lookupTerm, readGlossary } = require('./glossaryService');

// ── Cache: TTL 1 giờ, tối đa 5000 keys ───────────────────────────────────────
const translationCache = new NodeCache({ stdTTL: 3600, maxKeys: 5000 });

// ── Khởi tạo Gemini client (lazy — chỉ khởi tạo khi gọi lần đầu) ─────────────
let genAIInstance = null;
const getGenAI = () => {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY chưa được cấu hình trong environment variables');
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
};

// ── Rate limiter: Gemini Free = 15 RPM ───────────────────────────────────────
// Cơ chế token bucket đơn giản
const rateLimiter = {
  maxPerMinute: 14,          // giữ dưới 15 RPM để có buffer
  queue:        [],
  running:      0,
  timestamps:   [],          // lưu thời điểm các request gần nhất

  async acquire() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this._process();
    });
  },

  _process() {
    if (this.queue.length === 0) return;

    const now     = Date.now();
    const oneMin  = 60 * 1000;

    // Xóa timestamp cũ hơn 1 phút
    this.timestamps = this.timestamps.filter(t => now - t < oneMin);

    if (this.timestamps.length < this.maxPerMinute) {
      // Còn quota trong phút này → chạy ngay
      this.timestamps.push(now);
      const resolve = this.queue.shift();
      resolve();
    } else {
      // Hết quota → chờ đến khi timestamp cũ nhất thoát khỏi cửa sổ 1 phút
      const oldestTs   = this.timestamps[0];
      const waitMs     = oneMin - (now - oldestTs) + 100; // +100ms buffer
      logger.warn(`Rate limit: chờ ${waitMs}ms trước khi gửi request tiếp theo`);
      setTimeout(() => this._process(), waitMs);
    }
  }
};

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

  // 1. Tra từ điển trước (không tốn API call)
  const hit = lookupTerm(trimmed, targetLang);
  if (hit) {
    logger.info(`Glossary hit: "${trimmed.slice(0, 30)}" → "${hit[targetLang]}"`, { jobId });
    return { translated: hit[targetLang], fromCache: false, fromGlossary: true };
  }

  // 2. Tra cache (không tốn API call)
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

  // 4. Gọi Gemini API (có rate limit)
  await rateLimiter.acquire();

  const targetLangName  = LANG_MAP[targetLang] || targetLang;
  const glossaryContext = buildGlossaryContext(targetLang);

  const systemInstruction =
    `You are a professional technical translator for industrial and engineering documents.\n` +
    `Translate the given text to ${targetLangName}.\n` +
    `Rules:\n` +
    `- Return ONLY the translated text, no explanation, no preamble\n` +
    `- Preserve numbers, units, special characters, and line breaks exactly\n` +
    `- Keep technical codes unchanged: PFC, SKU, ID, No., SN, REF, etc.\n` +
    `- Keep brand names and model numbers unchanged\n` +
    `- If text is already in ${targetLangName}, return it as-is\n` +
    `- Use glossary terminology exactly${glossaryContext}`;

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
      model:             'gemini-1.5-flash',
      systemInstruction: systemInstruction
    });

    const result   = await model.generateContent(trimmed);
    const response = await result.response;
    const translated = response.text().trim();

    translationCache.set(cacheKey, translated);
    logger.info(`Translated: "${trimmed.slice(0, 40)}" → "${translated.slice(0, 40)}"`, { jobId, targetLang });
    return { translated, fromCache: false, fromGlossary: false };

  } catch (err) {
    // Xử lý lỗi 429 Too Many Requests
    if (err.status === 429 || err.message?.includes('429') || err.message?.includes('quota')) {
      logger.warn(`Rate limit hit (429), chờ 60s rồi thử lại...`, { jobId });
      await new Promise(r => setTimeout(r, 60000));
      // Thử lại 1 lần
      try {
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({
          model:             'gemini-1.5-flash',
          systemInstruction: systemInstruction
        });
        const result     = await model.generateContent(trimmed);
        const response   = await result.response;
        const translated = response.text().trim();
        translationCache.set(cacheKey, translated);
        return { translated, fromCache: false, fromGlossary: false };
      } catch (retryErr) {
        logger.error(`Retry cũng thất bại: ${retryErr.message}`, { jobId });
        throw new Error(`Gemini rate limit — thử lại sau: ${retryErr.message}`);
      }
    }

    logger.error(`Gemini API error: ${err.message}`, { jobId });
    throw new Error(err.message);
  }
};

// ── Dịch hàng loạt (tuần tự để không vượt rate limit) ────────────────────────
// Không dùng Promise.all vì Gemini Free chỉ có 15 RPM
const batchTranslate = async (texts, targetLang = 'vi', onProgress = null, jobId = null) => {
  const results = [];

  for (let i = 0; i < texts.length; i++) {
    try {
      const result = await translateText(texts[i], targetLang, 'auto', jobId);
      results.push({ index: i, ...result });
    } catch (err) {
      logger.error(`Batch item ${i} failed`, { error: err.message, jobId });
      results.push({ index: i, translated: texts[i], error: err.message });
    }
    if (onProgress) onProgress(i + 1, texts.length);
    if (i % 50 === 0 && global.gc) global.gc();
  }

  return results;
};

const getCacheStats = () => {
  const s = translationCache.getStats();
  return { hits: s.hits, misses: s.misses, keys: translationCache.keys().length };
};

module.exports = { translateText, batchTranslate, getCacheStats };
