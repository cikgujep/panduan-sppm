/* code.js asal, dibungkus supaya tidak bertembung dengan fungsi client */
window.__GAS_SERVER=(function(){
/**
 * MASTER LIBRARY: SISTEM HEADCOUNT v16.28
 * Author: Appscript Expert
 * Note: Kod ini mengawal logik. Ia tidak tahu Database mana nak buka
 * sehingga Client App memberitahu ID Database.
 */

// --- 1. GLOBAL VARIABLES & DB CONNECTION ---
var CLIENT_DB_ID = ""; // Akan diisi oleh Client App
const SPM_PROXY_MARK_MAP = {
  "A+": 95,
  "A": 85,
  "A-": 75,
  "B+": 68,
  "B": 63,
  "C+": 58,
  "C": 53,
  "D": 48,
  "E": 43,
  "G": 20,
  "TH": 0
};

function setClientDb(id) {
  CLIENT_DB_ID = id;
}

function getDB() {
  if (CLIENT_DB_ID) {
    try {
      return SpreadsheetApp.openById(CLIENT_DB_ID);
    } catch (e) {
      // Fallback to active spreadsheet if openById fails
    }
  }
  try {
    const activeSS = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSS) return activeSS;
  } catch (e) {
    // getActiveSpreadsheet failed
  }
  throw new Error("CRITICAL: Database ID tidak ditemui. Sila semak sambungan Client App.");
}

/**
 * PENGESAHAN MARKAH (sama seperti parseMark di frontend).
 * Pulangkan { status, value }:
 *   'empty'   : kosong / '-'
 *   'th'      : TH / T (tidak hadir)
 *   'ok'      : nombor sah 0-100
 *   'invalid' : selain itu (cth "35abc", "AB", 150). JANGAN disimpan sebagai 0.
 */
function parseMarkValue(raw) {
  if (raw === undefined || raw === null) return { status: 'empty', value: null };
  if (typeof raw === 'number') {
    return (isFinite(raw) && raw >= 0 && raw <= 100) ? { status: 'ok', value: raw } : { status: 'invalid', value: null };
  }
  const str = String(raw).trim().replace(/^'+/, '');
  if (str === '' || str === '-') return { status: 'empty', value: null };
  const up = str.toUpperCase();
  if (up === 'TH' || up === 'T') return { status: 'th', value: null };
  const num = Number(str.replace(',', '.'));
  if (!isFinite(num) || num < 0 || num > 100) return { status: 'invalid', value: null };
  return { status: 'ok', value: num };
}

function normalizeGrade(grade) {
  return String(grade || "").trim().toUpperCase();
}

function getSpmProxyMark(grade) {
  const normalized = normalizeGrade(grade);
  return Object.prototype.hasOwnProperty.call(SPM_PROXY_MARK_MAP, normalized)
    ? SPM_PROXY_MARK_MAP[normalized]
    : 0;
}

function getFinalExamCodeBackend(ss) {
  if (!ss) ss = getDB();
  const sh = ss.getSheetByName("DB_EXAM");
  if (!sh) return 'SPM';
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const code = String(data[i][2] || "").trim().toUpperCase();
    if (code !== 'TOV' && code !== 'ETR' && !code.startsWith('AR')) {
      return data[i][2];
    }
  }
  return 'SPM';
}

function isSpmCohortBackend(ss) {
  if (!ss) ss = getDB();
  const sh = ss.getSheetByName("DB_GRED");
  if (!sh) return true;
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const gr = String(data[i][1] || '').trim().toUpperCase();
    if (gr === 'A+' || gr === 'A-' || gr === 'B+' || gr === 'C+') {
      return true;
    }
  }
  return false;
}
const SETUP_KEYS = ["SCHOOL_NAME", "THEME_COLOR", "SCHOOL_LOGO", "KOHORT", "PEPERIKSAAN", "ADMIN_PASS", "KOD_SEKOLAH"];

function normalizeSetupKey(value) {
  return String(value || "").trim().toUpperCase();
}

function parseSetupSheetRows(rows) {
  const setupObj = {
    SCHOOL_NAME: "",
    THEME_COLOR: "",
    SCHOOL_LOGO: "",
    KOHORT: "",
    PEPERIKSAAN: "",
    ADMIN_PASS: "admin123",
    KOD_SEKOLAH: ""
  };

  if (!rows || rows.length === 0) return setupObj;

  // 1) Format sasaran: A:B (KEY / VALUE), baris 2-5.
  for (let i = 1; i < rows.length; i++) {
    const key = normalizeSetupKey(rows[i][0]);
    if (!SETUP_KEYS.includes(key)) continue;
    const value = rows[i][1];
    if (value !== "" && value !== null && value !== undefined) {
      setupObj[key] = value;
    }
  }

  // 2) Sokong format legacy mendatar: header di row 1, nilai di row 2.
  const header = (rows[0] || []).map(normalizeSetupKey);
  const valueRow = rows[1] || [];
  SETUP_KEYS.forEach(key => {
    if (setupObj[key] !== "") return;
    const idx = header.indexOf(key);
    if (idx === -1) return;
    const value = valueRow[idx];
    if (value !== "" && value !== null && value !== undefined) {
      setupObj[key] = value;
    }
  });

  // 3) Fallback lama: row 2 simpan terus [name, color, logo, kohort, peperiksaan].
  const row2 = rows[1] || [];
  const row2First = normalizeSetupKey(row2[0]);
  const looksLikeHorizontalValues = row2.length >= 3 && !SETUP_KEYS.includes(row2First);
  if (looksLikeHorizontalValues) {
    if (!setupObj.SCHOOL_NAME && row2[0] !== undefined && row2[0] !== null) setupObj.SCHOOL_NAME = row2[0];
    if (!setupObj.THEME_COLOR && row2[1] !== undefined && row2[1] !== null) setupObj.THEME_COLOR = row2[1];
    if (!setupObj.SCHOOL_LOGO && row2[2] !== undefined && row2[2] !== null) setupObj.SCHOOL_LOGO = row2[2];
    if (!setupObj.KOHORT && row2[3] !== undefined && row2[3] !== null) setupObj.KOHORT = row2[3];
    if (!setupObj.PEPERIKSAAN && row2[4] !== undefined && row2[4] !== null) setupObj.PEPERIKSAAN = row2[4];
  }

  return setupObj;
}

// --- FUNGSI PENGESAHAN SEKOLAH (MASTER LIBRARY) ---
// PERHATIAN: Memandangkan ini Library, 'getActiveSpreadsheet' akan merujuk
// kepada fail Client. Oleh itu, ID Master perlu diletak secara spesifik di sini.
const MASTER_SS_ID = "ID_MASTER_DEMO"; // <-- SILA TUKAR ID INI

