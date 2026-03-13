const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');
const { logger }      = require('./logger');
const { translateText } = require('./translationService');
const { extractTermsFromCell, hasChinese, hasEnglish } = require('./glossaryService');

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs');

// ── Job progress store ────────────────────────────────────────────────────────
const jobProgress = new Map();
const getJobProgress = (jobId) => jobProgress.get(jobId) || null;

// ── Quét file Excel để lấy thuật ngữ ─────────────────────────────────────────
const scanExcelForGlossary = async (filePath) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const terms = [];
  const seen  = new Set();

  workbook.eachSheet((sheet) => {
    logger.info(`Scanning sheet: "${sheet.name}" (${sheet.rowCount} rows)`);
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const val = getCellText(cell);
        if (!val) return;
        extractTermsFromCell(val).forEach(term => {
          const key = `${term.en}|${term.zh}`;
          if (!seen.has(key)) { seen.add(key); terms.push(term); }
        });
      });
    });
  });

  logger.info(`Scan complete: ${terms.length} term pairs found`);
  return terms;
};

// ── Dịch toàn bộ file Excel ───────────────────────────────────────────────────
const translateExcelFile = async (filePath, targetLang = 'vi', jobId, onProgress) => {
  jobProgress.set(jobId, { phase: 'reading', percent: 0, translated: 0, total: 0, errors: 0 });

  logger.info(`Reading: ${path.basename(filePath)}`, { jobId });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Đếm tổng số cells cần dịch
  let totalCells = 0;
  workbook.eachSheet(sheet => {
    sheet.eachRow({ includeEmpty: false }, row => {
      row.eachCell({ includeEmpty: false }, cell => {
        if (shouldTranslate(getCellText(cell))) totalCells++;
      });
    });
  });

  logger.info(`Total cells to translate: ${totalCells}`, { jobId });
  jobProgress.set(jobId, { phase: 'translating', percent: 0, translated: 0, total: totalCells, errors: 0 });

  let translatedCount = 0;
  let errorCount      = 0;

  // Dịch từng sheet, từng hàng, từng cell: trên xuống → trái qua phải
  for (let si = 0; si < workbook.worksheets.length; si++) {
    const sheet = workbook.worksheets[si];
    logger.info(`Processing sheet ${si + 1}/${workbook.worksheets.length}: "${sheet.name}"`, { jobId });

    const rows = [];
    sheet.eachRow({ includeEmpty: true }, row => rows.push(row));

    for (const row of rows) {
      const cells = [];
      row.eachCell({ includeEmpty: false }, cell => cells.push(cell));

      for (const cell of cells) {
        const originalText = getCellText(cell);
        if (!shouldTranslate(originalText)) continue;

        try {
          const { translated } = await translateText(originalText, targetLang, 'auto', jobId);
          applyTranslation(cell, originalText, translated);
          translatedCount++;

          const percent = Math.round((translatedCount / Math.max(totalCells, 1)) * 100);
          jobProgress.set(jobId, {
            phase: 'translating', percent,
            translated: translatedCount, total: totalCells, errors: errorCount
          });
          if (onProgress) onProgress({ percent, translated: translatedCount, total: totalCells });

          // Nhường event loop mỗi 10 cells để SSE không bị block
          if (translatedCount % 10 === 0) await new Promise(r => setTimeout(r, 30));

        } catch (err) {
          errorCount++;
          logger.error(`Cell error [${cell.address}]: ${err.message}`, { jobId });
          jobProgress.set(jobId, { ...jobProgress.get(jobId), errors: errorCount });
        }
      }
    }

    autoFitColumns(sheet);
  }

  // Ghi file output
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const baseName   = path.basename(filePath, path.extname(filePath));
  const outputName = `${baseName}_${targetLang}_${Date.now()}.xlsx`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  await workbook.xlsx.writeFile(outputPath);

  jobProgress.set(jobId, {
    phase: 'done', percent: 100,
    translated: translatedCount, total: totalCells,
    errors: errorCount, outputFile: outputName,
    _ts: Date.now()
  });

  logger.info(`Done: ${translatedCount} cells, ${errorCount} errors → ${outputName}`, { jobId });
  return { outputPath, outputName, translated: translatedCount, errors: errorCount };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getCellText = (cell) => {
  if (!cell.value && cell.value !== 0) return '';
  if (typeof cell.value === 'string')  return cell.value;
  if (typeof cell.value === 'number')  return String(cell.value);
  if (cell.value?.richText) return cell.value.richText.map(r => r.text || '').join('');
  if (cell.value?.text)     return String(cell.value.text);
  if (cell.value instanceof Date) return '';
  return String(cell.value);
};

const shouldTranslate = (text) => {
  if (!text || text.trim().length <= 1) return false;
  if (/^[\d\s\.\,\-\+\%\$€£¥\/\(\)\[\]\:\=\#\@\*]+$/.test(text.trim())) return false;
  if (/^https?:\/\//.test(text.trim())) return false;
  return hasChinese(text) || hasEnglish(text);
};

const applyTranslation = (cell, originalText, translatedText) => {
  if (translatedText === originalText) return;
  cell.value = translatedText;
  if (!cell.style)           cell.style           = {};
  if (!cell.style.alignment) cell.style.alignment = {};
  cell.style.alignment.wrapText  = true;
  cell.style.alignment.vertical  = cell.style.alignment.vertical || 'top';
};

const autoFitColumns = (sheet) => {
  sheet.columns.forEach(col => {
    if (!col || !col.eachCell) return;
    let maxLen = 10;
    col.eachCell({ includeEmpty: false }, cell => {
      const text = getCellText(cell);
      if (!text) return;
      text.split('\n').forEach(line => {
        const w = [...line].reduce((a, c) =>
          a + (/[\u4e00-\u9fff\u3040-\u30ff\uff00-\uffef]/.test(c) ? 2 : 1), 0);
        maxLen = Math.max(maxLen, Math.min(w + 4, 60));
      });
    });
    col.width = maxLen;
  });
};

// Dọn dẹp job cũ sau 30 phút
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  jobProgress.forEach((v, k) => {
    if (v.phase === 'done' && v._ts && v._ts < cutoff) jobProgress.delete(k);
  });
}, 5 * 60 * 1000);

module.exports = { scanExcelForGlossary, translateExcelFile, getJobProgress, jobProgress };
