import { useState, useEffect, useRef, useCallback } from "react";

const API = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

const LANGS = [
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", label: "English",    flag: "🇺🇸" },
  { code: "ja", label: "日本語",      flag: "🇯🇵" },
  { code: "ko", label: "한국어",      flag: "🇰🇷" },
  { code: "fr", label: "Français",   flag: "🇫🇷" },
  { code: "de", label: "Deutsch",    flag: "🇩🇪" },
];

// ── API helper ────────────────────────────────────────────────────────────────
const req = async (url, opts = {}) => {
  const r = await fetch(`${API}${url}`, opts);
  if (!r.ok) { const t = await r.text(); throw new Error(JSON.parse(t).error || t); }
  return r.json();
};

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICONS = {
  translate: "M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6",
  book:      "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z",
  history:   "M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8",
  logs:      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  upload:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download:  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  plus:      "M12 5v14M5 12h14",
  trash:     "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
  edit:      "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  check:     "M20 6L9 17l-5-5",
  x:         "M18 6L6 18M6 6l12 12",
  search:    "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  refresh:   "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  zap:       "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  copy:      "M8 17.929H6c-1.105 0-2-.912-2-2.036V5.036C4 3.91 4.895 3 6 3h8c1.105 0 2 .911 2 2.036v1.866m-6 .17h8c1.105 0 2 .91 2 2.035v10.857C20 21.09 19.105 22 18 22h-8c-1.105 0-2-.911-2-2.036V9.107c0-1.124.895-2.036 2-2.036z",
  export:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  filter:    "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  stats:     "M18 20V10M12 20V4M6 20v-6",
};