function validateSchoolCode(code) {
  try {
    if (MASTER_SS_ID === "MASUKKAN_ID_MASTER_DI_SINI" || !MASTER_SS_ID) {
      return { valid: false, msg: "Ralat: Sila konfigurasikan MASTER_SS_ID di dalam Library code.gs" };
    }

    const masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    if (!masterSS) return { valid: false, msg: "Ralat: Gagal mengakses Master Spreadsheet." };

    const sh = masterSS.getSheetByName("DATA_SEKOLAH");
    if (!sh) return { valid: false, msg: "Ralat: Sheet 'DATA_SEKOLAH' tiada dalam Master." };

    const data = sh.getDataRange().getValues();
    const normalizedCode = String(code || "").trim().toUpperCase();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === normalizedCode) {
        return { valid: true, schoolName: data[i][1], kodSekolah: normalizedCode };
      }
    }
    return { valid: false, msg: "Kod sekolah tidak berdaftar." };
  } catch (e) {
    return { valid: false, msg: "Ralat Master: " + e.message };
  }
}

const MURID_COL_LEGACY = {
  NO_KP: 0,
  NAMA: 1,
  KELAS: 2,
  SUBJEK_DIAMBIL: 3,
  GAYA_BELAJAR: 4,
  JANTINA: 5,
  SES: 6
};

const MURID_HEADER_ALIASES = {
  NO_KP: ["NO_KP", "NOKP", "NO KP", "KP"],
  NAMA: ["NAMA", "NAMA_MURID"],
  KELAS: ["KELAS"],
  SUBJEK_DIAMBIL: ["SUBJEK_DIAMBIL", "SUBJEK", "MATA_PELAJARAN"],
  GAYA_BELAJAR: ["GAYA_BELAJAR", "VARK", "VAK"],
  JANTINA: ["JANTINA"],
  SES: ["SES"]
};

function normalizeMuridHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getMuridRowValue(row, index) {
  if (!Array.isArray(row) || index < 0 || index >= row.length) return "";
  return row[index];
}

function normalizeNoKp(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/^'+/, "") // Buang single quote di depan (untuk Google Sheets)
    .trim();
}

function isSameNoKp(left, right) {
  const a = normalizeNoKp(left);
  const b = normalizeNoKp(right);
  return a !== "" && a === b;
}

function normalizeGenderToken(value) {
  const token = String(value || "").trim().toUpperCase();
  if (token === "L" || token.indexOf("LELAKI") === 0) return "L";
  if (token === "P" || token.indexOf("PEREMPUAN") === 0) return "P";
  return "";
}

function normalizeSESToken(value) {
  const token = String(value || "").trim().toUpperCase();
  if (token === "SESR" || token === "SESSR") return token;
  return "";
}

function buildMuridColumnMap(rows) {
  const header = rows && rows.length > 0 ? (rows[0] || []).map(normalizeMuridHeader) : [];
  const map = {};

  Object.keys(MURID_COL_LEGACY).forEach(key => {
    map[key] = MURID_COL_LEGACY[key];
    const aliases = MURID_HEADER_ALIASES[key] || [];
    for (let i = 0; i < aliases.length; i++) {
      const idx = header.indexOf(normalizeMuridHeader(aliases[i]));
      if (idx !== -1) {
        map[key] = idx;
        break;
      }
    }
  });

  return map;
}

function getMuridSheetContext(ss) {
  const sh = ss.getSheetByName("DB_MURID");
  if (!sh) throw new Error("Sheet DB_MURID tidak ditemui.");
  const rows = sh.getDataRange().getValues();
  const colMap = buildMuridColumnMap(rows);
  return { sh, rows, colMap };
}

function createMuridAppendRow(student, colMap) {
  const maxIndex = Math.max.apply(null, Object.keys(colMap).map(k => colMap[k]));
  const row = new Array(maxIndex + 1).fill("");

  row[colMap.NO_KP] = "'" + normalizeNoKp(student && student.noKp);
  row[colMap.NAMA] = String((student && student.nama) || "").toUpperCase();
  row[colMap.KELAS] = String((student && student.kelas) || "").toUpperCase();
  row[colMap.SUBJEK_DIAMBIL] = "";
  row[colMap.GAYA_BELAJAR] = "";
  row[colMap.JANTINA] = normalizeGenderToken(student && student.jantina);
  row[colMap.SES] = normalizeSESToken(student && student.ses);

  return row;
}

