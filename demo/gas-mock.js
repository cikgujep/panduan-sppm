/* SPPM DEMO: Emulator Google Apps Script dalam pelayar.
 * Sheet disimpan dalam memori + localStorage. code.js asal dijalankan tanpa ubah suai.
 */
(function () {
  const STORE_KEY = window.__SPPM_SEED ? 'SPPM_DEMO_DB_v5_real' : 'SPPM_DEMO_DB_v5';
  const DEMO_DB_ID = 'DEMO_CLIENT_DB';

  // ---------- RNG deterministik ----------
  let seed = 20261108;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  let seed3 = 55005;
  function rnd3() { seed3 = (seed3 * 1664525 + 1013904223) % 4294967296; return seed3 / 4294967296; }
  function gauss3() { let u = 0, v = 0; while (u === 0) u = rnd3(); while (v === 0) v = rnd3(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const SPM_PROXY = { 'A+': 95, 'A': 85, 'A-': 75, 'B+': 68, 'B': 63, 'C+': 58, 'C': 53, 'D': 48, 'E': 43, 'G': 20 };
  let seed2 = 33003;
  function rnd2() { seed2 = (seed2 * 1664525 + 1013904223) % 4294967296; return seed2 / 4294967296; }
  function gauss2() { let u = 0, v = 0; while (u === 0) u = rnd2(); while (v === 0) v = rnd2(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }

  // ---------- Data contoh ----------
  const GRED = [
    ['G1', 'A+', 90, 100, 'CEMERLANG', 0], ['G2', 'A', 80, 89, 'CEMERLANG', 1], ['G3', 'A-', 70, 79, 'CEMERLANG', 2],
    ['G4', 'B+', 65, 69, 'KEPUJIAN', 3], ['G5', 'B', 60, 64, 'KEPUJIAN', 4], ['G6', 'C+', 55, 59, 'BAIK', 5],
    ['G7', 'C', 50, 54, 'BAIK', 6], ['G8', 'D', 45, 49, 'LULUS', 7], ['G9', 'E', 40, 44, 'LULUS', 8], ['G10', 'G', 0, 39, 'GAGAL', 9]
  ];
  function gradeOf(m) { for (const g of GRED) if (m >= g[2] && m <= g[3]) return g[1]; return 'G'; }

  function buildSeed() {
    const SUBJ = [
      ['S1', 'Bahasa Melayu', 'BM', 'WAJIB', 0], ['S2', 'Bahasa Inggeris', 'BI', 'WAJIB', -4],
      ['S3', 'Pendidikan Islam', 'PI', 'WAJIB', 6], ['S4', 'Pendidikan Moral', 'PM', 'WAJIB', 4],
      ['S5', 'Sejarah', 'SEJ', 'WAJIB', 1], ['S6', 'Matematik', 'MT', 'WAJIB', -6],
      ['S7', 'Matematik Tambahan', 'MTT', 'ELEKTIF', -12], ['S8', 'Fizik', 'FIZ', 'ELEKTIF', -8],
      ['S9', 'Kimia', 'KIM', 'ELEKTIF', -7], ['S10', 'Biologi', 'BIO', 'ELEKTIF', -3],
      ['S11', 'Prinsip Perakaunan', 'PP', 'ELEKTIF', -2], ['S12', 'Ekonomi', 'EKO', 'ELEKTIF', 0]
    ];
    const KELAS = [['5 AMANAH', 12, 'SAINS'], ['5 BESTARI', 5, 'SAINS'], ['5 CEMERLANG', -3, 'SASTERA'], ['5 DEDIKASI', -10, 'SASTERA']];
    const NAMA_L = ['AHMAD', 'MUHAMMAD', 'AIMAN', 'HAZIQ', 'IRFAN', 'DANIAL', 'FARIS', 'HAKIM', 'ARIF', 'ZUL', 'RAJ', 'KUMAR', 'WEI JIE', 'JUN HAO', 'SYAFIQ', 'AQIL'];
    const NAMA_P = ['NUR AISYAH', 'SITI NURHALIZA', 'ALYA', 'BALQIS', 'DAMIA', 'HANA', 'IZZATI', 'SOFEA', 'PRIYA', 'MEI LING', 'XIN YI', 'ZARA', 'AMNI', 'QISTINA', 'AINA', 'NADIA'];
    const BIN = ['ABDULLAH', 'ISMAIL', 'RAHMAN', 'HASSAN', 'OTHMAN', 'YUSOF', 'IBRAHIM', 'ZAKARIA', 'KAMAL', 'SULAIMAN'];

    const murid = [['NO_KP', 'NAMA', 'KELAS', 'SUBJEK_DIAMBIL', 'GAYA_BELAJAR', 'JANTINA', 'SES']];
    const markah = [['ID', 'NO_KP', 'KOD_SUBJEK', 'KOD_EXAM', 'MARKAH', 'GRED']];
    const subjMap = Object.fromEntries(SUBJ.map(s => [s[2], s]));
    let n = 0, mid = 0;

    KELAS.forEach(([kelas, off, aliran]) => {
      for (let i = 0; i < 28; i++) {
        n++;
        const jantina = rnd() < 0.5 ? 'L' : 'P';
        const nama = jantina === 'L' ? `${pick(NAMA_L)} BIN ${pick(BIN)}` : `${pick(NAMA_P)} BINTI ${pick(BIN)}`;
        const kp = '0' + String(80000000000 + n * 7919).slice(0, 11);
        const r = rnd();
        const sesBand = r < 0.09 ? 2 : (r < 0.30 ? 1 : 0); // SESR = SES Rendah, SESSR = SES Selain Rendah
        const ses = sesBand > 0 ? 'SESR' : 'SESSR';
        const vak = pick(['V', 'V', 'A', 'R', 'K', 'K']);
        const agama = rnd() < 0.82 ? 'PI' : 'PM';
        const elektif = aliran === 'SAINS' ? ['MTT', 'FIZ', 'KIM', 'BIO'] : ['PP', 'EKO'];
        const subs = ['BM', 'BI', agama, 'SEJ', 'MT'].concat(elektif);
        murid.push([kp, nama, kelas, subs.join(','), vak, jantina, ses]);

        const ability = 58 + off + gauss() * 13 + (jantina === 'P' ? 2.5 : -1) + (sesBand === 2 ? -8 : sesBand === 1 ? -4 : 0);
        const growth = 2 + gauss() * 4 + (vak === 'K' ? -1 : 0);
        subs.forEach(code => {
          const base = ability + subjMap[code][4] + gauss() * 7;
          const tov = clamp(base);
          const ar1 = clamp(base + growth + gauss() * 5);
          const ar2 = clamp(base + growth * 2.2 + gauss() * 5);
          const etr = clamp(tov + 8 + rnd() * 8);
          const rows = [['TOV', tov], ['AR1', ar1], ['AR2', ar2], ['ETR', etr]];
          rows.forEach(([ex, m]) => {
            if (ex !== 'ETR' && ex !== 'TOV' && rnd() < 0.012) { markah.push(['M' + (++mid), kp, code, ex, '', 'TH']); return; }
            markah.push(['M' + (++mid), kp, code, ex, m, gradeOf(m)]);
          });
          // AR3 (Percubaan) guna aliran rawak BERASINGAN supaya markah TOV/AR1/AR2/ETR sedia ada tidak berubah
          const ar3 = clamp(base + growth * 3.2 + gauss2() * 5);
          if (rnd2() < 0.012) markah.push(['M' + (++mid), kp, code, 'AR3', '', 'TH']);
          else markah.push(['M' + (++mid), kp, code, 'AR3', ar3, gradeOf(ar3)]);
          // SPM: gred huruf sahaja + markah proksi (sama seperti sistem sebenar). Aliran rawak ketiga.
          const spmG = gradeOf(clamp(base + growth * 3.8 + 2 + gauss3() * 6));
          markah.push(['M' + (++mid), kp, code, 'SPM', SPM_PROXY[spmG], spmG]);
        });
      }
    });

    return {
      sheets: {
        DB_SETUP: [['KEY', 'VALUE'], ['SCHOOL_NAME', 'SMK DEMO BESTARI'], ['THEME_COLOR', '#4f46e5'], ['SCHOOL_LOGO', ''],
          ['KOHORT', '2026'], ['PEPERIKSAAN', 'SPM'], ['ADMIN_PASS', 'admin123'], ['KOD_SEKOLAH', 'DEMO001']],
        DB_MURID: murid,
        DB_SUBJEK: [['ID_SUBJEK', 'NAMA', 'SINGKATAN', 'KATEGORI']].concat(SUBJ.map(s => s.slice(0, 4))),
        DB_EXAM: [['ID_EXAM', 'NAMA_EXAM', 'SINGKATAN'], ['E1', 'Take Off Value', 'TOV'], ['E2', 'PAT Tingkatan 4 (AR1)', 'AR1'],
          ['E3', 'PPT Tingkatan 5 (AR2)', 'AR2'], ['E5', 'Peperiksaan Percubaan (AR3)', 'AR3'], ['E4', 'Expected Target Result', 'ETR'], ['E6', 'Sijil Pelajaran Malaysia', 'SPM']],
        DB_MARKAH: markah,
        DB_GRED: [['ID_GRED', 'GRED', 'MIN', 'MAX', 'STATUS', 'NILAI']].concat(GRED),
        DB_GAMBAR: [['KP', 'BASE64']]
      }
    };
  }

  // ---------- Storage ----------
  function load() {
    try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch (e) { }
    const d = window.__SPPM_SEED ? JSON.parse(JSON.stringify(window.__SPPM_SEED)) : buildSeed(); save(d); return d;
  }
  function save(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) { console.warn('Demo: gagal simpan', e); } }
  let DB = load();
  window.__SPPM_DEMO_RESET = function () { try { localStorage.removeItem(STORE_KEY); } catch (e) { } location.reload(); };

  // ---------- Sheet emulator ----------
  function cellIn(v) {
    if (typeof v === 'string' && v.charAt(0) === "'") return v.slice(1);
    if (v === null || v === undefined) return '';
    return v;
  }
  class Range {
    constructor(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.s._get(this.r + i, this.c + j)); out.push(row); } return out; }
    getValue() { return this.s._get(this.r, this.c); }
    setValues(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.s._set(this.r + i, this.c + j, v[i][j]); return this; }
    setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.s._set(this.r + i, this.c + j, v); return this; }
    clearContent() { this.setValue(''); return this; }
  }
  class Sheet {
    constructor(name, store) { this.name = name; this.store = store; }
    get rows() { return this.store[this.name]; }
    _get(r, c) { const row = this.rows[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
    _set(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = cellIn(v); }
    getName() { return this.name; }
    getLastRow() { let n = this.rows.length; while (n > 0 && this.rows[n - 1].every(x => x === '' || x === null)) n--; return n; }
    getLastColumn() { let m = 0; this.rows.forEach(r => { let k = r.length; while (k > 0 && (r[k - 1] === '' || r[k - 1] === null)) k--; m = Math.max(m, k); }); return m; }
    getDataRange() { const lr = Math.max(1, this.getLastRow()), lc = Math.max(1, this.getLastColumn()); return new Range(this, 1, 1, lr, lc); }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
    appendRow(arr) { const at = this.getLastRow(); this.rows.length = at; this.rows.push(arr.map(cellIn)); return this; }
    deleteRow(i) { this.rows.splice(i - 1, 1); return this; }
    clearContents() { this.store[this.name] = []; return this; }
    clear() { return this.clearContents(); }
  }
  class Spreadsheet {
    constructor(store) { this.store = store; }
    getSheetByName(n) { return Object.prototype.hasOwnProperty.call(this.store, n) ? new Sheet(n, this.store) : null; }
    insertSheet(n) { if (!this.store[n]) this.store[n] = []; return new Sheet(n, this.store); }
    getSheets() { return Object.keys(this.store).map(n => new Sheet(n, this.store)); }
    getId() { return DEMO_DB_ID; }
  }
  function masterStore() { const st = DB.sheets.DB_SETUP || []; const get = k => { const r = st.find(x => String(x[0]).toUpperCase() === k); return r ? r[1] : ''; }; return { DATA_SEKOLAH: [['KOD_SEKOLAH', 'NAMA_SEKOLAH'], [get('KOD_SEKOLAH') || 'DEMO001', get('SCHOOL_NAME') || 'SMK DEMO']] }; }

  window.SpreadsheetApp = {
    getActiveSpreadsheet: () => new Spreadsheet(DB.sheets),
    openById: (id) => id === DEMO_DB_ID ? new Spreadsheet(DB.sheets) : new Spreadsheet(masterStore())
  };
  window.LockService = { getScriptLock: () => ({ waitLock() { }, tryLock() { return true; }, releaseLock() { } }) };
  window.Utilities = {
    getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); }),
    base64Decode: (b64) => { const bin = atob(String(b64).split(',').pop()); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; },
    newBlob: (bytes) => ({ getDataAsString: () => new TextDecoder('utf-8').decode(bytes instanceof Uint8Array ? bytes : new TextEncoder().encode(String(bytes))) }),
    parseCsv: (text, delim) => {
      delim = delim || ','; const out = []; let row = [], cur = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
        else if (ch === '"') q = true; else if (ch === delim) { row.push(cur); cur = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
        else cur += ch;
      }
      if (cur !== '' || row.length) { row.push(cur); out.push(row); }
      return out;
    }
  };
  window.HtmlService = { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createTemplateFromFile() { throw new Error('Tidak disokong dalam demo'); }, createHtmlOutputFromFile() { throw new Error('Tidak disokong dalam demo'); } };

  // ---------- google.script.run ----------
  const EXTRA = {
    getAppUrl: () => new URL('dashboard.html', location.href).href
  };
  function makeRunner(ok, fail, user) {
    return new Proxy({}, {
      get(_, name) {
        if (name === 'withSuccessHandler') return fn => makeRunner(fn, fail, user);
        if (name === 'withFailureHandler') return fn => makeRunner(ok, fn, user);
        if (name === 'withUserObject') return u => makeRunner(ok, fail, u);
        return function (...args) {
          setTimeout(() => {
            const S = window.__GAS_SERVER || {};
            const fn = EXTRA[name] || S[name];
            if (!fn) { const e = new Error('Fungsi server tidak wujud: ' + name); if (fail) fail(e, user); else console.error(e); return; }
            try {
              S.setClientDb && S.setClientDb(DEMO_DB_ID);
              const cloned = JSON.parse(JSON.stringify(args));
              let res = fn.apply(null, cloned);
              save(DB);
              res = res === undefined ? undefined : JSON.parse(JSON.stringify(res));
              if (ok) ok(res, user);
            } catch (e) { console.error('[DEMO server]', name, e); if (fail) fail(e, user); }
          }, 120);
        };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = { run: makeRunner(null, null, null), host: { close() { }, setHeight() { } }, url: { getLocation(cb) { cb({ parameter: Object.fromEntries(new URLSearchParams(location.search)) }); } } };

  // ---------- Lencana DEMO ----------
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:99999;background:#111827;color:#fff;font:600 12px/1.2 system-ui,sans-serif;padding:8px 10px;border-radius:10px;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;gap:8px;align-items:center;opacity:.9';
    b.innerHTML = '<span>MOD DEMO · data rekaan</span><button style="background:#ef4444;color:#fff;border:0;border-radius:6px;padding:4px 8px;font:inherit;cursor:pointer">Reset</button>';
    b.querySelector('button').onclick = () => { if (confirm('Reset semua data demo kepada data asal?')) window.__SPPM_DEMO_RESET(); };
    document.body.appendChild(b);
  });
})();