const Ic = ({ n, s = 16 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={ICONS[n]} />
  </svg>
);

// ── Toast ─────────────────────────────────────────────────────────────────────
const useToast = () => {
  const [toasts, set] = useState([]);
  const add = useCallback((msg, type = "info") => {
    const id = Date.now();
    set(t => [...t.slice(-4), { id, msg, type }]);
    setTimeout(() => set(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  return { toasts, toast: add };
};

const Toasts = ({ items }) => (
  <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none" }}>
    {items.map(t => (
      <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
    ))}
  </div>
);

// ── Reusable UI atoms ─────────────────────────────────────────────────────────
const Chip = ({ label, value, accent = "var(--c-cyan)" }) => (
  <div className="chip">
    <span className="chip-label">{label}</span>
    <span className="chip-value" style={{ color: accent }}>{value}</span>
  </div>
);

const Pill = ({ children, active, onClick }) => (
  <button className={`pill ${active ? "pill-active" : ""}`} onClick={onClick}>{children}</button>
);

const GhostBtn = ({ children, onClick, disabled, accent = "var(--c-cyan)", full }) => (
  <button className="ghost-btn" onClick={onClick} disabled={disabled}
    style={{ "--acc": accent, width: full ? "100%" : undefined }}>
    {children}
  </button>
);

const SolidBtn = ({ children, onClick, disabled, accent = "var(--c-cyan)" }) => (
  <button className="solid-btn" onClick={onClick} disabled={disabled} style={{ "--acc": accent }}>
    {children}
  </button>
);

// ── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ pct, label, sub }) => (
  <div className="progress-wrap">
    <div className="progress-header">
      <span className="progress-label">{label}</span>
      <span className="progress-pct">{pct}%</span>
    </div>
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
    {sub && <div className="progress-sub">{sub}</div>}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// PAGE: TRANSLATE
// ═════════════════════════════════════════════════════════════════════════════
const TranslatePage = ({ toast }) => {
  const [file, setFile]       = useState(null);
  const [lang, setLang]       = useState("vi");
  const [jobId, setJobId]     = useState(null);
  const [prog, setProg]       = useState(null);  // progress state
  const [done, setDone]       = useState(null);
  const [drag, setDrag]       = useState(false);
  const [testIn, setTestIn]   = useState("");
  const [testOut, setTestOut] = useState(null);
  const [testBusy, setTB]     = useState(false);
  const [cStats, setCS]       = useState(null);
  const esRef  = useRef(null);
  const fileIn = useRef(null);

  useEffect(() => {
    req("/translate/cache-stats").then(setCS).catch(() => {});
  }, []);

  // SSE listener
  useEffect(() => {
    if (!jobId) return;
    esRef.current?.close();
    const es = new EventSource(`${API}/translate/progress/${jobId}`);
    esRef.current = es;
    es.onmessage = ({ data }) => {
      const d = JSON.parse(data);
      if (d.type === "progress" || d.type === "done") {
        setProg(d);
        if (d.type === "done") {
          setDone(d);
          toast(`✅ Dịch xong! ${d.translated} cells — ${d.geminiCalls || 0} Gemini calls`, "success");
          es.close();
          req("/translate/cache-stats").then(setCS).catch(() => {});
        }
      }
      if (d.type === "error") { toast("❌ " + d.error, "error"); es.close(); setJobId(null); }
    };
    return () => es.close();
  }, [jobId]);

  const pickFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.xlsx?$/i)) { toast("Chỉ hỗ trợ .xlsx / .xls", "error"); return; }
    setFile(f); setDone(null); setProg(null);
  };

  const startJob = async () => {
    if (!file) return toast("Chọn file trước", "error");
    setProg({ phase:"translating", percent:0, translated:0, total:0, geminiCalls:0 });
    setDone(null);
    const fd = new FormData();
    fd.append("file", file); fd.append("targetLang", lang);
    try {
      const { jobId: id } = await req("/translate/start", { method:"POST", body:fd });
      setJobId(id);
      toast("🚀 Đã bắt đầu dịch...", "info");
    } catch (e) { toast(e.message, "error"); setProg(null); }
  };

  const testTranslate = async () => {
    if (!testIn.trim()) return;
    setTB(true); setTestOut(null);
    try {
      const r = await req("/translate/text", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text: testIn, targetLang: lang })
      });
      setTestOut(r);
    } catch (e) { toast(e.message, "error"); }
    setTB(false);
  };

  const busy = prog?.phase === "translating" && !done;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dịch File Excel</h1>
        <p className="page-desc">Upload file EN/ZH → dịch sang ngôn ngữ đích, giữ nguyên định dạng ô</p>
      </div>

      <div className="translate-grid">
        {/* LEFT */}
        <div className="col-main">
          {/* Drop zone */}
          <div
            className={`dropzone ${drag ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
            onClick={() => fileIn.current.click()}
          >
            <input ref={fileIn} type="file" accept=".xlsx,.xls" style={{display:"none"}}
              onChange={e => pickFile(e.target.files[0])} />
            <div className="dropzone-icon">{file ? "📊" : "📁"}</div>
            {file ? (
              <div>
                <div className="dropzone-filename">{file.name}</div>
                <div className="dropzone-meta">{(file.size/1024).toFixed(1)} KB · Sẵn sàng dịch</div>
              </div>
            ) : (
              <div>
                <div className="dropzone-main">Kéo thả file Excel vào đây</div>
                <div className="dropzone-sub">hoặc click để chọn · .xlsx / .xls</div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="controls-row">
            <div className="field">
              <label className="field-label">NGÔN NGỮ ĐÍCH</label>
              <select className="select" value={lang} onChange={e => setLang(e.target.value)}>
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.label}</option>)}
              </select>
            </div>
            <div className="field-action">
              <SolidBtn onClick={startJob} disabled={!file || busy}>
                {busy ? <><span className="spin">⟳</span> Đang dịch…</> : <><Ic n="zap" /> Bắt Đầu Dịch</>}
              </SolidBtn>
            </div>
          </div>

          {/* Progress */}
          {prog && (
            <div className="card">
              <ProgressBar
                pct={prog.percent || 0}
                label={prog.phase === "done" ? "✅ Hoàn thành" : prog.phase === "reading" ? "📖 Đọc file…" : "⚙️ Đang dịch…"}
                sub={
                  prog.total > 0
                    ? `${prog.translated || 0} / ${prog.total} cells${prog.geminiCalls ? ` · ${prog.geminiCalls} Gemini calls` : ""}${prog.errors > 0 ? ` · ⚠ ${prog.errors} lỗi` : ""}`
                    : undefined
                }
              />
              {prog.phase === "translating" && prog.total > 0 && (
                <div className="stats-row" style={{marginTop:14}}>
                  <Chip label="Glossary" value={prog.translated > 0 ? `${Math.max(0,prog.translated-(prog.geminiCalls||0)*8)}` : "—"} accent="var(--c-green)" />
                  <Chip label="Gemini calls" value={prog.geminiCalls || 0} accent="var(--c-cyan)" />
                  <Chip label="Còn lại" value={Math.max(0,(prog.total||0)-(prog.translated||0))} />
                </div>
              )}
            </div>
          )}

          {/* Download */}
          {done?.outputFile && (
            <a className="download-banner" href={`${API}/translate/download/${done.outputFile}`} download>
              <Ic n="download" s={20} />
              <div>
                <div className="dl-title">Tải File Đã Dịch</div>
                <div className="dl-meta">{done.outputFile}</div>
              </div>
              <span className="dl-arrow">→</span>
            </a>
          )}
        </div>

        {/* RIGHT */}
        <div className="col-side">
          {/* Quick test */}
          <div className="card">
            <div className="card-title">⚡ Kiểm Tra Nhanh</div>
            <textarea
              className="textarea"
              rows={4}
              value={testIn}
              onChange={e => setTestIn(e.target.value)}
              placeholder="Nhập text EN / ZH để test dịch…"
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) testTranslate(); }}
            />
            <GhostBtn onClick={testTranslate} disabled={testBusy || !testIn.trim()} full>
              {testBusy ? "Đang dịch…" : "▶  Dịch thử  (Ctrl+Enter)"}
            </GhostBtn>
            {testOut && (
              <div className="test-result">
                <div className="test-translated">{testOut.translated}</div>
                <div className="test-source">
                  {testOut.fromGlossary ? `📚 Glossary (${testOut.matchType})` : testOut.fromCache ? "⚡ Cache" : "🤖 Gemini API"}
                </div>
              </div>
            )}
          </div>

          {/* Cache stats */}
          {cStats && (
            <div className="card">
              <div className="card-title">💾 Cache</div>
              <div className="stats-col">
                <div className="stat-line">
                  <span>Session (RAM)</span>
                  <span className="stat-val cyan">{cStats.session?.keys ?? 0} / {cStats.session?.maxKeys ?? 500}</span>
                </div>
                <div className="stat-line">
                  <span>File cache</span>
                  <span className="stat-val green">{cStats.file?.keys ?? 0} entries</span>
                </div>
                <div className="stat-line">
                  <span>Glossary index</span>
                  <span className="stat-val yellow">{cStats.glossary?.keys ?? 0} keys</span>
                </div>
              </div>
            </div>
          )}

          {/* Efficiency hint */}
          <div className="hint-box">
            <div className="hint-title">💡 Tối ưu quota</div>
            <div className="hint-text">
              Upload nhiều file mẫu đã dịch vào <strong>Từ Điển</strong> trước. Mỗi entry Glossary tiết kiệm 1 Gemini call.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE: GLOSSARY
// ═════════════════════════════════════════════════════════════════════════════
const GlossaryPage = ({ toast }) => {
  const [entries, setEntries]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [totalPages, setTP]     = useState(1);
  const [totalCount, setTC]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [tab, setTab]           = useState("list");
  const [editRow, setEditRow]   = useState(null); // { id, en, zh, vi }
  const [addOpen, setAddOpen]   = useState(false);
  const [newRow, setNewRow]     = useState({ en:"", zh:"", vi:"" });
  const [scanFile, setScanF]    = useState(null);
  const [scanBusy, setScanB]    = useState(false);
  const [impFile, setImpF]      = useState(null);
  const [impBusy, setImpB]      = useState(false);
  const [impCols, setImpCols]   = useState({ src:"A", tgt:"B" });
  const scanRef = useRef(); const impRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([
        req(`/glossary?page=${page}&limit=50&search=${encodeURIComponent(search)}`),
        req("/glossary/stats")
      ]);
      setEntries(g.entries); setTP(g.pages); setTC(g.total); setStats(s);
    } catch (e) { toast(e.message, "error"); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const saveEdit = async () => {
    try {
      await req("/glossary/entry", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(editRow) });
      toast("Đã lưu", "success"); setEditRow(null); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const addEntry = async () => {
    if (!newRow.en && !newRow.zh) return toast("Nhập EN hoặc ZH", "error");
    try {
      await req("/glossary/entry", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(newRow) });
      toast("✅ Đã thêm", "success"); setNewRow({en:"",zh:"",vi:""}); setAddOpen(false); load();
    } catch (e) { toast(e.message, "error"); }
  };

  const delEntry = async (id) => {
    if (!confirm("Xóa từ này?")) return;
    try { await req(`/glossary/entry/${id}`, { method:"DELETE" }); toast("Đã xóa", "success"); load(); }
    catch (e) { toast(e.message, "error"); }
  };

  const scanGlossary = async () => {
    if (!scanFile) return;
    setScanB(true);
    const fd = new FormData(); fd.append("file", scanFile);
    try {
      const r = await req("/glossary/scan", { method:"POST", body:fd });
      toast(`✅ Quét xong: +${r.added} từ mới (${r.extracted} cặp tìm thấy)`, "success");
      setScanF(null); load();
    } catch (e) { toast(e.message, "error"); }
    setScanB(false);
  };

  const importTranslated = async () => {
    if (!impFile) return;
    setImpB(true);
    const fd = new FormData();
    fd.append("file", impFile); fd.append("sourceCol", impCols.src);
    fd.append("translatedCol", impCols.tgt); fd.append("lang", "vi");
    try {
      const r = await req("/glossary/import-translated", { method:"POST", body:fd });
      toast(`✅ Import: +${r.added} mới, cập nhật ${r.updated}`, "success");
      setImpF(null); load();
    } catch (e) { toast(e.message, "error"); }
    setImpB(false);
  };

  const exportGlossary = async () => {
    try {
      const g = await req("/glossary?page=1&limit=999999");
      const rows = [["EN","ZH","VI","Nguồn","Ngày tạo"]];
      g.entries.forEach(e => rows.push([e.en,e.zh,e.vi,e.source,e.createdAt?.slice(0,10)||""]));
      const csv = rows.map(r => r.map(c => `"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
      const a   = document.createElement("a");
      a.href    = URL.createObjectURL(new Blob(["\ufeff"+csv], {type:"text/csv"}));
      a.download= `pfchub_glossary_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      toast("✅ Xuất CSV xong", "success");
    } catch (e) { toast(e.message, "error"); }
  };

  const SRC_COLOR = { manual:"var(--c-purple)", scanned:"var(--c-yellow)", imported:"var(--c-cyan)" };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Từ Điển Glossary</h1>
          {stats && (
            <div className="stats-row" style={{marginTop:8}}>
              <Chip label="Tổng"      value={stats.total}     />
              <Chip label="Có VI"     value={stats.withVi}    accent="var(--c-green)" />
              <Chip label="Song ngữ" value={stats.bilingual} accent="var(--c-cyan)" />
              <Chip label="Phiên bản" value={`v${stats.version}`} accent="var(--c-purple)" />
            </div>
          )}
        </div>
        <div className="header-actions">
          <GhostBtn onClick={exportGlossary}><Ic n="export" /> Xuất CSV</GhostBtn>
          <SolidBtn onClick={() => setAddOpen(o => !o)}><Ic n="plus" /> Thêm từ</SolidBtn>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabs">
        {[["list","📋 Danh Sách"],["scan","🔍 Quét File"],["import","📥 Import"]].map(([id,lb]) => (
          <Pill key={id} active={tab===id} onClick={() => setTab(id)}>{lb}</Pill>
        ))}
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="inline-form">
          <div className="inline-form-title">Thêm Từ Mới</div>
          <div className="form-grid-3">
            {[["English","en"],["中文","zh"],["Tiếng Việt","vi"]].map(([lb,k]) => (
              <div key={k} className="field">
                <label className="field-label">{lb}</label>
                <input className="input" value={newRow[k]} onChange={e => setNewRow(p => ({...p,[k]:e.target.value}))} />
              </div>
            ))}
          </div>
          <div className="form-actions">
            <SolidBtn onClick={addEntry} accent="var(--c-green)"><Ic n="check" /> Thêm</SolidBtn>
            <GhostBtn onClick={() => setAddOpen(false)}><Ic n="x" /> Hủy</GhostBtn>
          </div>
        </div>
      )}

      {tab === "list" && (
        <>
          {/* Search bar */}
          <div className="search-row">
            <div className="search-wrap">
              <Ic n="search" s={15} />
              <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm EN · ZH · VI…" />
              {search && <button className="search-clear" onClick={() => setSearch("")}><Ic n="x" s={13} /></button>}
            </div>
            <span className="result-count">{totalCount} từ</span>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>English</th><th>中文</th><th>Tiếng Việt</th><th>Nguồn</th><th style={{width:80}}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="table-empty">⏳ Đang tải…</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={5} className="table-empty">Không có dữ liệu</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id} className="table-row">
                    {editRow?.id === e.id ? (
                      <>
                        <td><input className="cell-input" value={editRow.en} onChange={ev => setEditRow(r=>({...r,en:ev.target.value}))} /></td>
                        <td><input className="cell-input" value={editRow.zh} onChange={ev => setEditRow(r=>({...r,zh:ev.target.value}))} /></td>
                        <td><input className="cell-input cell-input-vi" value={editRow.vi} onChange={ev => setEditRow(r=>({...r,vi:ev.target.value}))} /></td>
                        <td></td>
                        <td>
                          <div className="row-actions">
                            <button className="act-btn act-ok" onClick={saveEdit}><Ic n="check" s={13} /></button>
                            <button className="act-btn act-no" onClick={() => setEditRow(null)}><Ic n="x" s={13} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="cell-en">{e.en || <span className="empty-cell">—</span>}</td>
                        <td className="cell-zh">{e.zh || <span className="empty-cell">—</span>}</td>
                        <td className="cell-vi">{e.vi || <span className="cell-missing">chưa dịch</span>}</td>
                        <td><span className="src-badge" style={{"--sc": SRC_COLOR[e.source]||"var(--c-dim)"}}>{e.source}</span></td>
                        <td>
                          <div className="row-actions">
                            <button className="act-btn act-edit" onClick={() => setEditRow({id:e.id,en:e.en,zh:e.zh,vi:e.vi})}><Ic n="edit" s={13} /></button>
                            <button className="act-btn act-del" onClick={() => delEntry(e.id)}><Ic n="trash" s={13} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button className="pag-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>← Trước</button>
              <span className="pag-info">{page} / {totalPages}</span>
              <button className="pag-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>Sau →</button>
            </div>
          )}
        </>
      )}

      {tab === "scan" && (
        <div className="card">
          <div className="card-title">🔍 Quét File Excel — Trích Xuất Thuật Ngữ</div>
          <p className="card-desc">Upload file Excel có EN/ZH để tự động tìm cặp thuật ngữ song ngữ và bổ sung vào từ điển.</p>
          <div className="upload-row">
            <input ref={scanRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e => setScanF(e.target.files[0])} />
            <GhostBtn onClick={() => scanRef.current.click()}><Ic n="upload" /> Chọn file</GhostBtn>
            {scanFile && <span className="file-name">{scanFile.name}</span>}
            <SolidBtn onClick={scanGlossary} disabled={!scanFile || scanBusy}>
              {scanBusy ? "⏳ Đang quét…" : "🔍 Quét ngay"}
            </SolidBtn>
          </div>
        </div>
      )}

      {tab === "import" && (
        <div className="card">
          <div className="card-title">📥 Import Từ File Đã Dịch</div>
          <p className="card-desc">Upload file Excel có cột nguồn (EN/ZH) và cột đã dịch (VI). Hàng đầu tiên là header, tự động bỏ qua.</p>
          <div className="form-grid-2" style={{marginBottom:16}}>
            <div className="field">
              <label className="field-label">Cột nguồn (EN/ZH)</label>
              <input className="input" value={impCols.src} onChange={e => setImpCols(c=>({...c,src:e.target.value}))} style={{width:80}} />
            </div>
            <div className="field">
              <label className="field-label">Cột đã dịch (VI)</label>
              <input className="input" value={impCols.tgt} onChange={e => setImpCols(c=>({...c,tgt:e.target.value}))} style={{width:80}} />
            </div>
          </div>
          <div className="upload-row">
            <input ref={impRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e => setImpF(e.target.files[0])} />
            <GhostBtn onClick={() => impRef.current.click()}><Ic n="upload" /> Chọn file</GhostBtn>
            {impFile && <span className="file-name">{impFile.name}</span>}
            <SolidBtn onClick={importTranslated} disabled={!impFile || impBusy} accent="var(--c-green)">
              {impBusy ? "⏳ Importing…" : "📥 Import"}
            </SolidBtn>
          </div>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE: HISTORY
// ═════════════════════════════════════════════════════════════════════════════
const HistoryPage = ({ toast }) => {
  const [records, setRec]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setL]     = useState(false);

  const load = useCallback(async () => {
    setL(true);
    try {
      const r = await req(`/history?page=${page}&limit=30`);
      setRec(r.records); setTotal(r.total);
    } catch (e) { toast(e.message, "error"); }
    setL(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const ACTION = {
    translate:       { label:"Dịch File",    color:"var(--c-cyan)",   icon:"translate" },
    glossary_scan:   { label:"Quét Glossary", color:"var(--c-yellow)", icon:"search" },
    glossary_add:    { label:"Thêm Từ",       color:"var(--c-green)",  icon:"plus" },
    glossary_import: { label:"Import",        color:"var(--c-purple)", icon:"upload" },
  };

  const filtered = filter === "all" ? records : records.filter(r => r.action === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch Sử Hoạt Động</h1>
          <p className="page-desc">{total} bản ghi được lưu lại</p>
        </div>
        <GhostBtn onClick={load}><Ic n="refresh" /> Làm mới</GhostBtn>
      </div>

      {/* Filter */}
      <div className="tabs">
        <Pill active={filter==="all"} onClick={() => setFilter("all")}>Tất cả</Pill>
        {Object.entries(ACTION).map(([k,v]) => (
          <Pill key={k} active={filter===k} onClick={() => setFilter(k)}>
            <Ic n={v.icon} s={13} /> {v.label}
          </Pill>
        ))}
      </div>

      <div className="history-list">
        {loading ? <div className="empty-state">⏳ Đang tải…</div>
         : filtered.length === 0 ? <div className="empty-state">Không có dữ liệu</div>
         : filtered.map(r => {
          const a = ACTION[r.action] || { label: r.action, color:"var(--c-dim)", icon:"logs" };
          return (
            <div key={r.id} className="history-item">
              <div className="hist-dot" style={{background: a.color}} />
              <div className="hist-body">
                <div className="hist-top">
                  <span className="hist-badge" style={{"--hc": a.color}}>{a.label}</span>
                  <span className="hist-file">{r.fileName}</span>
                  {r.targetLang && <span className="hist-lang">{r.targetLang.toUpperCase()}</span>}
                </div>
                {r.details && <div className="hist-details">{r.details}</div>}
                {r.outputFile && (
                  <a className="hist-dl" href={`${API}/translate/download/${r.outputFile}`} download>
                    <Ic n="download" s={13} /> {r.outputFile}
                  </a>
                )}
              </div>
              <div className="hist-time">{new Date(r.timestamp).toLocaleString("vi-VN")}</div>
            </div>
          );
        })}
      </div>

      {total > 30 && (
        <div className="pagination">
          <button className="pag-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>← Trước</button>
          <span className="pag-info">Trang {page}</span>
          <button className="pag-btn" disabled={filtered.length<30} onClick={() => setPage(p=>p+1)}>Sau →</button>
        </div>
      )}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// PAGE: LOGS
// ═════════════════════════════════════════════════════════════════════════════
const LogsPage = ({ toast }) => {
  const [logs, setLogs]   = useState([]);
  const [level, setLvl]   = useState("");
  const [live, setLive]   = useState(false);
  const [follow, setFollow] = useState(true);
  const listRef = useRef(); const tiRef = useRef();

  const load = useCallback(() => {
    req(`/logs?limit=300${level?`&level=${level}`:""}`)
      .then(r => {
        setLogs(r.logs);
        if (follow && listRef.current) {
          setTimeout(() => { if(listRef.current) listRef.current.scrollTop = 0; }, 50);
        }
      }).catch(() => {});
  }, [level, follow]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (live) tiRef.current = setInterval(load, 2000);
    else clearInterval(tiRef.current);
    return () => clearInterval(tiRef.current);
  }, [live, load]);

  const clearLogs = async () => {
    await req("/logs", { method:"DELETE" });
    setLogs([]); toast("Đã xóa logs", "success");
  };

  const LC = { error:"#ff4d4d", warn:"#ffa040", info:"#40c8ff", debug:"#6b7a99" };

  return (
    <div className="page page-logs">
      <div className="page-header">
        <h1 className="page-title">System Logs</h1>
        <div className="header-actions">
          <select className="select select-sm" value={level} onChange={e => setLvl(e.target.value)}>
            <option value="">Tất cả</option>
            {["error","warn","info","debug"].map(l=><option key={l} value={l}>{l}</option>)}
          </select>
          <GhostBtn onClick={() => setLive(l=>!l)} accent={live?"var(--c-green)":"var(--c-dim)"}>
            <Ic n={live?"x":"zap"} s={13} /> {live?"Stop live":"Live"}
          </GhostBtn>
          <GhostBtn onClick={load}><Ic n="refresh" s={13} /></GhostBtn>
          <GhostBtn onClick={clearLogs} accent="var(--c-red)"><Ic n="trash" s={13} /></GhostBtn>
        </div>
      </div>
      <div className="log-terminal" ref={listRef}>
        {logs.length === 0
          ? <div className="log-empty">— no logs —</div>
          : logs.map((l,i) => (
          <div key={i} className="log-line">
            <span className="log-time">{new Date(l.timestamp).toLocaleTimeString("vi-VN")}</span>
            <span className="log-level" style={{color:LC[l.level]||"#999"}}>{l.level.padEnd(5)}</span>
            <span className="log-msg" style={{color:l.level==="error"?"#ff8080":l.level==="warn"?"#ffc080":"#b0bcd0"}}>{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═════════════════════════════════════════════════════════════════════════════
const NAV = [
  { id:"translate", icon:"translate", label:"Dịch File" },
  { id:"glossary",  icon:"book",      label:"Từ Điển"   },
  { id:"history",   icon:"history",   label:"Lịch Sử"   },
  { id:"logs",      icon:"logs",      label:"Logs"      },
];

const PAGES = { translate:TranslatePage, glossary:GlossaryPage, history:HistoryPage, logs:LogsPage };

export default function App() {
  const [pg, setPg]       = useState("translate");
  const [online, setOnline] = useState(null);
  const { toasts, toast } = useToast();

  useEffect(() => {
    const check = () => req("/health").then(()=>setOnline(true)).catch(()=>setOnline(false));
    check();
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  const Page = PAGES[pg];

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">PFC<span>HUB</span></div>
            <div className="brand-sub">Dictionary Builder</div>
          </div>

          <nav className="nav">
            {NAV.map(n => (
              <button key={n.id} className={`nav-item ${pg===n.id?"nav-active":""}`} onClick={() => setPg(n.id)}>
                <span className="nav-icon"><Ic n={n.icon} s={18} /></span>
                <span>{n.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="server-status">
              <span className={`status-dot ${online===null?"dot-idle":online?"dot-on":"dot-off"}`} />
              <span className="status-text">
                {online===null ? "connecting…" : online ? "server online" : "offline"}
              </span>
            </div>
            {online===false && (
              <div className="offline-hint">node --expose-gc server.js</div>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="content">
          {online===false && (
            <div className="offline-banner">
              ⚠ Backend offline — chạy: <code>cd backend &amp;&amp; node --expose-gc server.js</code>
            </div>
          )}
          <Page toast={toast} />
        </main>
      </div>
      <Toasts items={toasts} />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CSS — Industrial dark theme
// ═════════════════════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600&display=swap');

:root {
  --c-bg:      #08090d;
  --c-surface: #0e1018;
  --c-border:  #1c2030;
  --c-border2: #242840;
  --c-text:    #d4daf0;
  --c-dim:     #4a5270;
  --c-cyan:    #00e5ff;
  --c-green:   #00ff9d;
  --c-yellow:  #ffd040;
  --c-purple:  #b060ff;
  --c-red:     #ff4060;
  --c-orange:  #ff8c40;
  --font-head: 'Syne', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'DM Sans', sans-serif;
  --r:         8px;
}

*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--c-bg);color:var(--c-text);font-family:var(--font-body);font-size:14px;}
::-webkit-scrollbar{width:5px;height:5px;}
::-webkit-scrollbar-track{background:var(--c-surface);}
::-webkit-scrollbar-thumb{background:var(--c-border2);border-radius:3px;}
select,input,textarea,button{font-family:var(--font-body);outline:none;}
select option{background:var(--c-surface);}

/* Layout */
.app{display:flex;height:100vh;overflow:hidden;}

/* Sidebar */
.sidebar{
  width:210px;flex-shrink:0;
  background:var(--c-surface);
  border-right:1px solid var(--c-border);
  display:flex;flex-direction:column;
  padding:0;
}
.brand{
  padding:24px 20px 20px;
  border-bottom:1px solid var(--c-border);
}
.brand-logo{
  font-family:var(--font-head);font-size:22px;font-weight:800;
  color:var(--c-text);letter-spacing:1px;
}
.brand-logo span{color:var(--c-cyan);}
.brand-sub{font-size:10px;color:var(--c-dim);font-family:var(--font-mono);margin-top:3px;letter-spacing:.5px;}

.nav{flex:1;padding:12px 0;}
.nav-item{
  width:100%;display:flex;align-items:center;gap:10px;
  padding:10px 20px;background:none;border:none;
  border-left:2px solid transparent;cursor:pointer;
  color:var(--c-dim);font-size:13.5px;font-family:var(--font-body);font-weight:500;
  transition:all .15s;text-align:left;
}
.nav-item:hover{color:var(--c-text);background:rgba(255,255,255,.03);}
.nav-active{
  color:var(--c-cyan)!important;
  border-left-color:var(--c-cyan)!important;
  background:rgba(0,229,255,.06)!important;
  font-weight:600!important;
}
.nav-icon{display:flex;align-items:center;}

.sidebar-footer{padding:16px 20px;border-top:1px solid var(--c-border);}
.server-status{display:flex;align-items:center;gap:8px;}
.status-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.dot-idle{background:var(--c-dim);}
.dot-on{background:var(--c-green);box-shadow:0 0 6px var(--c-green);}
.dot-off{background:var(--c-red);}
.status-text{font-size:11px;color:var(--c-dim);font-family:var(--font-mono);}
.offline-hint{font-size:10px;color:var(--c-border2);font-family:var(--font-mono);margin-top:6px;line-height:1.5;}

/* Main content */
.content{flex:1;overflow:auto;background:var(--c-bg);}
.offline-banner{
  background:rgba(255,64,96,.1);border-bottom:1px solid rgba(255,64,96,.25);
  padding:10px 28px;font-size:13px;color:#ff8090;font-family:var(--font-mono);
}
.offline-banner code{background:rgba(255,255,255,.08);padding:1px 8px;border-radius:4px;}

/* Page */
.page{padding:28px 32px;max-width:1200px;}
.page-logs{max-width:100%;height:100%;display:flex;flex-direction:column;}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
.page-title{font-family:var(--font-head);font-size:24px;font-weight:800;color:var(--c-text);}
.page-desc{color:var(--c-dim);font-size:13px;margin-top:5px;}
.header-actions{display:flex;gap:10px;align-items:center;}

/* Translate grid */
.translate-grid{display:grid;grid-template-columns:1fr 300px;gap:20px;}
.col-main{display:flex;flex-direction:column;gap:16px;}
.col-side{display:flex;flex-direction:column;gap:14px;}

/* Dropzone */
.dropzone{
  border:1.5px dashed var(--c-border2);border-radius:var(--r);
  padding:40px 28px;text-align:center;cursor:pointer;
  background:rgba(255,255,255,.015);transition:all .2s;
}
.dropzone:hover,.drag-over{border-color:var(--c-cyan);background:rgba(0,229,255,.04);}
.has-file{border-color:var(--c-green);background:rgba(0,255,157,.03);}
.dropzone-icon{font-size:36px;margin-bottom:10px;}
.dropzone-filename{color:var(--c-green);font-weight:600;font-family:var(--font-mono);font-size:13px;}
.dropzone-meta{color:var(--c-dim);font-size:12px;margin-top:4px;}
.dropzone-main{color:var(--c-text);font-weight:500;}
.dropzone-sub{color:var(--c-dim);font-size:12px;margin-top:4px;}

/* Controls */
.controls-row{display:flex;gap:12px;align-items:flex-end;}
.field{display:flex;flex-direction:column;gap:5px;flex:1;}
.field-action{padding-bottom:0;}
.field-label{font-size:10px;color:var(--c-dim);font-family:var(--font-mono);letter-spacing:.8px;text-transform:uppercase;}

/* Cards */
.card{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r);padding:18px;}
.card-title{font-size:12px;font-family:var(--font-mono);color:var(--c-dim);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;}
.card-desc{color:var(--c-dim);font-size:13px;margin-bottom:16px;line-height:1.6;}

/* Progress */
.progress-wrap{display:flex;flex-direction:column;gap:8px;}
.progress-header{display:flex;justify-content:space-between;}
.progress-label{font-size:13px;color:var(--c-text);}
.progress-pct{font-family:var(--font-mono);font-weight:600;color:var(--c-cyan);font-size:13px;}
.progress-track{background:rgba(255,255,255,.06);border-radius:999px;height:6px;overflow:hidden;}
.progress-fill{height:100%;background:linear-gradient(90deg,var(--c-cyan),var(--c-purple));border-radius:999px;transition:width .5s ease;}
.progress-sub{font-size:11px;color:var(--c-dim);font-family:var(--font-mono);}

/* Stats */
.stats-row{display:flex;gap:10px;flex-wrap:wrap;}
.stats-col{display:flex;flex-direction:column;gap:8px;}
.stat-line{display:flex;justify-content:space-between;font-size:13px;color:var(--c-dim);}
.stat-val{font-family:var(--font-mono);font-weight:600;}
.stat-val.cyan{color:var(--c-cyan);}
.stat-val.green{color:var(--c-green);}
.stat-val.yellow{color:var(--c-yellow);}

.chip{
  background:rgba(255,255,255,.04);border:1px solid var(--c-border);border-radius:6px;
  padding:4px 10px;display:flex;gap:6px;align-items:center;
}
.chip-label{font-size:11px;color:var(--c-dim);}
.chip-value{font-size:12px;font-family:var(--font-mono);font-weight:600;}

/* Download banner */
.download-banner{
  display:flex;align-items:center;gap:14px;padding:16px 20px;
  background:rgba(0,255,157,.06);border:1px solid rgba(0,255,157,.25);
  border-radius:var(--r);text-decoration:none;color:var(--c-green);
  transition:background .2s;
}
.download-banner:hover{background:rgba(0,255,157,.1);}
.dl-title{font-weight:600;font-size:14px;}
.dl-meta{font-family:var(--font-mono);font-size:11px;color:rgba(0,255,157,.6);margin-top:2px;}
.dl-arrow{margin-left:auto;font-size:20px;}

/* Test result */
.test-result{margin-top:12px;padding:12px;background:rgba(0,0,0,.3);border-radius:6px;border-left:3px solid var(--c-cyan);}
.test-translated{color:var(--c-cyan);font-size:13px;font-weight:500;line-height:1.5;word-break:break-word;}
.test-source{font-size:11px;color:var(--c-dim);font-family:var(--font-mono);margin-top:6px;}

/* Hint */
.hint-box{background:rgba(255,208,64,.04);border:1px solid rgba(255,208,64,.15);border-radius:var(--r);padding:14px;}
.hint-title{font-size:12px;font-family:var(--font-mono);color:var(--c-yellow);margin-bottom:6px;}
.hint-text{font-size:12px;color:var(--c-dim);line-height:1.6;}
.hint-text strong{color:var(--c-text);}

/* Buttons */
.solid-btn{
  display:inline-flex;align-items:center;gap:7px;
  background:var(--acc,var(--c-cyan));color:#000;
  border:none;border-radius:var(--r);padding:9px 18px;
  font-weight:700;font-size:13px;cursor:pointer;
  font-family:var(--font-body);transition:opacity .15s;white-space:nowrap;
}
.solid-btn:disabled{opacity:.4;cursor:default;}
.solid-btn:hover:not(:disabled){opacity:.85;}

.ghost-btn{
  display:inline-flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.1);
  border-radius:var(--r);padding:8px 14px;
  color:var(--acc,var(--c-dim));font-size:13px;cursor:pointer;
  font-family:var(--font-body);transition:all .15s;white-space:nowrap;
}
.ghost-btn:hover:not(:disabled){background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);}
.ghost-btn:disabled{opacity:.4;cursor:default;}

/* Form inputs */
.input,.select,.textarea{
  background:var(--c-bg);border:1px solid var(--c-border);border-radius:var(--r);
  padding:8px 12px;color:var(--c-text);font-size:13px;width:100%;
}
.input:focus,.select:focus,.textarea:focus{border-color:var(--c-border2);}
.select{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%234a5270' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;}
.select-sm{width:auto;}
.textarea{resize:vertical;font-family:var(--font-mono);font-size:12px;}

/* Tabs / Pills */
.tabs{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap;}
.pill{
  background:rgba(255,255,255,.04);border:1px solid var(--c-border);
  border-radius:999px;padding:5px 14px;font-size:12.5px;cursor:pointer;
  color:var(--c-dim);font-family:var(--font-body);transition:all .15s;
  display:inline-flex;align-items:center;gap:5px;
}
.pill:hover{border-color:var(--c-border2);color:var(--c-text);}
.pill-active{background:rgba(0,229,255,.1);border-color:var(--c-cyan);color:var(--c-cyan)!important;}

/* Forms */
.inline-form{background:rgba(176,96,255,.07);border:1px solid rgba(176,96,255,.2);border-radius:var(--r);padding:18px;margin-bottom:16px;}
.inline-form-title{font-size:13px;font-weight:600;color:#c090ff;margin-bottom:14px;}
.form-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}
.form-grid-2{display:grid;grid-template-columns:auto auto;gap:12px;}
.form-actions{display:flex;gap:10px;margin-top:14px;}

/* Search */
.search-row{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.search-wrap{flex:1;position:relative;display:flex;align-items:center;gap:0;}
.search-wrap svg{position:absolute;left:12px;color:var(--c-dim);}
.search-input{width:100%;padding:8px 36px;background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r);color:var(--c-text);font-size:13px;}
.search-input:focus{border-color:var(--c-border2);}
.search-clear{position:absolute;right:10px;background:none;border:none;cursor:pointer;color:var(--c-dim);display:flex;padding:2px;}
.result-count{font-size:12px;color:var(--c-dim);font-family:var(--font-mono);white-space:nowrap;}

/* Table */
.table-wrap{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r);overflow:hidden;margin-bottom:14px;}
.table{width:100%;border-collapse:collapse;}
.table thead tr{background:#0a0c14;}
.table th{padding:10px 14px;text-align:left;font-size:10.5px;font-family:var(--font-mono);color:var(--c-dim);text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid var(--c-border);font-weight:500;}
.table-row{border-bottom:1px solid rgba(28,32,48,.6);}
.table-row:hover{background:rgba(255,255,255,.015);}
.table td{padding:9px 14px;vertical-align:middle;}
.table-empty{padding:40px;text-align:center;color:var(--c-dim);}
.cell-en{color:var(--c-text);font-size:13px;}
.cell-zh{color:var(--c-yellow);font-size:13px;}
.cell-vi{color:#60e090;font-size:13px;font-weight:500;}
.cell-missing{color:var(--c-dim);font-style:italic;font-size:12px;}
.empty-cell{color:var(--c-border2);}

.src-badge{
  font-size:10px;font-family:var(--font-mono);
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
  color:var(--sc,var(--c-dim));border-radius:4px;padding:2px 8px;
}

.cell-input{
  width:100%;background:var(--c-bg);border:1px solid var(--c-border2);
  border-radius:5px;padding:5px 8px;color:var(--c-text);font-size:12px;
  font-family:var(--font-mono);
}
.cell-input-vi{border-color:rgba(0,255,157,.3);}

.row-actions{display:flex;gap:5px;}
.act-btn{
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
  border-radius:5px;padding:4px 7px;cursor:pointer;display:flex;align-items:center;
  transition:all .12s;
}
.act-edit:hover{background:rgba(176,96,255,.15);border-color:rgba(176,96,255,.3);color:var(--c-purple);}
.act-ok:hover{background:rgba(0,255,157,.15);border-color:rgba(0,255,157,.3);color:var(--c-green);}
.act-no:hover,.act-del:hover{background:rgba(255,64,96,.15);border-color:rgba(255,64,96,.3);color:var(--c-red);}

/* Upload row */
.upload-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
.file-name{font-family:var(--font-mono);font-size:12px;color:var(--c-text);background:rgba(255,255,255,.04);padding:6px 10px;border-radius:5px;}

/* Pagination */
.pagination{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:12px;}
.pag-btn{background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r);padding:6px 16px;color:var(--c-dim);cursor:pointer;font-size:13px;transition:all .12s;}
.pag-btn:hover:not(:disabled){border-color:var(--c-border2);color:var(--c-text);}
.pag-btn:disabled{opacity:.3;cursor:default;}
.pag-info{font-size:12px;color:var(--c-dim);font-family:var(--font-mono);padding:0 8px;}

/* History */
.history-list{display:flex;flex-direction:column;gap:8px;}
.history-item{
  background:var(--c-surface);border:1px solid var(--c-border);border-radius:var(--r);
  padding:14px 16px;display:flex;gap:14px;align-items:flex-start;
}
.hist-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;}
.hist-body{flex:1;min-width:0;}
.hist-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.hist-badge{
  font-size:11px;font-family:var(--font-mono);
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
  color:var(--hc,var(--c-dim));border-radius:4px;padding:2px 9px;flex-shrink:0;
}
.hist-file{color:var(--c-text);font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.hist-lang{font-size:10px;font-family:var(--font-mono);color:var(--c-dim);background:rgba(255,255,255,.04);padding:2px 6px;border-radius:4px;}
.hist-details{font-size:12px;color:var(--c-dim);font-family:var(--font-mono);margin-top:5px;}
.hist-dl{
  display:inline-flex;align-items:center;gap:5px;font-size:11px;font-family:var(--font-mono);
  color:var(--c-cyan);text-decoration:none;margin-top:5px;
}
.hist-dl:hover{text-decoration:underline;}
.hist-time{font-size:11px;color:var(--c-dim);font-family:var(--font-mono);flex-shrink:0;white-space:nowrap;}
.empty-state{text-align:center;padding:60px;color:var(--c-dim);}

/* Logs */
.log-terminal{
  flex:1;background:#050608;border:1px solid var(--c-border);border-radius:var(--r);
  overflow-y:auto;font-family:var(--font-mono);font-size:11.5px;padding:8px 0;
  margin-top:4px;
}
.log-empty{text-align:center;padding:40px;color:var(--c-border2);}
.log-line{display:flex;gap:14px;padding:4px 16px;border-bottom:1px solid rgba(28,32,48,.4);}
.log-line:hover{background:rgba(255,255,255,.015);}
.log-time{color:var(--c-border2);flex-shrink:0;}
.log-level{flex-shrink:0;font-weight:600;}
.log-msg{word-break:break-all;line-height:1.5;}

/* Toast */
.toast{
  padding:11px 18px;border-radius:8px;font-size:13px;font-family:var(--font-mono);
  font-weight:500;max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,.5);
  animation:slideIn .25s ease;pointer-events:all;
}
.toast-info{background:#131929;border-left:3px solid var(--c-cyan);color:var(--c-text);}
.toast-success{background:#0a1a12;border-left:3px solid var(--c-green);color:var(--c-green);}
.toast-error{background:#1a080c;border-left:3px solid var(--c-red);color:#ff8090;}
@keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}

/* Spin */
.spin{display:inline-block;animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
`;