// --- 2. ROUTING (PANGGILAN HTML) ---
function doGetLibrary(e) {
  const page = e.parameter.page;
  // Pastikan nama fail HTML Tuan adalah 'Index' dan 'Dashboard' (Case sensitive)
  const templateName = (page === 'dashboard') ? 'Dashboard' : 'Index';

  return HtmlService.createTemplateFromFile(templateName)
    .evaluate()
    .setTitle('SPPM™ 2.0 ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- 3. DATA RETRIEVAL (GET) ---

function getInitialData() {
  try {
    const ss = getDB();

    // Helper untuk baca sheet jadi Array of Objects
    const getData = (name) => {
      const s = ss.getSheetByName(name);
      return s ? s.getDataRange().getValues() : [];
    };

    const dbMurid = getData("DB_MURID");
    const dbSubjek = getData("DB_SUBJEK");
    const dbExam = getData("DB_EXAM");
    const dbMarkah = getData("DB_MARKAH");
    const dbGred = getData("DB_GRED");
    const dbSetup = getData("DB_SETUP"); // New Sheet for Logo/Color
    const muridColMap = buildMuridColumnMap(dbMurid);

    // Auto-clean DB_SUBJEK jika ada trailing space / lowercase
    let subjekNeedsFix = false;
    const subjek = dbSubjek.slice(1).map(r => {
      const rawCode = String(r[2] || "");
      const cleanCode = rawCode.trim().toUpperCase();
      if (rawCode !== cleanCode && rawCode !== "") {
        subjekNeedsFix = true;
      }
      return {
        ID_SUBJEK: String(r[0] || "").trim(),
        NAMA: String(r[1] || "").trim(),
        SINGKATAN: cleanCode,
        KATEGORI: String(r[3] || "").trim()
      };
    }).filter(s => s.SINGKATAN);

    if (subjekNeedsFix) {
      try {
        const shSub = ss.getSheetByName("DB_SUBJEK");
        if (shSub && dbSubjek.length > 1) {
          const cleanCodes = dbSubjek.slice(1).map(r => [String(r[2] || "").trim().toUpperCase()]);
          shSub.getRange(2, 3, cleanCodes.length, 1).setValues(cleanCodes);
        }
      } catch (e) {
        console.warn("Auto-clean DB_SUBJEK:", e);
      }
    }

    // Mapping Data Murid (Normalisasikan SUBJEK_DIAMBIL agar konsisten tanpa whitespace)
    const murid = dbMurid.slice(1).map(r => {
      const rawSubjek = String(getMuridRowValue(r, muridColMap.SUBJEK_DIAMBIL) || "");
      const cleanSubjek = rawSubjek
        .split(',')
        .map(s => String(s || "").trim().toUpperCase())
        .filter(Boolean)
        .join(',');

      return {
        NO_KP: normalizeNoKp(getMuridRowValue(r, muridColMap.NO_KP)),
        NAMA: String(getMuridRowValue(r, muridColMap.NAMA) || "").trim(),
        KELAS: String(getMuridRowValue(r, muridColMap.KELAS) || "").trim(),
        SUBJEK_DIAMBIL: cleanSubjek,
        GAYA_BELAJAR: getMuridRowValue(r, muridColMap.GAYA_BELAJAR),
        JANTINA: normalizeGenderToken(getMuridRowValue(r, muridColMap.JANTINA)),
        SES: normalizeSESToken(getMuridRowValue(r, muridColMap.SES))
      };
    });

    const exam = dbExam.slice(1).map(r => ({
      ID_EXAM: r[0], NAMA_EXAM: r[1], SINGKATAN: String(r[2] || "").trim().toUpperCase()
    }));

    const markah = dbMarkah.slice(1).map(r => ({
      NO_KP: normalizeNoKp(r[1]),
      KOD_SUBJEK: String(r[2] || "").trim().toUpperCase(),
      KOD_EXAM: String(r[3] || "").trim().toUpperCase(),
      MARKAH: r[4],
      GRED: r[5]
    }));

    // Kod BARU (Pastikan ada r[5] atau indeks column nilai tuan)
    const gredList = dbGred.slice(1).map(r => ({
      ID_GRED: r[0],
      GRED: r[1],
      MIN: r[2],
      MAX: r[3],
      STATUS: r[4],
      NILAI: r[5] // <--- PASTIKAN INI DITAMBAH (Anggap column F ialah Nilai)
    }));

    // Setup System (Logo/Color/Kohort)
    const setupObj = parseSetupSheetRows(dbSetup);

    // Semak pengesahan sekolah
    let schoolCodeValid = false;
    if (setupObj.KOD_SEKOLAH) {
      const check = validateSchoolCode(setupObj.KOD_SEKOLAH);
      if (check.valid) {
        schoolCodeValid = true;
        setupObj.SCHOOL_NAME = check.schoolName; // Perbaharui nama dari master sentiasa
      }
    }

    const result = { murid, subjek, exam, markah, gredList, kelas: [...new Set(murid.map(m => m.KELAS))].sort(), setup: setupObj, schoolCodeValid: schoolCodeValid };
    return sanitizeForJson(result);
  } catch (err) {
    console.error("Ralat getInitialData:", err);
    return { error: err.toString() };
  }
}

function getDashboardData() {
  return getInitialData(); // Dashboard guna struktur data sama
}

// --- 4. DATA SAVING (POST) ---

// Save Murid (termasuk Jantina)
function saveStudent(s) {
  const ss = getDB();
  const ctx = getMuridSheetContext(ss);
  // Format dinamik ikut header DB_MURID
  ctx.sh.appendRow(createMuridAppendRow(s, ctx.colMap));
  return getInitialData();
}

// Save Murid Secara Pukal (Batch / Bulk)
function saveStudentsBatch(studentsList) {
  const ss = getDB();
  const ctx = getMuridSheetContext(ss);

  // Sediakan container databaris
  const dataRows = [];

  studentsList.forEach(s => {
    dataRows.push(createMuridAppendRow(s, ctx.colMap));
  });

  if (dataRows.length > 0) {
    // Ambil baris terakhir yang ada data
    const lastRow = ctx.sh.getLastRow();

    // Tulis ke helaian secara pukal menggunakan setValues() (Jauh Lebih Laju)
    ctx.sh.getRange(lastRow + 1, 1, dataRows.length, dataRows[0].length).setValues(dataRows);
  }

  return getInitialData();
}

// Save Gred
function saveGred(d) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_GRED");
  const id = d.id || Utilities.getUuid();
  sh.appendRow([id, d.gred, d.min, d.max, d.status]);
  return getInitialData();
}

// Save Subjek
function saveSubjects(arr) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_SUBJEK");
  arr.forEach(s => {
    const cleanNama = String(s.nama || "").trim();
    const cleanSingkatan = String(s.singkatan || "").trim().toUpperCase();
    const cleanKategori = String(s.kategori || "").trim();
    if (cleanSingkatan) {
      sh.appendRow([Utilities.getUuid(), cleanNama, cleanSingkatan, cleanKategori]);
    }
  });
  return getInitialData();
}

// Save Exam (Supports Create & Update)
function saveExams(arr) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_EXAM");
  if (!sh) throw new Error("Sheet DB_EXAM tidak ditemui.");
  
  const data = sh.getDataRange().getValues();
  
  arr.forEach(e => {
    const cleanId = String(e.id || "").trim();
    const cleanName = String(e.nama || "").trim();
    const cleanCode = String(e.singkatan || "").trim().toUpperCase();
    
    if (!cleanCode) throw new Error("Singkatan peperiksaan tidak boleh kosong.");
    if (!cleanName) throw new Error("Nama peperiksaan tidak boleh kosong.");
    
    if (cleanId) {
      // Update existing exam
      updateExamLogic(ss, sh, data, cleanId, cleanName, cleanCode);
    } else {
      // Create new exam
      // Check duplication for new code
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][2]).trim().toUpperCase() === cleanCode) {
          throw new Error(`Singkatan '${cleanCode}' telah digunakan oleh peperiksaan lain.`);
        }
      }
      sh.appendRow([Utilities.getUuid(), cleanName, cleanCode]);
    }
  });
  
  return getInitialData();
}

function updateExamLogic(ss, sh, data, id, newName, newCode) {
  const cleanName = String(newName || "").trim();
  const cleanCode = String(newCode || "").trim().toUpperCase();

  let oldCode = "";
  let targetRowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0]);
    const rowCode = String(data[i][2]).trim().toUpperCase();

    // Check duplication of exam code across other rows
    if (rowId !== String(id) && rowCode === cleanCode) {
      throw new Error(`Singkatan '${cleanCode}' telah digunakan oleh peperiksaan lain.`);
    }

    if (rowId === String(id)) {
      oldCode = String(data[i][2]).trim();
      targetRowIndex = i + 1;
    }
  }

  if (targetRowIndex === -1) throw new Error("Peperiksaan tidak ditemui.");

  const oldCodeUpper = oldCode.toUpperCase();
  // Protected system codes (TOV, ETR) cannot have their code changed
  if ((oldCodeUpper === 'TOV' || oldCodeUpper === 'ETR') && oldCodeUpper !== cleanCode) {
    throw new Error(`Singkatan untuk peperiksaan sistem (${oldCode}) tidak boleh diubah.`);
  }

  // Update in DB_EXAM
  sh.getRange(targetRowIndex, 2).setValue(cleanName);
  sh.getRange(targetRowIndex, 3).setValue(cleanCode);

  // Cascade update to DB_MARKAH if code is changed
  if (oldCodeUpper !== cleanCode) {
    const markSh = ss.getSheetByName("DB_MARKAH");
    if (markSh) {
      const markData = markSh.getDataRange().getValues();
      if (markData.length > 1) {
        for (let i = 1; i < markData.length; i++) {
          if (String(markData[i][3]).trim().toUpperCase() === oldCodeUpper) {
            markSh.getRange(i + 1, 4).setValue(cleanCode);
          }
        }
      }
    }
  }
}

// Save Markah (Batch)
function saveBulkMarks(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Tunggu maks 30 saat
    const ss = getDB();
    const finalCode = getFinalExamCodeBackend(ss).trim().toUpperCase();
    const isSpmCohort = isSpmCohortBackend(ss);
    const sh = ss.getSheetByName("DB_MARKAH");

    // Teknik pantas: Baca semua data dulu untuk elak duplicate
    const existing = sh.getDataRange().getValues();
    const map = new Map();

    // Buat index key: KP_SUBJEK_EXAM
    for (let i = 1; i < existing.length; i++) {
      const kp = normalizeNoKp(existing[i][1]);
      const key = `${kp}_${existing[i][2]}_${existing[i][3]}`;
      map.set(key, i + 1); // Simpan row number
    }

    const ditolak = [];
    data.forEach(d => {
      const kp = normalizeNoKp(d.noKp);
      const key = `${kp}_${d.subjek}_${d.exam}`;
      const examCode = String(d.exam || "").trim().toUpperCase();
      const isSpm = (examCode === finalCode) && isSpmCohort;
      let gred = isSpm ? normalizeGrade(d.gred) : d.gred;
      let markah = isSpm ? (gred ? getSpmProxyMark(gred) : "") : d.markah;

      // Sahkan markah bukan-SPM: nombor 0-100, TH, atau kosong. Nilai lain ditolak (tidak disimpan).
      if (!isSpm) {
        const pm = parseMarkValue(d.markah);
        if (pm.status === 'invalid') { ditolak.push(`${kp} ${d.subjek} ${d.exam}: "${d.markah}"`); return; }
        if (pm.status === 'th') { markah = 'TH'; gred = 'TH'; }
        else if (pm.status === 'ok') { markah = pm.value; }
        else { markah = ''; }
      }

      if (map.has(key)) {
        // Update (kosongkan cell jika markah/gred dipadam)
        const row = map.get(key);
        sh.getRange(row, 5).setValue(markah);
        sh.getRange(row, 6).setValue(gred);
      } else {
        // Insert hanya jika ada isi markah/gred
        const hasValue = (markah !== "" && markah !== null && markah !== undefined) || (gred !== "" && gred !== null && gred !== undefined);
        if (hasValue) {
          sh.appendRow([Utilities.getUuid(), "'" + d.noKp, d.subjek, d.exam, markah, gred]);
        }
      }
    });

    if (ditolak.length) {
      return `Data disimpan, tetapi ${ditolak.length} markah tidak sah ditolak (mesti nombor 0-100 atau TH): ` + ditolak.slice(0, 5).join('; ') + (ditolak.length > 5 ? ' ...' : '');
    }
    return "Data berjaya disimpan!";
  } catch (e) {
    return "Ralat Simpan: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// Save Mapping Subjek (Checkbox)
function saveMapping(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getDB();
    const ctx = getMuridSheetContext(ss);
    const droppedSet = new Set();
    const updates = new Map(); // KP -> newSubjectsStr

    // 1. Kumpul semua dikemaskini oleh client
    data.forEach(d => {
      const kp = normalizeNoKp(d.noKp);
      if (kp) {
        const cleanSubs = String(d.subjects || "")
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
          .join(',');
        updates.set(kp, cleanSubs);
      }
    });

    if (updates.size === 0) return "Tiada perubahan dikesan.";

    const nextMuridValues = [];
    const subCol = ctx.colMap.SUBJEK_DIAMBIL;

    // 2. Berjalan melalui semua murid untuk kemaskini subjek & cari subjek digugurkan
    for (let i = 1; i < ctx.rows.length; i++) {
      const kp = normalizeNoKp(getMuridRowValue(ctx.rows[i], ctx.colMap.NO_KP));
      let currentSubjectsStr = String(getMuridRowValue(ctx.rows[i], subCol) || "");

      if (updates.has(kp)) {
        const newSubjectsStr = updates.get(kp);
        const oldSubjects = currentSubjectsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const newSubjects = newSubjectsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

        // Kenalpasti subjek yang digugurkan (ada dalam asal, tiada dalam baru)
        oldSubjects.forEach(s => {
          if (!newSubjects.includes(s)) {
            droppedSet.add(`${kp}|${s}`);
          }
        });
        currentSubjectsStr = newSubjects.join(',');
      }
      nextMuridValues.push([currentSubjectsStr]);
    }

    // 3. Simpan perubahan subjek ke DB_MURID secara pukal
    if (nextMuridValues.length > 0) {
      ctx.sh.getRange(2, subCol + 1, nextMuridValues.length, 1).setValues(nextMuridValues);
    }

    // 4. Padam markah bagi subjek-subjek yang digugurkan
    if (droppedSet.size > 0) {
      const markahSheet = ss.getSheetByName("DB_MARKAH");
      if (markahSheet) {
        const markData = markahSheet.getDataRange().getValues();
        if (markData.length > 1) {
          const headers = markData[0];
          const newMarkData = [headers];
          let hasDeleted = false;

          for (let j = 1; j < markData.length; j++) {
            const row = markData[j];
            const mKp = normalizeNoKp(row[1]);
            const mSub = String(row[2]).trim().toUpperCase();

            if (droppedSet.has(`${mKp}|${mSub}`)) {
              hasDeleted = true;
            } else {
              newMarkData.push(row);
            }
          }

          if (hasDeleted) {
            markahSheet.clearContents();
            // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur B / indeks 1) sebelum setValues
            for (let i = 1; i < newMarkData.length; i++) {
              newMarkData[i][1] = "'" + normalizeNoKp(newMarkData[i][1]);
            }
            markahSheet.getRange(1, 1, newMarkData.length, headers.length).setValues(newMarkData);
          }
        }
      }
    }
    return "Mapping mata pelajaran dikemaskini. Markah subjek yang digugurkan telah dikosongkan secara automatik.";
  } catch (e) {
    return "Ralat: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}


// Save VAK
function saveStudentVAK(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getDB();
    const ctx = getMuridSheetContext(ss);
    const list = Array.isArray(data) ? data : [data];

    list.forEach(item => {
      for (let i = 1; i < ctx.rows.length; i++) {
        if (isSameNoKp(getMuridRowValue(ctx.rows[i], ctx.colMap.NO_KP), item.kp)) {
          ctx.sh.getRange(i + 1, ctx.colMap.GAYA_BELAJAR + 1).setValue(item.vak);
          break;
        }
      }
    });
    return "Data VAK disimpan.";
  } catch (e) {
    return "Ralat: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// Save SES
function saveStudentSES(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getDB();
    const ctx = getMuridSheetContext(ss);
    const list = Array.isArray(data) ? data : [data];
    if (!ctx.rows || ctx.rows.length <= 1) return "Data SES disimpan.";

    const sesUpdates = new Map();
    list.forEach(item => {
      const kp = normalizeNoKp(item && item.kp);
      if (!kp) return;
      sesUpdates.set(kp, normalizeSESToken(item && item.ses));
    });

    if (sesUpdates.size > 0) {
      const sesCol = ctx.colMap.SES;
      const nextValues = [];

      for (let i = 1; i < ctx.rows.length; i++) {
        const kp = normalizeNoKp(getMuridRowValue(ctx.rows[i], ctx.colMap.NO_KP));
        let sesVal = normalizeSESToken(getMuridRowValue(ctx.rows[i], sesCol));
        if (sesUpdates.has(kp)) sesVal = sesUpdates.get(kp);
        nextValues.push([sesVal]);
      }
      ctx.sh.getRange(2, sesCol + 1, nextValues.length, 1).setValues(nextValues);
    }
    return "Data SES disimpan.";
  } catch (e) {
    return "Ralat: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// Save System Setup (Logo, Color & Kohort)
function saveSystemSetup(form) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getDB();
    let sh = ss.getSheetByName("DB_SETUP");
    if (!sh) sh = ss.insertSheet("DB_SETUP");

    const lastRow = Math.max(sh.getLastRow(), 1);
    const lastCol = Math.max(sh.getLastColumn(), 2);
    const currentRows = sh.getRange(1, 1, lastRow, lastCol).getValues();
    const existing = parseSetupSheetRows(currentRows);

    const pickValue = (incoming, fallback) => {
      if (incoming === undefined || incoming === null) return fallback || "";
      const asString = String(incoming);
      return asString.trim() === "" ? (fallback || "") : asString;
    };

    // Validasi KOD SEKOLAH BARU jika ada
    let finalKodSekolah = existing.KOD_SEKOLAH;
    let finalSchoolName = existing.SCHOOL_NAME;

    if (form && form.kodSekolah) {
      const check = validateSchoolCode(form.kodSekolah);
      if (check.valid) {
        finalKodSekolah = check.kodSekolah;
        finalSchoolName = check.schoolName; // Paksa guna nama dari master
      } else {
        return "RALAT_KOD_SEKOLAH:" + check.msg;
      }
    }

    const finalSetup = {
      SCHOOL_NAME: pickValue(finalSchoolName, existing.SCHOOL_NAME),
      THEME_COLOR: pickValue(form && form.color, existing.THEME_COLOR),
      SCHOOL_LOGO: pickValue(form && form.logo, existing.SCHOOL_LOGO),
      KOHORT: pickValue(form && form.kohort, existing.KOHORT),
      PEPERIKSAAN: pickValue(form && form.peperiksaan, existing.PEPERIKSAAN),
      ADMIN_PASS: pickValue(form && form.adminPass, existing.ADMIN_PASS),
      KOD_SEKOLAH: finalKodSekolah
    };

    // Canonical format (A1:B7): KEY | VALUE
    sh.getRange(1, 1, Math.max(lastRow, 7), Math.max(lastCol, 2)).clearContent();
    sh.getRange(1, 1, 1, 2).setValues([["KEY", "VALUE"]]);
    sh.getRange(2, 1, 7, 2).setValues([
      ["SCHOOL_NAME", finalSetup.SCHOOL_NAME],
      ["THEME_COLOR", finalSetup.THEME_COLOR],
      ["SCHOOL_LOGO", finalSetup.SCHOOL_LOGO],
      ["KOHORT", finalSetup.KOHORT],
      ["PEPERIKSAAN", finalSetup.PEPERIKSAAN],
      ["ADMIN_PASS", finalSetup.ADMIN_PASS],
      ["KOD_SEKOLAH", finalSetup.KOD_SEKOLAH]
    ]);

    return "Tetapan sistem berjaya disimpan.";
  } catch (e) {
    return "Ralat: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

// --- 5. DELETE FUNCTIONS ---

function deleteStudent(kp) {
  if (typeof kp === 'string' && kp.startsWith("CMD_DEL_CLASS:")) {
    const className = kp.replace("CMD_DEL_CLASS:", "");
    return deleteClass(className);
  }

  const ss = getDB();

  // 1. Padam di DB_MURID
  const muridSheet = ss.getSheetByName("DB_MURID");
  if (muridSheet) {
    const data = muridSheet.getDataRange().getValues();
    const headers = data[0];
    const colMap = buildMuridColumnMap(data);
    const newData = [headers];
    for (let i = 1; i < data.length; i++) {
      if (!isSameNoKp(getMuridRowValue(data[i], colMap.NO_KP), kp)) {
        newData.push(data[i]);
      }
    }
    if (newData.length < data.length) {
      muridSheet.clearContents();
      // PENGUKUHAN: Paksa format teks (') bagi lajur NO_KP sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][colMap.NO_KP] = "'" + normalizeNoKp(newData[i][colMap.NO_KP]);
      }
      muridSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }

  // 2. Padam di DB_MARKAH
  const markahSheet = ss.getSheetByName("DB_MARKAH");
  if (markahSheet) {
    const data = markahSheet.getDataRange().getValues();
    const headers = data[0];
    const newData = [headers];
    for (let i = 1; i < data.length; i++) {
      if (!isSameNoKp(data[i][1], kp)) {
        newData.push(data[i]);
      }
    }
    if (newData.length < data.length) {
      markahSheet.clearContents();
      // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur B / indeks 1) sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][1] = "'" + normalizeNoKp(newData[i][1]);
      }
      markahSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }

  return getInitialData();
}

function deleteClass(className) {
  const ss = getDB();
  const targetClass = String(className).trim().toUpperCase();
  const studentsToDelete = new Set();

  // 1. Padam di DB_MURID & Kumpul KP murid yang terlibat
  const muridSheet = ss.getSheetByName("DB_MURID");
  if (muridSheet) {
    const data = muridSheet.getDataRange().getValues();
    const headers = data[0];
    const colMap = buildMuridColumnMap(data);
    const newData = [headers];
    for (let i = 1; i < data.length; i++) {
      const sClass = String(getMuridRowValue(data[i], colMap.KELAS)).trim().toUpperCase();
      if (sClass === targetClass) {
        studentsToDelete.add(normalizeNoKp(getMuridRowValue(data[i], colMap.NO_KP)));
      } else {
        newData.push(data[i]);
      }
    }
    if (newData.length < data.length) {
      muridSheet.clearContents();
      // PENGUKUHAN: Paksa format teks (') bagi lajur NO_KP sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][colMap.NO_KP] = "'" + normalizeNoKp(newData[i][colMap.NO_KP]);
      }
      muridSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }

  if (studentsToDelete.size === 0) return getInitialData();

  // 2. Padam di DB_MARKAH (Batch)
  const markahSheet = ss.getSheetByName("DB_MARKAH");
  if (markahSheet) {
    const data = markahSheet.getDataRange().getValues();
    const headers = data[0];
    const newData = [headers];
    for (let i = 1; i < data.length; i++) {
      if (!studentsToDelete.has(normalizeNoKp(data[i][1]))) {
        newData.push(data[i]);
      }
    }
    if (newData.length < data.length) {
      markahSheet.clearContents();
      // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur B / indeks 1) sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][1] = "'" + normalizeNoKp(newData[i][1]);
      }
      markahSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }

  // 3. Padam di DB_GAMBAR (Batch)
  const imgSheet = ss.getSheetByName("DB_GAMBAR");
  if (imgSheet) {
    const data = imgSheet.getDataRange().getValues();
    const headers = data[0];
    const newData = [headers];
    for (let i = 1; i < data.length; i++) {
      if (!studentsToDelete.has(normalizeNoKp(data[i][0]))) {
        newData.push(data[i]);
      }
    }
    if (newData.length < data.length) {
      imgSheet.clearContents();
      // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur A / indeks 0) sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][0] = "'" + normalizeNoKp(newData[i][0]);
      }
      imgSheet.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
  }

  return getInitialData();
}


function deleteSubject(id) {
  const ss = getDB();
  deleteRowByCol(ss, "DB_SUBJEK", 0, id);
  return getInitialData();
}

function deleteExam(id) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_EXAM");
  if (sh) {
    const finalCode = getFinalExamCodeBackend(ss).trim().toUpperCase();
    const data = sh.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const singkatan = String(data[i][2]).trim().toUpperCase();
        if (singkatan === 'TOV' || singkatan === 'ETR' || singkatan === finalCode) {
          throw new Error("Peperiksaan wajib (TOV, ETR dan " + finalCode + ") tidak boleh dipadam.");
        }
      }
    }
  }
  deleteRowByCol(ss, "DB_EXAM", 0, id);
  return getInitialData();
}

function updateExam(id, newName, newCode) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_EXAM");
  if (!sh) throw new Error("Sheet DB_EXAM tidak ditemui.");
  const data = sh.getDataRange().getValues();
  updateExamLogic(ss, sh, data, id, newName, newCode);
  return getInitialData();
}

function deleteExamMarks(examCode) {
  const ss = getDB();
  const sh = ss.getSheetByName("DB_MARKAH");
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return "Tiada data markah ditemui.";

  const headers = data[0];
  const newData = [headers];
  let deletedCount = 0;

  // Lajur 3 adalah index untuk EXAM_KOD berdasarkan logik DB
  // "ID", "NO_KP", "SUBJEK_KOD", "EXAM_KOD", "MARKAH", "GRED"
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[3]).trim().toUpperCase() === String(examCode).trim().toUpperCase()) {
      deletedCount++;
    } else {
      newData.push(row);
    }
  }

  if (deletedCount > 0) {
    // Kosongkan dan tulis semula
    sh.clearContents();
    if (newData.length > 0) {
      // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur B / indeks 1) sebelum setValues
      for (let i = 1; i < newData.length; i++) {
        newData[i][1] = "'" + normalizeNoKp(newData[i][1]);
      }
      sh.getRange(1, 1, newData.length, headers.length).setValues(newData);
    }
    return `Berjaya memadam ${deletedCount} rekod markah peperiksaan ${examCode}.`;
  } else {
    return `Tiada markah peperiksaan ${examCode} ditemui.`;
  }
}

function deleteGred(id) {
  const ss = getDB();
  deleteRowByCol(ss, "DB_GRED", 0, id);
  return getInitialData();
}

// Helper Delete
function deleteRowByCol(ss, sheetName, colIndex, val) {
  const sh = ss.getSheetByName(sheetName);
  const data = sh.getDataRange().getValues();
  // Delete from bottom to avoid index shift
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIndex]) == String(val)) {
      sh.deleteRow(i + 1);
    }
  }
}

// --- 6. IMPORT CSV PROCESSING ---
// --- IMPORT CSV PROCESSING (FIXED) ---
// --- IMPORT CSV PROCESSING (TURBO BATCH MODE) ---
function processExamImport(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = getDB();
    const sh = ss.getSheetByName("DB_MARKAH");

    // 1. BACA SEMUA DATA SEDIA ADA KE MEMORI (PANTAS)
    const range = sh.getDataRange();
    let dbValues = range.getValues(); // Array 2D gergasi

    // Indexing untuk carian pantas: KP_SUBJEK_EXAM -> Row Index
    const mapIndex = new Map();
    for (let i = 1; i < dbValues.length; i++) {
      // Kunci Unik: KP_SUBJEK_EXAM
      const kp = normalizeNoKp(dbValues[i][1]);
      const key = `${kp}_${dbValues[i][2]}_${dbValues[i][3]}`;
      mapIndex.set(key, i); // Simpan nombor baris array
    }

    // 1b. BACA DB_MURID UNTUK FILTER TINGKATAN (Penting)
    const muridSheet = ss.getSheetByName("DB_MURID");
    const muridData = muridSheet.getDataRange().getValues();
    const muridColMap = buildMuridColumnMap(muridData);
    const validMuridMap = new Map();

    for (let i = 1; i < muridData.length; i++) {
      const raw_kp = muridData[i][muridColMap.NO_KP];
      const kp = normalizeNoKp(raw_kp);
      const kelas = String(muridData[i][muridColMap.KELAS]).toUpperCase().trim();
      const currentSubjects = String(muridData[i][muridColMap.SUBJEK_DIAMBIL] || "");
      const subjectSet = new Set(currentSubjects.split(',').map(s => s.trim().toUpperCase()).filter(Boolean));

      if (kp) validMuridMap.set(kp, { kelas: kelas, rowIdx: i, subjects: subjectSet, updated: false });
    }

    // 2. PROSES FAIL CSV
    const decoded = Utilities.base64Decode(payload.file);
    let csvString = Utilities.newBlob(decoded).getDataAsString('UTF-8');

    // Bersihkan BOM & Newline
    if (csvString.charCodeAt(0) === 0xFEFF) csvString = csvString.slice(1);
    csvString = csvString.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    if (!csvString) return { status: 'error', msg: 'Fail kosong' };

    // Auto-Detect Delimiter
    const firstLine = csvString.split('\n')[0];
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';

    const rows = Utilities.parseCsv(csvString, delimiter);
    if (rows.length < 2) return { status: 'error', msg: 'Tiada data dalam CSV' };

    const csvHeader = rows[0].map(h => h.trim().toUpperCase());
    const kpIdx = csvHeader.indexOf(payload.kpHeader.toUpperCase());

    if (kpIdx === -1) return { status: 'error', msg: 'Header KP tidak dijumpai' };

    let countNew = 0;
    let countUpdate = 0;
    let countInvalid = 0;
    const invalidSamples = [];
    const examCode = payload.examCode;
    const finalExamCode = getFinalExamCodeBackend(ss);

    // 3. GELUNG DATA (DALAM MEMORI SAHAJA)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < kpIdx + 1) continue;

      const kp = normalizeNoKp(row[kpIdx]); // Gunakan normalisasi konsisten
      if (!kp) continue;

      // Auto-Filter: Hanya terima markah jika KP wujud dalam DB_MURID
      const muridInfo = validMuridMap.get(kp);
      if (!muridInfo) continue;

      // Loop setiap subjek yang dipadankan
      for (const [csvColName, subCode] of Object.entries(payload.mapping)) {
        const colIdx = csvHeader.indexOf(csvColName.toUpperCase());

        if (colIdx > -1 && colIdx < row.length) {
          let val = row[colIdx];

          // Pastikan ada nilai (walaupun 0, asalkan bukan kosong string)
          if (val !== "" && val !== null && val !== undefined) {

            let markah = val;
            let gred = "";

            // Logic Data (disahkan DULU, sebelum apa-apa ditulis)
            if (examCode === finalExamCode) {
              gred = normalizeGrade(val);
              markah = getSpmProxyMark(gred);
            } else {
              const normVal = String(val).trim().toUpperCase();
              const pm = parseMarkValue(val); // terima juga perpuluhan koma (format Eropah)
              if (normVal === '-' || pm.status === 'th') {
                markah = 'TH';
                gred = 'TH';
              } else if (pm.status === 'ok') {
                markah = pm.value;
              } else if (pm.status === 'invalid') {
                // Sebelum ini nilai tidak sah disimpan sebagai 0 (jatuh ke G-Risk Kritikal).
                // Kini dilangkau dan dilaporkan.
                countInvalid++;
                if (invalidSamples.length < 5) invalidSamples.push(`${kp} ${subCode}: "${val}"`);
                continue;
              } else {
                continue; // kosong
              }
            }

            // --- DAFTAR MATA PELAJARAN AUTOMATIK (hanya untuk nilai sah) ---
            const cleanSubCode = String(subCode || "").trim().toUpperCase();
            if (!muridInfo.subjects.has(cleanSubCode)) {
              muridInfo.subjects.add(cleanSubCode);
              muridInfo.updated = true;
            }

            const uniqueKey = `${kp}_${subCode}_${examCode}`;

            if (mapIndex.has(uniqueKey)) {
              // UPDATE DATA SEDIA ADA
              const rowIdx = mapIndex.get(uniqueKey);
              // Col 4 = Markah (Index 4), Col 5 = Gred (Index 5) dalam Array (0-based)
              // DB_MARKAH structure: [ID, KP, KOD_SUB, KOD_EXAM, MARKAH, GRED]
              dbValues[rowIdx][4] = markah;
              dbValues[rowIdx][5] = gred;
              countUpdate++;
            } else {
              // MASUKKAN DATA BARU (PUSH KE ARRAY)
              const newRow = [
                Utilities.getUuid(), // ID Unik Baru
                "'" + kp,            // KP (String)
                subCode,             // Subjek
                examCode,            // Exam
                markah,              // Markah
                gred                 // Gred
              ];
              dbValues.push(newRow);
              // Update map supaya tak duplicate jika ada 2 rekod sama dalam CSV
              mapIndex.set(uniqueKey, dbValues.length - 1);
              countNew++;
            }
          }
        }
      }
    }

    // 4. SIMPAN SEKALI GUS (BATCH WRITE) - INI RAHSIA LAJU
    // Padam semua lama, tulis semua baru (Overwrite)
    // Ini jauh lebih laju dari appendRow satu-satu
    if (countNew > 0 || countUpdate > 0) {
      // PENGUKUHAN: Paksa format teks (') bagi lajur KP (lajur B / indeks 1) sebelum setValues
      for (let i = 1; i < dbValues.length; i++) {
        dbValues[i][1] = "'" + normalizeNoKp(dbValues[i][1]);
      }
      sh.getRange(1, 1, dbValues.length, dbValues[0].length).setValues(dbValues);
    }

    // 5. KEMASKINI SUBJEK MURID (JIKA ADA PERUBAHAN)
    let countMuridUpdate = 0;
    validMuridMap.forEach((info, kpKey) => {
      if (info.updated) {
        const newSubjectsStr = Array.from(info.subjects).join(',');
        muridData[info.rowIdx][muridColMap.SUBJEK_DIAMBIL] = newSubjectsStr;
        countMuridUpdate++;
      }
    });

    if (countMuridUpdate > 0) {
      // PENGUKUHAN: Paksa format teks (') bagi lajur NO_KP sebelum setValues
      for (let i = 1; i < muridData.length; i++) {
        muridData[i][muridColMap.NO_KP] = "'" + normalizeNoKp(muridData[i][muridColMap.NO_KP]);
      }
      muridSheet.getRange(1, 1, muridData.length, muridData[0].length).setValues(muridData);
    }

    let successMsg = `Selesai! ${countNew} rekod baru, ${countUpdate} dikemaskini.`;
    if (countMuridUpdate > 0) {
      successMsg += ` ${countMuridUpdate} murid didaftarkan subjek baru secara automatik.`;
    }
    if (countInvalid > 0) {
      successMsg += ` ${countInvalid} nilai tidak sah dilangkau (mesti nombor 0-100 atau TH): ${invalidSamples.join('; ')}${countInvalid > invalidSamples.length ? ' ...' : ''}`;
    }

    return {
      status: 'success',
      count: countNew + countUpdate,
      msg: successMsg,
      newData: getInitialData()
    };

  } catch (e) {
    return { status: 'error', msg: "Ralat Turbo: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Tambah fungsi ini di bahagian paling bawah Code.gs Client Tuan
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==============================================
// 7. ANALISIS SUMBANGAN TERPERINCI
// ==============================================
function getStrategicContribution(searchClass, searchSubject, prevExam, currExam) {
  const ss = getDB();
  const markahRef = ss.getSheetByName("DB_MARKAH").getDataRange().getValues();
  const subjekRef = ss.getSheetByName("DB_SUBJEK").getDataRange().getValues();
  const muridRef = ss.getSheetByName("DB_MURID").getDataRange().getValues();
  const muridMap = buildMuridColumnMap(muridRef);

  // -- Ini adalah "placeholder / mock up" fungsi yang sebelum ini ada pada fail Chart/Report
  // Bergantung kepada kerumitan analisis puan/tuan (Tarik AR1 -> Tarik OTR -> Susun dsb).
  return "Fungsi Analisis getStrategicContribution telah berjaya disambung.";
}

// ==============================================
// 8. PENGURUSAN IMEJ PROFIL
// ==============================================
function uploadProfileImage(base64Data, studentKp) {
  try {
    const ss = getDB();
    let imgSheet = ss.getSheetByName("DB_GAMBAR");
    if (!imgSheet) {
      imgSheet = ss.insertSheet("DB_GAMBAR");
      imgSheet.appendRow(["KP", "BASE64"]);
    }

    // Convert base64
    const dataOnly = base64Data.split(',')[1] || base64Data;

    // Cari KP
    const data = imgSheet.getDataRange().getValues();
    let rowToUpdate = -1;
    for (let i = 1; i < data.length; i++) {
      if (isSameNoKp(data[i][0], studentKp)) {
        rowToUpdate = i + 1;
        break;
      }
    }

    if (rowToUpdate !== -1) {
      imgSheet.getRange(rowToUpdate, 2).setValue(dataOnly);
    } else {
      imgSheet.appendRow(["'" + normalizeNoKp(studentKp), dataOnly]);
    }
    return true;
  } catch (e) {
    return false;
  }
}

function getProfileImageBase64(studentKp) {
  try {
    const ss = getDB();
    const imgSheet = ss.getSheetByName("DB_GAMBAR");
    if (!imgSheet) return null;

    const data = imgSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (isSameNoKp(data[i][0], studentKp)) {
        return "data:image/jpeg;base64," + data[i][1];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * MAINTENANCE: Baiki format ID murid (NO_KP) yang hilang sifar di depan.
 * Fungsi ini akan menukar semua ID dalam DB_MURID, DB_MARKAH dan DB_GAMBAR
 * kepada format String dengan tanda petikan (') di depan.
 */
function repairStudentIds() {
  const ss = getDB();
  const sheetsToFix = ["DB_MURID", "DB_MARKAH", "DB_GAMBAR"];
  let totalFixed = 0;

  sheetsToFix.forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    const data = sh.getDataRange().getValues();
    if (data.length <= 1) return;

    // Tentukan kolum KP berdasarkan nama sheet
    let kpCol = 0;
    if (sheetName === "DB_MURID") {
      const colMap = buildMuridColumnMap(data);
      kpCol = colMap.NO_KP;
    } else if (sheetName === "DB_MARKAH") {
      kpCol = 1; // Lajur B
    } else if (sheetName === "DB_GAMBAR") {
      kpCol = 0; // Lajur A
    }

    const updates = [];
    let sheetFixed = 0;

    for (let i = 1; i < data.length; i++) {
      const rawVal = data[i][kpCol];
      // Jika ia adalah nombor, atau string yang tidak bermula dengan ' (dalam cell)
      // Nota: getValues() sudah membuang tanda ' jika ada.
      // Kita mahu pastikan ia disimpan semula dengan ' supaya Sheets anggap ia Text.
      const normalized = normalizeNoKp(rawVal);

      // Jika nilai asal berbeza dari format yang kita mahu paksa (iaitu Text)
      // Sheets API setValues() dengan "'" di depan akan memaksa format Text.
      updates.push(["'" + normalized]);
      if (String(rawVal) !== normalized) sheetFixed++;
    }

    if (updates.length > 0) {
      sh.getRange(2, kpCol + 1, updates.length, 1).setValues(updates);
      totalFixed += sheetFixed;
    }
  });

  return "Selesai! Format ID telah dikemaskini dalam " + sheetsToFix.join(", ") + ".";
}

function sanitizeForJson(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    try {
      return val.toISOString();
    } catch (e) {
      return String(val);
    }
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeForJson);
  }
  if (typeof val === 'object') {
    const res = {};
    for (const key in val) {
      if (Object.prototype.hasOwnProperty.call(val, key)) {
        res[key] = sanitizeForJson(val[key]);
      }
    }
    return res;
  }
  if (typeof val === 'function') return "";
  return val;
}

;return {setClientDb,getDB,parseMarkValue,normalizeGrade,getSpmProxyMark,getFinalExamCodeBackend,isSpmCohortBackend,normalizeSetupKey,parseSetupSheetRows,validateSchoolCode,normalizeMuridHeader,getMuridRowValue,normalizeNoKp,isSameNoKp,normalizeGenderToken,normalizeSESToken,buildMuridColumnMap,getMuridSheetContext,createMuridAppendRow,doGetLibrary,getInitialData,getDashboardData,saveStudent,saveStudentsBatch,saveGred,saveSubjects,saveExams,updateExamLogic,saveBulkMarks,saveMapping,saveStudentVAK,saveStudentSES,saveSystemSetup,deleteStudent,deleteClass,deleteSubject,deleteExam,updateExam,deleteExamMarks,deleteGred,deleteRowByCol,processExamImport,include,getStrategicContribution,uploadProfileImage,getProfileImageBase64,repairStudentIds,sanitizeForJson};})();
