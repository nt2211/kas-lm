/*************************************************************************
 *  KAS PERUMAHAN BLOK L/M — Backend (Code.gs) v5
 *  ---------------------------------------------------------------------
 *  BARU di v5
 *   1. getNotifikasi(token) — panggilan ringan khusus badge, dipakai klien
 *      setiap 30 detik supaya badge hidup di SEMUA menu, bukan hanya
 *      halaman Ringkasan.
 *   2. hitungChatBelumDibacaWarga_() — badge chat untuk sisi warga
 *      (sebelumnya selalu 0 karena bundle tidak pernah mengisinya).
 *   3. getBerandaWarga() kini mengembalikan chatBelumDibaca.
 *   4. getBundleAwal() mengisi chatUnread untuk warga.
 *
 *  SEMUA fitur v4 tetap berjalan: login Google, daftar akun, QR pembayaran,
 *  galeri, chat, pindah blok, bulan awal iuran, laporan, backup.
 *************************************************************************/

// ============================== KONSTAN =================================
const SPREADSHEET_ID = '1a6zfiuVq_aiv5qLc7HTwyM36v63GlBSnFcTThte9nTY';

const SHEET_WARGA    = 'Warga';
const SHEET_MASUK    = 'Transaksi_Masuk';
const SHEET_KELUAR   = 'Transaksi_Keluar';
const SHEET_SETTING  = 'Pengaturan';
const SHEET_AKUN     = 'Akun';
const SHEET_GALERI   = 'Galeri';
const SHEET_FOTO     = 'Galeri_Foto';
const SHEET_CHAT     = 'Chat';
const SHEET_PINDAH   = 'Pengajuan_Pindah_Blok';

const DRIVE_FOLDER_BUKTI  = 'Kas_Perumahan_Bukti';
const DRIVE_FOLDER_FOTO   = 'Kas_Perumahan_Foto';
const DRIVE_FOLDER_BACKUP = 'Kas_Perumahan_Backup';
const DRIVE_FOLDER_GALERI = 'Kas_Perumahan_Galeri';
const DRIVE_FOLDER_QR     = 'Kas_Perumahan_QR';

const HEADERS = {
  [SHEET_WARGA]:   ['ID_Warga','No_Rumah','Nama_Warga','Status_Hunian','No_HP','Tanggal_Bergabung'],
  [SHEET_MASUK]:   ['ID_Transaksi','Tanggal','No_Rumah','Nama_Warga','Jenis_Iuran','Jumlah_Bayar','Periode_Bulan','Periode_Tahun','Metode_Bayar','Status','Catatan','Proof_URL'],
  [SHEET_KELUAR]:  ['ID_Kategori','Tanggal','Kategori_Pengeluaran','Jumlah','Penanggung_Jawab','Bukti_Nota_URL','Keterangan'],
  [SHEET_SETTING]: ['Nama_Perumahan','Nominal_Kas_Bulanan','Rekening_Tujuan','Nama_Bendahara','Admin_PIN','Admin_Emails','WA_Bendahara',
                    'QR_Code_URL','Metode_Pembayaran','Instruksi_Pembayaran','Bulan_Mulai_Iuran','Tahun_Mulai_Iuran','Pengaturan_Aktif'],
  [SHEET_AKUN]:    ['ID_Akun','Email','Nama','No_Rumah','No_HP','Role','Status','Tanggal_Daftar','Last_Login','Foto',
                    'Foto_URL','Tema','Notif_Email','Notif_WA','Rumah_Diminta','Alasan_Pindah','Catatan_Admin','Last_Aktif'],
  [SHEET_GALERI]:  ['ID_Galeri','Judul_Kegiatan','Kategori','Deskripsi','Tanggal_Kegiatan','Dibuat_Oleh','Tanggal_Dibuat','Status'],
  [SHEET_FOTO]:    ['ID_Foto','ID_Galeri','Nama_File','URL_Foto','ID_File_Drive','Urutan','Tanggal_Upload','Diupload_Oleh'],
  [SHEET_CHAT]:    ['ID_Pesan','ID_Percakapan','Email_Pengirim','Nama_Pengirim','Role_Pengirim','Email_Penerima','Isi_Pesan','URL_Lampiran','Waktu_Kirim','Status_Baca'],
  [SHEET_PINDAH]:  ['ID_Pengajuan','Email_Pemohon','Nama_Pemohon','Blok_Asal','No_Rumah_Asal','Blok_Tujuan','No_Rumah_Tujuan',
                    'Alasan','Tanggal_Pengajuan','Status','Catatan_Admin','Diproses_Oleh','Tanggal_Diproses','Dokumen_URL']
};

const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const PIN_TTL_MS     = 365 * 24 * 60 * 60 * 1000;
const MAX_FOTO_BYTES = 3 * 1024 * 1024;
const MAX_BUKTI_BYTES = 8 * 1024 * 1024;
const MAX_GALERI_BYTES = 5 * 1024 * 1024;
const MIME_GAMBAR = ['image/jpeg','image/jpg','image/png','image/webp','image/heic'];
const ONLINE_WINDOW_MS = 3 * 60 * 1000;   // dianggap online bila heartbeat < 3 menit

const KATEGORI_GALERI_DEFAULT = ['Kerja bakti','Rapat warga','Pengajian','Kegiatan olahraga','Perayaan hari besar','Kegiatan sosial','Keamanan lingkungan','Kegiatan lainnya'];

// ==================== CACHE PER EKSEKUSI ================================
var _CACHE = { rows: {}, cols: {}, setting: null, akun: null };
function resetCache_() { _CACHE = { rows: {}, cols: {}, setting: null, akun: null }; }

function getSS() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function sh_(nama) {
  const sh = getSS().getSheetByName(nama);
  if (!sh) throw new Error('Sheet "' + nama + '" tidak ada. Jalankan setupDatabase() sekali dari editor.');
  return sh;
}
function colMap_(sh) {
  const key = sh.getName();
  if (_CACHE.cols[key]) return _CACHE.cols[key];
  const last = sh.getLastColumn();
  const head = last ? sh.getRange(1, 1, 1, last).getValues()[0] : [];
  const map = {};
  head.forEach(function (h, i) { if (h) map[String(h)] = i + 1; });
  _CACHE.cols[key] = map;
  return map;
}
function rows_(nama) {
  if (_CACHE.rows[nama]) return _CACHE.rows[nama];
  const sh = sh_(nama);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) { _CACHE.rows[nama] = []; return []; }
  const headers = values.shift();
  const out = values.map(function (row, idx) {
    const obj = { _row: idx + 2 };
    headers.forEach(function (h, i) { if (h) obj[h] = row[i]; });
    return obj;
  }).filter(function (o) { return o[headers[0]] !== '' && o[headers[0]] !== null; });
  _CACHE.rows[nama] = out;
  return out;
}
function appendObj_(nama, obj) {
  const sh = sh_(nama);
  const map = colMap_(sh);
  const lebar = sh.getLastColumn();
  const baris = new Array(lebar).fill('');
  Object.keys(obj).forEach(function (k) { if (map[k]) baris[map[k] - 1] = obj[k]; });
  sh.appendRow(baris);
  delete _CACHE.rows[nama];
}
function updateRow_(nama, row, obj) {
  const sh = sh_(nama);
  const map = colMap_(sh);
  const lebar = sh.getLastColumn();
  const kini = sh.getRange(row, 1, 1, lebar).getValues()[0];
  Object.keys(obj).forEach(function (k) { if (map[k]) kini[map[k] - 1] = obj[k]; });
  sh.getRange(row, 1, 1, lebar).setValues([kini]);
  delete _CACHE.rows[nama];
}
function deleteRow_(nama, row) { sh_(nama).deleteRow(row); delete _CACHE.rows[nama]; }
function cariRow_(nama, kolomId, nilai) {
  const r = rows_(nama).find(function (x) { return String(x[kolomId]) === String(nilai); });
  return r ? r._row : -1;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Sistem sedang sibuk menyimpan data lain. Coba lagi sebentar.');
  try { return fn(); }
  finally { resetCache_(); try { lock.releaseLock(); } catch (e) {} }
}

// ============================== SETUP ===================================
function setupDatabase() {
  const ss = getSS();
  const legacy = ss.getSheetByName('Sheet1');
  if (legacy && !ss.getSheetByName(SHEET_WARGA)) {
    const width = HEADERS[SHEET_WARGA].length;
    const firstRow = legacy.getLastColumn() >= width ? legacy.getRange(1, 1, 1, width).getValues()[0] : [];
    const cocok = HEADERS[SHEET_WARGA].every(function (h, i) { return firstRow[i] === h; });
    if (cocok || legacy.getLastRow() <= 1) {
      legacy.setName(SHEET_WARGA);
      if (!cocok) legacy.getRange(1, 1, 1, width).setValues([HEADERS[SHEET_WARGA]]);
    }
  }
  Object.keys(HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS[name]);
      styleHeader_(sh, HEADERS[name].length);
      return;
    }
    const kini = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    HEADERS[name].forEach(function (h) {
      if (kini.indexOf(h) === -1) {
        sh.insertColumnAfter(sh.getLastColumn());
        sh.getRange(1, sh.getLastColumn()).setValue(h);
        kini.push(h);
      }
    });
    styleHeader_(sh, sh.getLastColumn());
  });
  const setSh = ss.getSheetByName(SHEET_SETTING);
  if (setSh.getLastRow() < 2) {
    setSh.appendRow(['Perumahan Blok L/M', 150000, '1234567890 a.n. Bendahara - BCA', 'Bendahara RT',
      '123456', '', '', '', 'Transfer Bank', 'Transfer sesuai nominal, lalu unggah bukti pembayaran melalui aplikasi.',
      1, new Date().getFullYear(), false]);
  }
  const wargaSh = ss.getSheetByName(SHEET_WARGA);
  if (wargaSh.getLastRow() < 2) {
    wargaSh.appendRow([generateId('WRG'), 'L-01', 'Contoh Warga 1', 'Tetap', '6281200000001', new Date()]);
    wargaSh.appendRow([generateId('WRG'), 'M-01', 'Contoh Warga 2', 'Tetap', '6281200000002', new Date()]);
  }
  SpreadsheetApp.flush();
  resetCache_();
  return 'Database siap. Akun Google pertama yang masuk otomatis menjadi bendahara.';
}
function styleHeader_(sh, width) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, Math.max(width, 1)).setFontWeight('bold').setBackground('#111a26').setFontColor('#ffffff');
}
function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

// ============================ ROUTER doGet ==============================
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code || p.error) return handleOAuthCallback_(p);
  
  // Return simple text if accessed directly, since frontend is separated
  return ContentService.createTextOutput("Backend Kas Perumahan Aktif. Silakan akses aplikasi melalui URL frontend.");
}

// ============================ ROUTER doPost (API) =========================
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const args = payload.args || [];
    
    if (typeof this[action] !== 'function') {
      throw new Error("Fungsi tidak ditemukan: " + action);
    }
    
    // Panggil fungsi yang diminta
    const result = this[action].apply(this, args);
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      result: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: error.message || error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================== HELPER ==================================
function props_() { return PropertiesService.getScriptProperties(); }
function generateId(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + Math.floor(Math.random() * 900 + 100);
}
function fmtDate_(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function fmtTanggalPanjang_(d) {
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear();
}
function rupiah_(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); }
function rumah_(s) { return String(s == null ? '' : s).toUpperCase().trim(); }
function bool_(v) { return v === true || v === 'true' || v === 1 || v === '1' || v === 'TRUE' || v === 'Ya'; }
function normalizeHp_(hp) {
  let s = String(hp == null ? '' : hp).replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.indexOf('620') === 0) s = '62' + s.substring(3);
  else if (s.indexOf('0') === 0) s = '62' + s.substring(1);
  else if (s.indexOf('8') === 0) s = '62' + s;
  if (s.length < 9 || s.length > 15) return '';
  return s;
}
function blokDariRumah_(noRumah) {
  const r = rumah_(noRumah);
  const m = r.match(/^([A-Z]+)/);
  return m ? m[1] : '';
}

// ============================ SESI & LOGIN ==============================
function getAuthUrl() {
  const clientId = props_().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) return { ok: false, message: 'Login Google belum dikonfigurasi. Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di Script Properties.' };
  const redirect = ScriptApp.getService().getUrl();
  const state = Utilities.getUuid();
  props_().setProperty('OAUTH::' + state, JSON.stringify({ created: Date.now() }));
  const url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirect)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('openid email profile')
    + '&access_type=online&include_granted_scopes=true&prompt=select_account'
    + '&state=' + encodeURIComponent(state);
  return { ok: true, url: url, state: state };
}
function handleOAuthCallback_(p) {
  const html = function (title, body, payload) {
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{font-family:system-ui,Segoe UI,sans-serif;background:#f5f6f8;color:#111a26;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}' +
      '.box{max-width:380px;text-align:center;background:#fff;border:1px solid #e4e8ee;border-radius:20px;padding:28px}' +
      'h1{font-size:17px;margin:0 0 8px}p{font-size:14px;color:#5b6b80;line-height:1.55;margin:0}</style></head><body>' +
      '<div class="box"><h1>' + title + '</h1><p>' + body + '</p></div>' +
      '<script>try{if(window.opener){window.opener.postMessage(' + JSON.stringify(payload) + ',"*");}}catch(e){}' +
      'setTimeout(function(){try{window.close();}catch(e){}},1200);<\/script></body></html>'
    );
  };
  if (p.error) return html('Login dibatalkan', 'Izin ditolak atau jendela ditutup.', { type: 'KASLM_AUTH', ok: false });
  const stateKey = 'OAUTH::' + p.state;
  if (!p.state || !props_().getProperty(stateKey)) return html('Sesi login kedaluwarsa', 'Tautan login sudah tidak berlaku.', { type: 'KASLM_AUTH', ok: false });
  try {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post', muteHttpExceptions: true,
      payload: {
        code: p.code,
        client_id: props_().getProperty('GOOGLE_CLIENT_ID'),
        client_secret: props_().getProperty('GOOGLE_CLIENT_SECRET'),
        redirect_uri: ScriptApp.getService().getUrl(),
        grant_type: 'authorization_code'
      }
    });
    const data = JSON.parse(res.getContentText());
    if (!data.id_token) throw new Error(data.error_description || data.error || 'Token tidak diterima.');
    const claims = decodeJwtPayload_(data.id_token);
    if (!claims.email) throw new Error('Email tidak ditemukan pada akun Google.');
    const token = createSession_(String(claims.email).toLowerCase(), claims.name || '', claims.picture || '');
    props_().setProperty(stateKey, JSON.stringify({ token: token, created: Date.now() }));
    return html('Berhasil masuk', 'Anda masuk sebagai ' + claims.email + '.', { type: 'KASLM_AUTH', ok: true, token: token });
  } catch (err) {
    return html('Login gagal', String(err.message || err), { type: 'KASLM_AUTH', ok: false });
  }
}
function getGoogleClientId() {
  return props_().getProperty('GOOGLE_CLIENT_ID') || '';
}

function loginDenganGoogleToken(accessToken) {
  if (!accessToken) throw new Error('Token akses kosong.');
  const res = UrlFetchApp.fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken },
    muteHttpExceptions: true
  });
  const user = JSON.parse(res.getContentText());
  if (!user.email) throw new Error(user.error_description || user.error || 'Gagal memverifikasi akun Google.');
  const email = String(user.email).toLowerCase();
  const nama = user.name || '';
  const foto = user.picture || '';
  const token = createSession_(email, nama, foto);
  return { ok: true, token: token, email: email, nama: nama };
}

function decodeJwtPayload_(jwt) {
  const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = part + '==='.slice((part.length + 3) % 4);
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(pad)).getDataAsString());
}
function claimSession(state) {
  const key = 'OAUTH::' + state;
  const raw = props_().getProperty(key);
  if (!raw) return { ok: false };
  const obj = JSON.parse(raw);
  if (!obj.token) return { ok: false, pending: true };
  props_().deleteProperty(key);
  return { ok: true, token: obj.token };
}
function loginDenganAkunAktif() {
  const email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) throw new Error('Email akun tidak terbaca. Gunakan tombol "Masuk dengan Google".');
  return { ok: true, token: createSession_(email, '', '') };
}
function createSession_(email, nama, foto) {
  const token = Utilities.getUuid();
  props_().setProperty('SESS::' + token, JSON.stringify({ email: email, exp: Date.now() + SESSION_TTL_MS }));
  withLock_(function () { upsertAkunSaatLogin_(email, nama, foto); });
  return token;
}
function loginPin(pin) {
  const s = getSetting_();
  if (!String(s.Admin_PIN || '') || String(s.Admin_PIN) !== String(pin)) return { ok: false, message: 'PIN tidak cocok.' };
  const token = Utilities.getUuid();
  props_().setProperty('SESS::' + token, JSON.stringify({ pin: true, exp: Date.now() + PIN_TTL_MS }));
  return { ok: true, token: token };
}
function logout(token) { if (token) props_().deleteProperty('SESS::' + token); return { ok: true }; }
function getSesi_(token) {
  if (!token) return null;
  const raw = props_().getProperty('SESS::' + token);
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch (e) { return null; }
  if (!s.exp || s.exp < Date.now()) { props_().deleteProperty('SESS::' + token); return null; }
  return s;
}
function getProfil(token) {
  const s = getSesi_(token);
  if (!s) return null;
  if (s.pin) {
    return { Email: '', Nama: 'Bendahara (PIN)', Role: 'admin', Status: 'Aktif', No_Rumah: '', No_HP: '',
      Foto: '', Foto_URL: '', Avatar: '', Tema: '', Notif_Email: true, Notif_WA: true, Rumah_Diminta: '', ViaPin: true };
  }
  const a = getAkunByEmail_(s.email);
  if (!a) return null;
  if (a.Status === 'Menunggu') {
    a.Status = 'Aktif';
    try { updateRow_(SHEET_AKUN, a._row, { Status: 'Aktif' }); _CACHE.akun = null; } catch (e) {}
  }
  return {
    ID_Akun: a.ID_Akun, Email: a.Email, Nama: a.Nama, No_Rumah: a.No_Rumah, No_HP: a.No_HP,
    Role: a.Role, Status: a.Status,
    Foto: a.Foto || '', Foto_URL: a.Foto_URL || '',
    Avatar: a.Foto_URL || a.Foto || '',
    Tema: a.Tema || 'sistem',
    Notif_Email: a.Notif_Email === '' ? true : bool_(a.Notif_Email),
    Notif_WA: a.Notif_WA === '' ? true : bool_(a.Notif_WA),
    Rumah_Diminta: a.Rumah_Diminta || '',
    Tanggal_Daftar: a.Tanggal_Daftar ? fmtDate_(a.Tanggal_Daftar) : '',
    Last_Login: a.Last_Login ? fmtDate_(a.Last_Login) : '',
    ViaPin: false
  };
}
function requireLogin_(token) { const p = getProfil(token); if (!p) throw new Error('Sesi berakhir. Silakan masuk kembali.'); return p; }
function requireAktif_(token) { const p = requireLogin_(token); if (p.Status !== 'Aktif') throw new Error('Akun Anda belum disetujui bendahara.'); return p; }
function requireAdmin_(token) { const p = requireLogin_(token); if (p.Role !== 'admin' || p.Status !== 'Aktif') throw new Error('Akses ditolak. Halaman ini khusus bendahara.'); return p; }
function requireAkunSaya_(token) {
  const s = getSesi_(token);
  if (!s || s.pin) throw new Error('Halaman profil hanya untuk akun Google. Masuk dengan Google, bukan PIN.');
  const a = getAkunByEmail_(s.email);
  if (!a) throw new Error('Akun tidak ditemukan.');
  return a;
}

// =============================== BUNDEL =================================
function getBundleAwal(token, opts) {
  const o = opts || {};
  const kini = new Date();
  const bulan = Number(o.bulan) || (kini.getMonth() + 1);
  const tahun = Number(o.tahun) || kini.getFullYear();
  const profil = getProfil(token);
  const out = { ts: Date.now(), bulan: bulan, tahun: tahun, profil: profil, publik: getPengaturanPublik() };
  if (!profil || profil.Status !== 'Aktif') return out;
  const ambil = function (nama, fn) {
    try { out[nama] = fn(); } catch (e) { console.error('getBundleAwal.' + nama + ': ' + e); }
  };
  if (profil.Role === 'admin') {
    ambil('dash',       function () { return getDashboardData(token); });
    ambil('warga',      function () { return getWargaList(token); });
    ambil('trxMasuk',   function () { return getTransaksiMasuk(token); });
    ambil('trxKeluar',  function () { return getTransaksiKeluar(token); });
    ambil('status',     function () { return getStatusIuranWarga(token, bulan, tahun); });
    ambil('akun',       function () { return getDaftarAkun(token); });
    ambil('pengAdmin',  function () { return getPengaturanAdmin(token); });
    ambil('lapBulanan', function () { return getLaporanBulanan(token, bulan, tahun); });
    ambil('lapTahunan', function () { return getLaporanTahunan(token, tahun); });
    ambil('galeri',     function () { return getGaleriList(token, null); });
    ambil('pindah',     function () { return getPengajuanPindah(token); });
    ambil('chatList',   function () { return getChatPercakapanAdmin(token); });
  } else {
    ambil('beranda',    function () { return getBerandaWarga(token); });
    ambil('tagihan',    function () { return getTagihanSaya(token, tahun); });
    ambil('riwayat',    function () { return getRiwayatSaya(token, tahun); });
    ambil('arusKas',    function () { return getArusKasWarga(token, tahun); });
    ambil('galeri',     function () { return getGaleriList(token, null); });
    ambil('pindah',     function () { return getPengajuanPindahSaya(token); });
    ambil('chatUnread', function () { return hitungChatBelumDibacaWarga_(profil.Email); });
  }
  ambil('notif', function () { return getNotifikasi(token); });
  return out;
}

/**
 * Panggilan ringan khusus badge notifikasi.
 * Klien memanggil ini berkala supaya badge tetap akurat di semua menu.
 */
function getNotifikasi(token) {
  const p = getProfil(token);
  const kosong = { transaksi: 0, akun: 0, pindah: 0, chat: 0, total: 0 };
  if (!p || p.Status !== 'Aktif') return kosong;
  if (p.Role === 'admin') {
    const akun = getAkunList_();
    const hasil = {
      transaksi: getMasukInternal_().filter(function (t) { return t.Status === 'Pending'; }).length,
      akun: akun.filter(function (a) { return a.Status === 'Menunggu'; }).length +
            akun.filter(function (a) { return a.Rumah_Diminta; }).length,
      pindah: rows_(SHEET_PINDAH).filter(function (x) { return x.Status === 'Menunggu'; }).length,
      chat: hitungChatBelumDibacaAdmin_()
    };
    hasil.total = hasil.transaksi + hasil.akun + hasil.pindah + hasil.chat;
    return hasil;
  }
  const chat = hitungChatBelumDibacaWarga_(p.Email);
  return { transaksi: 0, akun: 0, pindah: 0, chat: chat, total: chat };
}

// ================================ AKUN ==================================
function getAkunList_() {
  if (_CACHE.akun) return _CACHE.akun;
  _CACHE.akun = rows_(SHEET_AKUN);
  return _CACHE.akun;
}
function getAkunByEmail_(email) {
  const target = String(email || '').toLowerCase();
  return getAkunList_().find(function (a) { return String(a.Email || '').toLowerCase() === target; }) || null;
}
function adaAdminAktif_() {
  return getAkunList_().some(function (a) { return a.Role === 'admin' && a.Status === 'Aktif'; });
}
function emailTerdaftarSebagaiAdmin_(email) {
  const list = String(getSetting_().Admin_Emails || '').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  return list.indexOf(String(email).toLowerCase()) !== -1;
}
function upsertAkunSaatLogin_(email, nama, foto) {
  const ada = getAkunByEmail_(email);
  if (ada) {
    const patch = { Last_Login: new Date(), Last_Aktif: new Date() };
    if (nama && !ada.Nama) patch.Nama = nama;
    if (foto) patch.Foto = foto;
    if (ada.Status === 'Menunggu') patch.Status = 'Aktif';
    updateRow_(SHEET_AKUN, ada._row, patch);
    _CACHE.akun = null;
    return;
  }
  const jadiAdmin = !adaAdminAktif_() || emailTerdaftarSebagaiAdmin_(email);
  appendObj_(SHEET_AKUN, {
    ID_Akun: generateId('AKN'), Email: email, Nama: nama || '', No_Rumah: '', No_HP: '',
    Role: jadiAdmin ? 'admin' : 'warga',
    Status: jadiAdmin ? 'Aktif' : 'Baru',
    Tanggal_Daftar: new Date(), Last_Login: new Date(), Foto: foto || '',
    Foto_URL: '', Tema: 'sistem', Notif_Email: true, Notif_WA: true,
    Rumah_Diminta: '', Alasan_Pindah: '', Catatan_Admin: '', Last_Aktif: new Date()
  });
  _CACHE.akun = null;
}

/** Warga melengkapi data pendaftaran -> menunggu persetujuan bendahara. */
function lengkapiPendaftaran(token, data) {
  const akun = requireAkunSaya_(token);
  if (!data.Nama || !data.No_Rumah) throw new Error('Nama dan nomor rumah wajib diisi.');
  const noRumah = rumah_(data.No_Rumah);
  return withLock_(function () {
    const dipakai = getAkunList_().find(function (a) {
      return rumah_(a.No_Rumah) === noRumah && String(a.Email).toLowerCase() !== String(akun.Email).toLowerCase() && a.Status === 'Aktif';
    });
    if (dipakai) throw new Error('Nomor rumah ' + noRumah + ' sudah tertaut ke akun lain. Hubungi bendahara.');
    const patch = { Nama: data.Nama, No_Rumah: noRumah, No_HP: normalizeHp_(data.No_HP), Status: 'Aktif' };
    updateRow_(SHEET_AKUN, akun._row, patch);
    sinkronWargaDariAkun_(noRumah, data.Nama, data.No_HP);
    kabariAdminPendaftaranBaru_(data.Nama, noRumah, akun.Email);
    return { ok: true };
  });
}
function kabariAdminPendaftaranBaru_(nama, noRumah, email) {
  try {
    const setting = getSetting_();
    if (setting.WA_Bendahara) {
      kirimWaGateway_(setting.WA_Bendahara, '🔔 *Warga Baru Bergabung*\nNama: ' + nama + '\nRumah: ' + noRumah + '\nEmail: ' + email + '\n\nAkun sudah langsung aktif.');
    }
    const admins = getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif' && a.Email; });
    if (!admins.length) return;
    MailApp.sendEmail({
      to: admins.map(function (a) { return a.Email; }).join(','),
      subject: 'Warga baru bergabung: ' + noRumah + ' — ' + nama,
      htmlBody: '<p>Ada warga baru yang mendaftar dan akun sudah langsung aktif.</p>' +
        '<p><b>Nama:</b> ' + nama + '<br><b>Nomor rumah:</b> ' + noRumah + '<br><b>Email:</b> ' + email + '</p>'
    });
  } catch (e) {}
}
function getDaftarAkun(token) {
  requireAdmin_(token);
  const urutan = { 'Menunggu': 0, 'Baru': 1, 'Aktif': 2, 'Nonaktif': 3, 'Ditolak': 4 };
  return getAkunList_().map(function (a) {
    return {
      ID_Akun: a.ID_Akun, Email: a.Email, Nama: a.Nama, No_Rumah: a.No_Rumah, No_HP: a.No_HP,
      Role: a.Role, Status: a.Status,
      Avatar: a.Foto_URL || a.Foto || '',
      Rumah_Diminta: a.Rumah_Diminta || '', Alasan_Pindah: a.Alasan_Pindah || '',
      Catatan_Admin: a.Catatan_Admin || '',
      Tanggal_Daftar: a.Tanggal_Daftar ? fmtDate_(a.Tanggal_Daftar) : '',
      Last_Login: a.Last_Login ? fmtDate_(a.Last_Login) : '',
      Online: a.Last_Aktif ? (Date.now() - new Date(a.Last_Aktif).getTime() < ONLINE_WINDOW_MS) : false
    };
  }).sort(function (x, y) {
    const d = (urutan[x.Status] === undefined ? 9 : urutan[x.Status]) - (urutan[y.Status] === undefined ? 9 : urutan[y.Status]);
    return d !== 0 ? d : String(x.No_Rumah || 'zz').localeCompare(String(y.No_Rumah || 'zz'));
  });
}
function updateAkun(token, id, data) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_AKUN, 'ID_Akun', id);
    if (row === -1) throw new Error('Akun tidak ditemukan.');
    const target = getAkunList_().find(function (a) { return String(a.ID_Akun) === String(id); });
    if (target && target.Role === 'admin' && target.Status === 'Aktif' &&
        (data.Role !== undefined || data.Status !== undefined) &&
        ((data.Role !== undefined && data.Role !== 'admin') || (data.Status !== undefined && data.Status !== 'Aktif'))) {
      const jumlah = getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif'; }).length;
      if (jumlah <= 1) throw new Error('Minimal harus ada satu bendahara aktif.');
    }
    const noRumahBaru = data.No_Rumah !== undefined ? rumah_(data.No_Rumah) : undefined;
    if (noRumahBaru) {
      const bentrok = getAkunList_().find(function (a) {
        return rumah_(a.No_Rumah) === noRumahBaru && String(a.ID_Akun) !== String(id) && a.Status === 'Aktif';
      });
      if (bentrok) throw new Error('Nomor rumah ' + noRumahBaru + ' sudah dipakai akun lain.');
    }
    const patch = {};
    if (data.Nama !== undefined) patch.Nama = data.Nama;
    if (noRumahBaru !== undefined) { patch.No_Rumah = noRumahBaru; patch.Rumah_Diminta = ''; patch.Alasan_Pindah = ''; }
    if (data.No_HP !== undefined) patch.No_HP = normalizeHp_(data.No_HP);
    if (data.Role !== undefined) patch.Role = data.Role;
    if (data.Status !== undefined) patch.Status = data.Status;
    if (data.Catatan_Admin !== undefined) patch.Catatan_Admin = data.Catatan_Admin;
    updateRow_(SHEET_AKUN, row, patch);
    if (data.Status === 'Aktif' && (noRumahBaru || (target && target.No_Rumah))) {
      const rumahFinal = noRumahBaru || rumah_(target.No_Rumah);
      sinkronWargaDariAkun_(rumahFinal, patch.Nama || (target && target.Nama), patch.No_HP || (target && target.No_HP));
      if (target && target.Status !== 'Aktif') kirimEmailPersetujuan_(target.Email, patch.Nama || target.Nama);
    }
    return { ok: true };
  });
}
function sinkronWargaDariAkun_(noRumah, nama, noHp) {
  const ada = rows_(SHEET_WARGA).find(function (w) { return rumah_(w.No_Rumah) === rumah_(noRumah); });
  if (ada) {
    const patch = {};
    if (noHp) patch.No_HP = normalizeHp_(noHp);
    if (nama && !ada.Nama_Warga) patch.Nama_Warga = nama;
    if (Object.keys(patch).length) updateRow_(SHEET_WARGA, ada._row, patch);
    return;
  }
  appendObj_(SHEET_WARGA, {
    ID_Warga: generateId('WRG'), No_Rumah: rumah_(noRumah), Nama_Warga: nama || '',
    Status_Hunian: 'Tetap', No_HP: normalizeHp_(noHp), Tanggal_Bergabung: new Date()
  });
}
function kirimEmailPersetujuan_(email, nama) {
  if (!email) return;
  try {
    const st = getPengaturanPublik();
    MailApp.sendEmail({
      to: email,
      subject: 'Akun kas ' + (st.Nama_Perumahan || 'perumahan') + ' sudah aktif',
      htmlBody: '<p>Halo ' + (nama || '') + ',</p><p>Akun Anda sudah disetujui. Masuk kembali ke aplikasi kas untuk melihat tagihan dan riwayat pembayaran.</p>' +
        '<p>Salam,<br>' + (st.Nama_Bendahara || 'Bendahara') + '</p>'
    });
  } catch (e) {}
}
function hapusAkun(token, id) {
  const admin = requireAdmin_(token);
  return withLock_(function () {
    const target = getAkunList_().find(function (a) { return String(a.ID_Akun) === String(id); });
    if (!target) throw new Error('Akun tidak ditemukan.');
    if (admin.ID_Akun && String(admin.ID_Akun) === String(id)) throw new Error('Tidak bisa menghapus akun yang sedang Anda pakai.');
    if (target.Role === 'admin' && target.Status === 'Aktif') {
      const jumlah = getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif'; }).length;
      if (jumlah <= 1) throw new Error('Minimal harus ada satu bendahara aktif.');
    }
    hapusFotoDrive_(target.Foto_URL);
    deleteRow_(SHEET_AKUN, target._row);
    return { ok: true };
  });
}
function getPermintaanRumah(token) {
  requireAdmin_(token);
  return getAkunList_().filter(function (a) { return a.Rumah_Diminta; }).map(function (a) {
    return {
      ID_Akun: a.ID_Akun, Email: a.Email, Nama: a.Nama, No_Rumah: a.No_Rumah,
      Rumah_Diminta: a.Rumah_Diminta, Alasan_Pindah: a.Alasan_Pindah || ''
    };
  });
}
function putuskanPermintaanRumah(token, idAkun, setuju) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_AKUN, 'ID_Akun', idAkun);
    if (row === -1) throw new Error('Akun tidak ditemukan.');
    const a = getAkunList_().find(function (x) { return String(x.ID_Akun) === String(idAkun); });
    if (!a || !a.Rumah_Diminta) throw new Error('Tidak ada permintaan pada akun ini.');
    if (!setuju) {
      updateRow_(SHEET_AKUN, row, { Rumah_Diminta: '', Alasan_Pindah: '' });
      return { ok: true, disetujui: false };
    }
    const tujuan = rumah_(a.Rumah_Diminta);
    const dipakai = getAkunList_().find(function (x) {
      return rumah_(x.No_Rumah) === tujuan && String(x.ID_Akun) !== String(idAkun) && x.Status === 'Aktif';
    });
    if (dipakai) throw new Error('Rumah ' + tujuan + ' sudah dipakai akun lain.');
    updateRow_(SHEET_AKUN, row, { No_Rumah: tujuan, Rumah_Diminta: '', Alasan_Pindah: '' });
    sinkronWargaDariAkun_(tujuan, a.Nama, a.No_HP);
    return { ok: true, disetujui: true };
  });
}

// ===================== PROFIL & PENGATURAN AKUN =========================
function getPengaturanAkunSaya(token) {
  const a = requireAkunSaya_(token);
  const st = getPengaturanPublik();
  const warga = rows_(SHEET_WARGA).find(function (w) { return rumah_(w.No_Rumah) === rumah_(a.No_Rumah); });
  return {
    ID_Akun: a.ID_Akun, Email: a.Email, Nama: a.Nama || '',
    No_Rumah: a.No_Rumah || '', No_HP: a.No_HP || '',
    Role: a.Role, Status: a.Status,
    Foto_Google: a.Foto || '', Foto_URL: a.Foto_URL || '', Avatar: a.Foto_URL || a.Foto || '',
    Tema: a.Tema || 'sistem',
    Notif_Email: a.Notif_Email === '' ? true : bool_(a.Notif_Email),
    Notif_WA: a.Notif_WA === '' ? true : bool_(a.Notif_WA),
    Rumah_Diminta: a.Rumah_Diminta || '', Alasan_Pindah: a.Alasan_Pindah || '',
    Status_Hunian: warga ? warga.Status_Hunian : '',
    Tanggal_Bergabung: warga && warga.Tanggal_Bergabung ? fmtDate_(warga.Tanggal_Bergabung) : '',
    Tanggal_Daftar: a.Tanggal_Daftar ? fmtDate_(a.Tanggal_Daftar) : '',
    Last_Login: a.Last_Login ? fmtDate_(a.Last_Login) : '',
    WA_Bendahara: st.WA_Bendahara || ''
  };
}
function updateProfilSaya(token, data) {
  const a = requireAkunSaya_(token);
  const d = data || {};
  return withLock_(function () {
    const patch = {};
    if (d.Nama !== undefined) {
      const nama = String(d.Nama).trim();
      if (nama.length < 2) throw new Error('Nama minimal 2 karakter.');
      if (nama.length > 60) throw new Error('Nama maksimal 60 karakter.');
      patch.Nama = nama;
    }
    if (d.No_HP !== undefined) {
      const hp = normalizeHp_(d.No_HP);
      if (String(d.No_HP).trim() && !hp) throw new Error('Nomor WhatsApp tidak valid. Contoh: 081234567890.');
      const bentrok = getAkunList_().find(function (x) {
        return hp && normalizeHp_(x.No_HP) === hp && String(x.ID_Akun) !== String(a.ID_Akun);
      });
      if (bentrok) throw new Error('Nomor WhatsApp itu sudah dipakai akun lain.');
      patch.No_HP = hp;
    }
    if (d.Tema !== undefined) {
      const tema = String(d.Tema);
      if (['sistem','terang','gelap'].indexOf(tema) === -1) throw new Error('Pilihan tema tidak dikenal.');
      patch.Tema = tema;
    }
    if (d.Notif_Email !== undefined) patch.Notif_Email = !!bool_(d.Notif_Email);
    if (d.Notif_WA !== undefined) patch.Notif_WA = !!bool_(d.Notif_WA);
    if (!Object.keys(patch).length) return { ok: true, tidakAdaPerubahan: true };
    updateRow_(SHEET_AKUN, a._row, patch);
    if (a.No_Rumah && (patch.No_HP !== undefined || patch.Nama !== undefined)) {
      sinkronWargaDariAkun_(rumah_(a.No_Rumah), patch.Nama || a.Nama, patch.No_HP !== undefined ? patch.No_HP : a.No_HP);
    }
    return { ok: true, profil: getProfil(token) };
  });
}
function uploadFotoProfil(token, base64Data, filename, mimeType) {
  const a = requireAkunSaya_(token);
  if (!base64Data) throw new Error('Tidak ada berkas yang diunggah.');
  const mime = String(mimeType || '').toLowerCase();
  if (MIME_GAMBAR.indexOf(mime) === -1) throw new Error('Foto harus berformat JPG, PNG, atau WebP.');
  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_FOTO_BYTES) throw new Error('Ukuran foto maksimal 3 MB.');
  return withLock_(function () {
    const folder = getOrCreateFolder_(DRIVE_FOLDER_FOTO);
    const ext = mime.split('/')[1].replace('jpeg', 'jpg');
    const nama = 'foto-' + (rumah_(a.No_Rumah) || 'akun') + '-' + Date.now() + '.' + ext;
    const file = folder.createFile(Utilities.newBlob(bytes, mime, nama));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
    hapusFotoDrive_(a.Foto_URL);
    updateRow_(SHEET_AKUN, a._row, { Foto_URL: url });
    return { ok: true, url: url, fileId: file.getId() };
  });
}
function hapusFotoProfil(token) {
  const a = requireAkunSaya_(token);
  return withLock_(function () {
    hapusFotoDrive_(a.Foto_URL);
    updateRow_(SHEET_AKUN, a._row, { Foto_URL: '' });
    return { ok: true, url: a.Foto || '' };
  });
}
function hapusFotoDrive_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  if (!m) return;
  try { DriveApp.getFileById(m[0]).setTrashed(true); } catch (e) {}
}
function nonaktifkanAkunSaya(token) {
  const a = requireAkunSaya_(token);
  return withLock_(function () {
    if (a.Role === 'admin') {
      const jumlah = getAkunList_().filter(function (x) { return x.Role === 'admin' && x.Status === 'Aktif'; }).length;
      if (jumlah <= 1) throw new Error('Anda bendahara aktif terakhir. Tunjuk bendahara lain lebih dulu.');
    }
    updateRow_(SHEET_AKUN, a._row, { Status: 'Nonaktif' });
    logout(token);
    return { ok: true, message: 'Akun dinonaktifkan. Hubungi bendahara untuk mengaktifkannya kembali.' };
  });
}

// ============================ PENGATURAN KAS ============================
function getSetting_() {
  if (_CACHE.setting) return _CACHE.setting;
  _CACHE.setting = rows_(SHEET_SETTING)[0] || {};
  return _CACHE.setting;
}
function getPengaturanPublik() {
  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('PUB_SETTINGS_V5');
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  const s = getSetting_();
  const hasil = {
    Nama_Perumahan: s.Nama_Perumahan || 'Kas Perumahan',
    Nominal_Kas_Bulanan: Number(s.Nominal_Kas_Bulanan) || 0,
    Rekening_Tujuan: s.Rekening_Tujuan || '',
    Nama_Bendahara: s.Nama_Bendahara || '',
    WA_Bendahara: normalizeHp_(s.WA_Bendahara),
    QR_Code_URL: s.QR_Code_URL || '',
    Metode_Pembayaran: s.Metode_Pembayaran || 'Transfer Bank',
    Instruksi_Pembayaran: s.Instruksi_Pembayaran || '',
    Bulan_Mulai_Iuran: Number(s.Bulan_Mulai_Iuran) || 1,
    Tahun_Mulai_Iuran: Number(s.Tahun_Mulai_Iuran) || new Date().getFullYear(),
    Pengaturan_Aktif: s.Pengaturan_Aktif === '' ? false : bool_(s.Pengaturan_Aktif),
    Google_Client_Id: props_().getProperty('GOOGLE_CLIENT_ID') || ''
  };
  try { cache.put('PUB_SETTINGS_V5', JSON.stringify(hasil), 60); } catch (e) {}
  return hasil;
}
function getPengaturanAdmin(token) {
  requireAdmin_(token);
  const s = getSetting_();
  return {
    Nama_Perumahan: s.Nama_Perumahan, Nominal_Kas_Bulanan: s.Nominal_Kas_Bulanan,
    Rekening_Tujuan: s.Rekening_Tujuan, Nama_Bendahara: s.Nama_Bendahara,
    Admin_Emails: s.Admin_Emails || '', WA_Bendahara: s.WA_Bendahara || '',
    QR_Code_URL: s.QR_Code_URL || '',
    Metode_Pembayaran: s.Metode_Pembayaran || 'Transfer Bank',
    Instruksi_Pembayaran: s.Instruksi_Pembayaran || '',
    Bulan_Mulai_Iuran: Number(s.Bulan_Mulai_Iuran) || 1,
    Tahun_Mulai_Iuran: Number(s.Tahun_Mulai_Iuran) || new Date().getFullYear(),
    Pengaturan_Aktif: s.Pengaturan_Aktif === '' ? false : bool_(s.Pengaturan_Aktif),
    WA_Gateway_Aktif: !!props_().getProperty('FONNTE_TOKEN'),
    Login_Google_Aktif: !!props_().getProperty('GOOGLE_CLIENT_ID')
  };
}
function updatePengaturan(token, data) {
  requireAdmin_(token);
  return withLock_(function () {
    const sh = sh_(SHEET_SETTING);
    const headers = HEADERS[SHEET_SETTING];
    const kini = getSetting_();
    if (String(data.Admin_PIN || '') && String(data.Admin_PIN).length < 4) throw new Error('PIN minimal 4 angka.');
    const values = headers.map(function (h) {
      if (h === 'Admin_PIN') return data.Admin_PIN || kini.Admin_PIN;
      if (h === 'Pengaturan_Aktif') {
        if (data[h] === undefined) return kini[h] === '' ? false : bool_(kini[h]);
        return !!bool_(data[h]);
      }
      if (h === 'Bulan_Mulai_Iuran' || h === 'Tahun_Mulai_Iuran') {
        return Number(data[h] !== undefined ? data[h] : kini[h]) || 0;
      }
      return data[h] !== undefined ? data[h] : (kini[h] || '');
    });
    sh.getRange(2, 1, 1, headers.length).setValues([values]);
    try { CacheService.getScriptCache().remove('PUB_SETTINGS_V5'); } catch (e) {}
    return { ok: true };
  });
}

/** Upload QR Code ke Drive dan simpan URL-nya. */
function uploadQrCode(token, base64Data, filename, mimeType) {
  requireAdmin_(token);
  if (!base64Data) throw new Error('Tidak ada berkas yang diunggah.');
  const mime = String(mimeType || '').toLowerCase();
  if (MIME_GAMBAR.indexOf(mime) === -1) throw new Error('QR harus berupa gambar JPG, PNG, atau WebP.');
  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_FOTO_BYTES) throw new Error('Ukuran QR maksimal 3 MB.');
  return withLock_(function () {
    const folder = getOrCreateFolder_(DRIVE_FOLDER_QR);
    const ext = mime.split('/')[1].replace('jpeg', 'jpg');
    const file = folder.createFile(Utilities.newBlob(bytes, mime, 'qr-bendahara-' + Date.now() + '.' + ext));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';
    hapusFotoDrive_(getSetting_().QR_Code_URL);
    const sh = sh_(SHEET_SETTING);
    const map = colMap_(sh);
    if (map.QR_Code_URL) sh.getRange(2, map.QR_Code_URL).setValue(url);
    resetCache_();
    try { CacheService.getScriptCache().remove('PUB_SETTINGS_V5'); } catch (e) {}
    return { ok: true, url: url };
  });
}
function hapusQrCode(token) {
  requireAdmin_(token);
  return withLock_(function () {
    hapusFotoDrive_(getSetting_().QR_Code_URL);
    const sh = sh_(SHEET_SETTING);
    const map = colMap_(sh);
    if (map.QR_Code_URL) sh.getRange(2, map.QR_Code_URL).setValue('');
    resetCache_();
    try { CacheService.getScriptCache().remove('PUB_SETTINGS_V5'); } catch (e) {}
    return { ok: true };
  });
}

// ====================== BULAN AWAL IURAN ================================
function getBulanMulaiIuran_() {
  const s = getSetting_();
  const aktif = s.Pengaturan_Aktif === '' ? false : bool_(s.Pengaturan_Aktif);
  return {
    bulan: Number(s.Bulan_Mulai_Iuran) || 1,
    tahun: Number(s.Tahun_Mulai_Iuran) || new Date().getFullYear(),
    aktif: aktif
  };
}
function periodeValid_(bulan, tahun) {
  const m = getBulanMulaiIuran_();
  if (!m.aktif) return true;
  const b = Number(bulan), t = Number(tahun);
  if (!b || !t) return false;
  if (t > m.tahun) return true;
  if (t < m.tahun) return false;
  return b >= m.bulan;
}
function bulanPertamaTahun_(tahun) {
  const m = getBulanMulaiIuran_();
  if (!m.aktif) return 1;
  const t = Number(tahun);
  if (t < m.tahun) return 13;
  if (t > m.tahun) return 1;
  return m.bulan;
}
function bulanTerakhirTahun_(tahun) {
  const m = getBulanMulaiIuran_();
  if (!m.aktif) return 12;
  const t = Number(tahun);
  if (t < m.tahun) return 0;
  return 12;
}

// ============================= WARGA (CRUD) =============================
function getWargaListInternal_() {
  return rows_(SHEET_WARGA).map(function (w) {
    return Object.assign({}, w, { Tanggal_Bergabung: w.Tanggal_Bergabung ? fmtDate_(w.Tanggal_Bergabung) : '' });
  });
}
function getWargaList(token) {
  requireAdmin_(token);
  return getWargaListInternal_().sort(function (a, b) {
    return String(a.No_Rumah).localeCompare(String(b.No_Rumah), 'id', { numeric: true });
  });
}
function addWarga(token, warga) {
  requireAdmin_(token);
  if (!warga.No_Rumah || !warga.Nama_Warga) throw new Error('Nomor rumah dan nama warga wajib diisi.');
  return withLock_(function () {
    const no = rumah_(warga.No_Rumah);
    const ada = getWargaListInternal_().find(function (w) { return rumah_(w.No_Rumah) === no; });
    if (ada) throw new Error('Nomor rumah ' + no + ' sudah terdaftar atas nama ' + ada.Nama_Warga + '.');
    const id = generateId('WRG');
    appendObj_(SHEET_WARGA, {
      ID_Warga: id, No_Rumah: no, Nama_Warga: warga.Nama_Warga,
      Status_Hunian: warga.Status_Hunian || 'Tetap', No_HP: normalizeHp_(warga.No_HP),
      Tanggal_Bergabung: warga.Tanggal_Bergabung ? new Date(warga.Tanggal_Bergabung) : new Date()
    });
    return { ok: true, id: id };
  });
}
function updateWarga(token, id, warga) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_WARGA, 'ID_Warga', id);
    if (row === -1) throw new Error('Data warga tidak ditemukan.');
    const no = rumah_(warga.No_Rumah);
    const dup = getWargaListInternal_().find(function (w) { return rumah_(w.No_Rumah) === no && String(w.ID_Warga) !== String(id); });
    if (dup) throw new Error('Nomor rumah ' + no + ' sudah dipakai warga lain.');
    updateRow_(SHEET_WARGA, row, {
      No_Rumah: no, Nama_Warga: warga.Nama_Warga, Status_Hunian: warga.Status_Hunian || 'Tetap',
      No_HP: normalizeHp_(warga.No_HP),
      Tanggal_Bergabung: warga.Tanggal_Bergabung ? new Date(warga.Tanggal_Bergabung) : new Date()
    });
    return { ok: true };
  });
}
function deleteWarga(token, id) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_WARGA, 'ID_Warga', id);
    if (row === -1) throw new Error('Data warga tidak ditemukan.');
    deleteRow_(SHEET_WARGA, row);
    return { ok: true };
  });
}

// =========================== TRANSAKSI MASUK ============================
function getMasukInternal_() {
  return rows_(SHEET_MASUK)
    .map(function (t) { return Object.assign({}, t, { Tanggal: t.Tanggal ? fmtDate_(t.Tanggal) : '' }); })
    .sort(function (a, b) { return String(b.Tanggal).localeCompare(String(a.Tanggal)); });
}
function getKeluarInternal_() {
  return rows_(SHEET_KELUAR)
    .map(function (t) { return Object.assign({}, t, { Tanggal: t.Tanggal ? fmtDate_(t.Tanggal) : '' }); })
    .sort(function (a, b) { return String(b.Tanggal).localeCompare(String(a.Tanggal)); });
}
function getTransaksiMasuk(token) { requireAdmin_(token); return getMasukInternal_(); }
function getTransaksiKeluar(token) { requireAdmin_(token); return getKeluarInternal_(); }
function cekDuplikatPembayaran_(noRumah, bulan, tahun, jenis, status, excludeId) {
  if (status !== 'Lunas') return false;
  return getMasukInternal_().some(function (t) {
    return rumah_(t.No_Rumah) === rumah_(noRumah) &&
      Number(t.Periode_Bulan) === Number(bulan) &&
      Number(t.Periode_Tahun) === Number(tahun) &&
      t.Jenis_Iuran === jenis &&
      t.Status === 'Lunas' &&
      String(t.ID_Transaksi) !== String(excludeId || '');
  });
}
function addTransaksiMasuk(token, trx) {
  requireAdmin_(token);
  return withLock_(function () { return simpanMasuk_(trx); });
}
function simpanMasuk_(trx) {
  if (!trx.No_Rumah || !trx.Jumlah_Bayar) throw new Error('Nomor rumah dan jumlah bayar wajib diisi.');
  if (Number(trx.Jumlah_Bayar) <= 0) throw new Error('Jumlah bayar harus lebih dari nol.');
  if (trx.Periode_Bulan && trx.Periode_Tahun && !periodeValid_(trx.Periode_Bulan, trx.Periode_Tahun)) {
    throw new Error('Periode ini sebelum bulan mulai iuran yang ditetapkan admin.');
  }
  if (cekDuplikatPembayaran_(trx.No_Rumah, trx.Periode_Bulan, trx.Periode_Tahun, trx.Jenis_Iuran, trx.Status || 'Lunas', null)) {
    throw new Error('Pembayaran "' + trx.Jenis_Iuran + '" rumah ' + rumah_(trx.No_Rumah) + ' periode ' +
      BULAN_ID[Number(trx.Periode_Bulan) - 1] + ' ' + trx.Periode_Tahun + ' sudah tercatat lunas.');
  }
  const id = generateId('TM');
  appendObj_(SHEET_MASUK, {
    ID_Transaksi: id, Tanggal: trx.Tanggal ? new Date(trx.Tanggal) : new Date(),
    No_Rumah: rumah_(trx.No_Rumah), Nama_Warga: trx.Nama_Warga || '',
    Jenis_Iuran: trx.Jenis_Iuran || 'Kas Bulanan', Jumlah_Bayar: Number(trx.Jumlah_Bayar) || 0,
    Periode_Bulan: Number(trx.Periode_Bulan), Periode_Tahun: Number(trx.Periode_Tahun),
    Metode_Bayar: trx.Metode_Bayar || 'Tunai', Status: trx.Status || 'Lunas',
    Catatan: trx.Catatan || '', Proof_URL: trx.Proof_URL || ''
  });
  return { ok: true, id: id };
}
function updateTransaksiMasuk(token, id, trx) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_MASUK, 'ID_Transaksi', id);
    if (row === -1) throw new Error('Transaksi tidak ditemukan.');
    if (trx.Periode_Bulan && trx.Periode_Tahun && !periodeValid_(trx.Periode_Bulan, trx.Periode_Tahun)) {
      throw new Error('Periode ini sebelum bulan mulai iuran.');
    }
    if (cekDuplikatPembayaran_(trx.No_Rumah, trx.Periode_Bulan, trx.Periode_Tahun, trx.Jenis_Iuran, trx.Status, id)) {
      throw new Error('Periode ini sudah tercatat lunas pada transaksi lain.');
    }
    updateRow_(SHEET_MASUK, row, {
      Tanggal: trx.Tanggal ? new Date(trx.Tanggal) : new Date(),
      No_Rumah: rumah_(trx.No_Rumah), Nama_Warga: trx.Nama_Warga || '',
      Jenis_Iuran: trx.Jenis_Iuran, Jumlah_Bayar: Number(trx.Jumlah_Bayar) || 0,
      Periode_Bulan: Number(trx.Periode_Bulan), Periode_Tahun: Number(trx.Periode_Tahun),
      Metode_Bayar: trx.Metode_Bayar, Status: trx.Status,
      Catatan: trx.Catatan || '', Proof_URL: trx.Proof_URL || ''
    });
    return { ok: true };
  });
}
function deleteTransaksiMasuk(token, id) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_MASUK, 'ID_Transaksi', id);
    if (row === -1) throw new Error('Transaksi tidak ditemukan.');
    deleteRow_(SHEET_MASUK, row);
    return { ok: true };
  });
}
function verifikasiPembayaran(token, id) {
  requireAdmin_(token);
  withLock_(function () {
    const row = cariRow_(SHEET_MASUK, 'ID_Transaksi', id);
    if (row === -1) throw new Error('Transaksi tidak ditemukan.');
    const trx = getMasukInternal_().find(function (t) { return String(t.ID_Transaksi) === String(id); });
    if (trx.Status === 'Lunas') return;
    if (cekDuplikatPembayaran_(trx.No_Rumah, trx.Periode_Bulan, trx.Periode_Tahun, trx.Jenis_Iuran, 'Lunas', id)) {
      throw new Error('Periode ini sudah lunas pada transaksi lain.');
    }
    updateRow_(SHEET_MASUK, row, { Status: 'Lunas' });
  });
  return kirimNotifPembayaran(token, id);
}

// =========================== TRANSAKSI KELUAR ===========================
function addTransaksiKeluar(token, trx) {
  requireAdmin_(token);
  if (!trx.Kategori_Pengeluaran || !trx.Jumlah) throw new Error('Kategori dan jumlah wajib diisi.');
  if (Number(trx.Jumlah) <= 0) throw new Error('Jumlah harus lebih dari nol.');
  return withLock_(function () {
    const id = generateId('TK');
    appendObj_(SHEET_KELUAR, {
      ID_Kategori: id, Tanggal: trx.Tanggal ? new Date(trx.Tanggal) : new Date(),
      Kategori_Pengeluaran: trx.Kategori_Pengeluaran, Jumlah: Number(trx.Jumlah) || 0,
      Penanggung_Jawab: trx.Penanggung_Jawab || '', Bukti_Nota_URL: trx.Bukti_Nota_URL || '',
      Keterangan: trx.Keterangan || ''
    });
    return { ok: true, id: id };
  });
}
function updateTransaksiKeluar(token, id, trx) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_KELUAR, 'ID_Kategori', id);
    if (row === -1) throw new Error('Transaksi tidak ditemukan.');
    updateRow_(SHEET_KELUAR, row, {
      Tanggal: trx.Tanggal ? new Date(trx.Tanggal) : new Date(),
      Kategori_Pengeluaran: trx.Kategori_Pengeluaran, Jumlah: Number(trx.Jumlah) || 0,
      Penanggung_Jawab: trx.Penanggung_Jawab || '', Bukti_Nota_URL: trx.Bukti_Nota_URL || '',
      Keterangan: trx.Keterangan || ''
    });
    return { ok: true };
  });
}
function deleteTransaksiKeluar(token, id) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_KELUAR, 'ID_Kategori', id);
    if (row === -1) throw new Error('Transaksi tidak ditemukan.');
    deleteRow_(SHEET_KELUAR, row);
    return { ok: true };
  });
}

// ============================= UPLOAD BUKTI =============================
function uploadBuktiFile(token, base64Data, filename, mimeType) {
  requireAktif_(token);
  if (!base64Data) throw new Error('Tidak ada berkas yang diunggah.');
  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_BUKTI_BYTES) throw new Error('Ukuran berkas maksimal 8 MB.');
  const mime = String(mimeType || '').toLowerCase();
  if (MIME_GAMBAR.indexOf(mime) === -1 && mime !== 'application/pdf') throw new Error('Bukti harus berupa gambar atau PDF.');
  const folder = getOrCreateFolder_(DRIVE_FOLDER_BUKTI);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, filename || ('bukti-' + Date.now())));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: file.getUrl(), fileId: file.getId() };
}
function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}

// ============================ BACKUP ====================================
function backupData(token) {
  requireAdmin_(token);
  const file = DriveApp.getFileById(SPREADSHEET_ID);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  const copy = file.makeCopy('Backup_KasPerumahan_' + stamp, getOrCreateFolder_(DRIVE_FOLDER_BACKUP));
  return { ok: true, url: copy.getUrl(), name: copy.getName() };
}

// ====================== NOTIFIKASI WHATSAPP & EMAIL =====================
function buatPesanKuitansi_(trx, settings) {
  const periode = BULAN_ID[Number(trx.Periode_Bulan) - 1] + ' ' + trx.Periode_Tahun;
  return [
    '*KUITANSI PEMBAYARAN KAS*',
    settings.Nama_Perumahan, '',
    'No. Kuitansi : ' + trx.ID_Transaksi,
    'Tanggal      : ' + fmtTanggalPanjang_(trx.Tanggal),
    'No. Rumah    : ' + trx.No_Rumah,
    'Nama         : ' + trx.Nama_Warga,
    'Iuran        : ' + trx.Jenis_Iuran,
    'Periode      : ' + periode,
    'Metode       : ' + (trx.Metode_Bayar || 'Tunai'),
    'Jumlah       : *' + rupiah_(trx.Jumlah_Bayar) + '*',
    'Status       : ' + trx.Status, '',
    'Terima kasih atas pembayarannya. Pesan ini adalah bukti sah pencatatan kas.',
    '— ' + (settings.Nama_Bendahara || 'Bendahara')
  ].join('\n');
}
function buatPesanTagihan_(warga, bulan, tahun, nominal, settings) {
  return [
    'Halo ' + (warga.Nama_Warga || warga.Nama) + ',', '',
    'Pengingat iuran kas ' + settings.Nama_Perumahan + ' untuk rumah *' + warga.No_Rumah + '*',
    'Periode : ' + BULAN_ID[bulan - 1] + ' ' + tahun,
    'Nominal : *' + rupiah_(nominal) + '*',
    settings.Rekening_Tujuan ? 'Transfer : ' + settings.Rekening_Tujuan : '', '',
    'Mohon konfirmasi setelah membayar. Terima kasih.',
    '— ' + (settings.Nama_Bendahara || 'Bendahara')
  ].filter(Boolean).join('\n');
}
function cariKontak_(noRumah) {
  const r = rumah_(noRumah);
  const akun = getAkunList_().find(function (a) { return rumah_(a.No_Rumah) === r && a.Status === 'Aktif'; })
    || getAkunList_().find(function (a) { return rumah_(a.No_Rumah) === r; });
  const warga = getWargaListInternal_().find(function (w) { return rumah_(w.No_Rumah) === r; });
  const hp = normalizeHp_((akun && akun.No_HP) || (warga && warga.No_HP) || '');
  return {
    hp: hp, email: akun ? akun.Email : '',
    nama: (akun && akun.Nama) || (warga && warga.Nama_Warga) || '',
    notifEmail: !akun || akun.Notif_Email === '' ? true : bool_(akun.Notif_Email),
    notifWa: !akun || akun.Notif_WA === '' ? true : bool_(akun.Notif_WA)
  };
}
function kirimNotifPembayaran(token, idTransaksi) {
  requireAdmin_(token);
  const settings = getPengaturanPublik();
  const trx = getMasukInternal_().find(function (t) { return String(t.ID_Transaksi) === String(idTransaksi); });
  if (!trx) throw new Error('Transaksi tidak ditemukan.');
  const kontak = cariKontak_(trx.No_Rumah);
  const pesan = buatPesanKuitansi_(trx, settings);
  if (!kontak.hp) {
    return { ok: false, mode: 'tanpa-nomor', pesan: pesan,
      message: 'Nomor WhatsApp rumah ' + trx.No_Rumah + ' belum terisi.' };
  }
  if (kontak.email && kontak.notifEmail) {
    try {
      MailApp.sendEmail({
        to: kontak.email,
        subject: 'Kuitansi kas ' + BULAN_ID[Number(trx.Periode_Bulan) - 1] + ' ' + trx.Periode_Tahun + ' — ' + trx.No_Rumah,
        htmlBody: '<pre style="font-family:ui-monospace,monospace;font-size:13px">' + pesan.replace(/\*/g, '') + '</pre>'
      });
    } catch (e) {}
  }
  if (!kontak.notifWa) {
    return { ok: true, mode: 'manual', hp: kontak.hp, pesan: pesan,
      url: 'https://wa.me/' + kontak.hp + '?text=' + encodeURIComponent(pesan),
      message: 'Warga menonaktifkan notifikasi WhatsApp.' };
  }
  const hasil = kirimWaGateway_(kontak.hp, pesan);
  if (hasil.terkirim) return { ok: true, mode: 'otomatis', hp: kontak.hp, pesan: pesan, message: 'Kuitansi terkirim otomatis ke ' + kontak.hp + '.' };
  return { ok: true, mode: 'manual', hp: kontak.hp, pesan: pesan,
    url: 'https://wa.me/' + kontak.hp + '?text=' + encodeURIComponent(pesan),
    message: hasil.error || 'Buka WhatsApp untuk mengirim kuitansi.' };
}
function kirimPengingat(token, noRumah, bulan, tahun) {
  requireAdmin_(token);
  const settings = getPengaturanPublik();
  const warga = getWargaListInternal_().find(function (w) { return rumah_(w.No_Rumah) === rumah_(noRumah); });
  if (!warga) throw new Error('Data warga tidak ditemukan.');
  const kontak = cariKontak_(noRumah);
  const pesan = buatPesanTagihan_(warga, Number(bulan), Number(tahun), settings.Nominal_Kas_Bulanan, settings);
  if (!kontak.hp) return { ok: false, mode: 'tanpa-nomor', pesan: pesan, message: 'Nomor WhatsApp rumah ' + rumah_(noRumah) + ' belum terisi.' };
  const hasil = kontak.notifWa ? kirimWaGateway_(kontak.hp, pesan) : { terkirim: false, error: 'Warga menonaktifkan notifikasi WhatsApp.' };
  if (hasil.terkirim) return { ok: true, mode: 'otomatis', hp: kontak.hp, pesan: pesan, message: 'Pengingat terkirim ke ' + kontak.hp + '.' };
  return { ok: true, mode: 'manual', hp: kontak.hp, pesan: pesan,
    url: 'https://wa.me/' + kontak.hp + '?text=' + encodeURIComponent(pesan),
    message: hasil.error || 'Buka WhatsApp untuk mengirim pengingat.' };
}
function kirimPengingatMassal(token, bulan, tahun) {
  requireAdmin_(token);
  const penunggak = getTunggakan(token, bulan, tahun);
  const settings = getPengaturanPublik();
  const hasil = [];
  penunggak.forEach(function (w) {
    const kontak = cariKontak_(w.No_Rumah);
    const pesan = buatPesanTagihan_(w, Number(bulan), Number(tahun), settings.Nominal_Kas_Bulanan, settings);
    if (!kontak.hp) { hasil.push({ No_Rumah: w.No_Rumah, Nama: w.Nama_Warga, status: 'tanpa-nomor' }); return; }
    const kirim = kontak.notifWa ? kirimWaGateway_(kontak.hp, pesan) : { terkirim: false };
    hasil.push({
      No_Rumah: w.No_Rumah, Nama: w.Nama_Warga, hp: kontak.hp,
      status: kirim.terkirim ? 'terkirim' : 'manual',
      url: kirim.terkirim ? '' : 'https://wa.me/' + kontak.hp + '?text=' + encodeURIComponent(pesan)
    });
  });
  return { ok: true, total: hasil.length, hasil: hasil, otomatis: !!props_().getProperty('FONNTE_TOKEN') };
}
function kirimWaGateway_(hp, pesan) {
  const apiToken = props_().getProperty('FONNTE_TOKEN');
  if (!apiToken) return { terkirim: false };
  try {
    const res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post', headers: { Authorization: apiToken },
      payload: { target: hp, message: pesan, countryCode: '62' }, muteHttpExceptions: true
    });
    const body = JSON.parse(res.getContentText() || '{}');
    if (body.status === true || body.status === 'true') return { terkirim: true };
    return { terkirim: false, error: 'Gateway menolak: ' + (body.reason || res.getContentText()) };
  } catch (err) {
    return { terkirim: false, error: 'Gateway tidak merespons: ' + err.message };
  }
}

// ============================ DASHBOARD ADMIN ===========================
function getDashboardData(token) {
  requireAdmin_(token);
  const masuk = getMasukInternal_();
  const keluar = getKeluarInternal_();
  const warga = getWargaListInternal_();
  const now = new Date();
  const bulanIni = now.getMonth() + 1;
  const tahunIni = now.getFullYear();

  const totalMasukAll = masuk.filter(function (t) { return t.Status === 'Lunas'; })
    .reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
  const totalKeluarAll = keluar.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0);

  const masukBulanIni = masuk.filter(function (t) {
    return t.Status === 'Lunas' && Number(t.Periode_Bulan) === bulanIni && Number(t.Periode_Tahun) === tahunIni;
  });
  const keluarBulanIni = keluar.filter(function (t) {
    const d = new Date(t.Tanggal);
    return d.getMonth() + 1 === bulanIni && d.getFullYear() === tahunIni;
  });

  const rumahLunas = {};
  masukBulanIni.forEach(function (t) { rumahLunas[rumah_(t.No_Rumah)] = true; });
  const jumlahLunas = Object.keys(rumahLunas).length;
  const totalRumah = warga.length;

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tahunIni, bulanIni - 1 - i, 1);
    const b = d.getMonth() + 1, th = d.getFullYear();
    const m = masuk.filter(function (x) { return x.Status === 'Lunas' && Number(x.Periode_Bulan) === b && Number(x.Periode_Tahun) === th; })
      .reduce(function (s, x) { return s + Number(x.Jumlah_Bayar || 0); }, 0);
    const k = keluar.filter(function (x) {
      const dd = new Date(x.Tanggal);
      return dd.getMonth() + 1 === b && dd.getFullYear() === th;
    }).reduce(function (s, x) { return s + Number(x.Jumlah || 0); }, 0);
    trend.push({ label: BULAN_ID[b - 1].substring(0, 3) + ' ' + String(th).slice(2), masuk: m, keluar: k });
  }

  const kategoriMap = {}, jenisMap = {};
  keluarBulanIni.forEach(function (t) { kategoriMap[t.Kategori_Pengeluaran] = (kategoriMap[t.Kategori_Pengeluaran] || 0) + Number(t.Jumlah || 0); });
  masukBulanIni.forEach(function (t) { jenisMap[t.Jenis_Iuran] = (jenisMap[t.Jenis_Iuran] || 0) + Number(t.Jumlah_Bayar || 0); });

  return {
    saldo: totalMasukAll - totalKeluarAll,
    totalMasukBulanIni: masukBulanIni.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0),
    totalKeluarBulanIni: keluarBulanIni.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0),
    persentaseLunas: totalRumah > 0 ? Math.round((jumlahLunas / totalRumah) * 100) : 0,
    totalRumah: totalRumah, rumahLunas: jumlahLunas,
    menungguVerifikasi: masuk.filter(function (t) { return t.Status === 'Pending'; }).length,
    akunMenunggu: getAkunList_().filter(function (a) { return a.Status === 'Menunggu'; }).length,
    permintaanRumah: getAkunList_().filter(function (a) { return a.Rumah_Diminta; }).length,
    pindahMenunggu: rows_(SHEET_PINDAH).filter(function (p) { return p.Status === 'Menunggu'; }).length,
    chatBelumDibaca: hitungChatBelumDibacaAdmin_(),
    trend: trend,
    pengeluaranKategori: Object.keys(kategoriMap).map(function (k) { return { kategori: k, jumlah: kategoriMap[k] }; }),
    pemasukanJenis: Object.keys(jenisMap).map(function (k) { return { jenis: k, jumlah: jenisMap[k] }; }),
    statusWarga: { lunas: jumlahLunas, belumLunas: Math.max(totalRumah - jumlahLunas, 0) },
    bulanIniLabel: BULAN_ID[bulanIni - 1] + ' ' + tahunIni
  };
}

// ============================== AREA WARGA ==============================
function getBerandaWarga(token) {
  const p = requireAktif_(token);
  const settings = getPengaturanPublik();
  const now = new Date();
  const bulanIni = now.getMonth() + 1, tahunIni = now.getFullYear();
  const mulai = getBulanMulaiIuran_();

  const semuaMasuk = getMasukInternal_();
  const milikSaya = semuaMasuk.filter(function (t) { return rumah_(t.No_Rumah) === rumah_(p.No_Rumah); });
  const lunasBulanIni = milikSaya.filter(function (t) {
    return t.Status === 'Lunas' && Number(t.Periode_Bulan) === bulanIni && Number(t.Periode_Tahun) === tahunIni;
  });
  const pendingSaya = milikSaya.filter(function (t) { return t.Status === 'Pending'; });

  const belum = [];
  const bAwal = bulanPertamaTahun_(tahunIni);
  for (let b = bAwal; b <= bulanIni; b++) {
    if (b < 1 || b > 12) continue;
    if (!periodeValid_(b, tahunIni)) continue;
    const bayar = milikSaya.filter(function (t) {
      return t.Status === 'Lunas' && Number(t.Periode_Bulan) === b && Number(t.Periode_Tahun) === tahunIni;
    }).reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
    if (bayar < settings.Nominal_Kas_Bulanan) {
      belum.push({ bulan: b, label: BULAN_ID[b - 1] + ' ' + tahunIni, kurang: settings.Nominal_Kas_Bulanan - bayar });
    }
  }

  const totalMasukAll = semuaMasuk.filter(function (t) { return t.Status === 'Lunas'; })
    .reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
  const totalKeluarAll = getKeluarInternal_().reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0);

  const adaPendingBulanIni = pendingSaya.some(function (t) {
    return Number(t.Periode_Bulan) === bulanIni && Number(t.Periode_Tahun) === tahunIni;
  });

  return {
    profil: p, settings: settings,
    bulanMulai: mulai.aktif ? (BULAN_ID[mulai.bulan - 1] + ' ' + mulai.tahun) : '',
    bulanIniLabel: BULAN_ID[bulanIni - 1] + ' ' + tahunIni,
    statusBulanIni: lunasBulanIni.length ? 'Lunas' : (adaPendingBulanIni ? 'Menunggu verifikasi' : 'Belum bayar'),
    dibayarBulanIni: lunasBulanIni.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0),
    totalTunggakan: belum.reduce(function (s, b) { return s + b.kurang; }, 0),
    daftarTunggakan: belum,
    totalDibayarTahunIni: milikSaya.filter(function (t) { return t.Status === 'Lunas' && Number(t.Periode_Tahun) === tahunIni; })
      .reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0),
    pengajuanPending: pendingSaya.length,
    chatBelumDibaca: hitungChatBelumDibacaWarga_(p.Email),
    kasUmum: { saldo: totalMasukAll - totalKeluarAll }
  };
}
function getRiwayatSaya(token, tahun) {
  const p = requireAktif_(token);
  const th = Number(tahun) || new Date().getFullYear();
  return getMasukInternal_()
    .filter(function (t) { return rumah_(t.No_Rumah) === rumah_(p.No_Rumah) && Number(t.Periode_Tahun) === th; })
    .map(function (t) {
      return {
        ID_Transaksi: t.ID_Transaksi, Tanggal: t.Tanggal, Jenis_Iuran: t.Jenis_Iuran,
        Periode_Bulan: t.Periode_Bulan, Periode_Tahun: t.Periode_Tahun, Nama_Warga: t.Nama_Warga,
        No_Rumah: t.No_Rumah, Jumlah_Bayar: t.Jumlah_Bayar, Metode_Bayar: t.Metode_Bayar,
        Status: t.Status, Proof_URL: t.Proof_URL, Catatan: t.Catatan
      };
    });
}
function getTagihanSaya(token, tahun) {
  const p = requireAktif_(token);
  const settings = getPengaturanPublik();
  const th = Number(tahun) || new Date().getFullYear();
  const milik = getMasukInternal_().filter(function (t) {
    return rumah_(t.No_Rumah) === rumah_(p.No_Rumah) && Number(t.Periode_Tahun) === th;
  });
  const sekarang = new Date();
  const batas = th < sekarang.getFullYear() ? 12 : (th > sekarang.getFullYear() ? 0 : sekarang.getMonth() + 1);

  const rows = [];
  for (let b = 1; b <= 12; b++) {
    const diLuarPeriode = !periodeValid_(b, th);
    if (diLuarPeriode) {
      rows.push({
        bulan: b, label: BULAN_ID[b - 1], tagihan: 0, dibayar: 0,
        status: 'Di luar periode iuran', kurang: 0, diluar: true
      });
      continue;
    }
    const lunas = milik.filter(function (t) { return Number(t.Periode_Bulan) === b && t.Status === 'Lunas'; });
    const pending = milik.filter(function (t) { return Number(t.Periode_Bulan) === b && t.Status === 'Pending'; });
    const dibayar = lunas.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
    let status = 'Belum jatuh tempo';
    if (dibayar >= settings.Nominal_Kas_Bulanan && settings.Nominal_Kas_Bulanan > 0) status = 'Lunas';
    else if (pending.length) status = 'Menunggu verifikasi';
    else if (b <= batas) status = dibayar > 0 ? 'Kurang bayar' : 'Belum bayar';
    rows.push({
      bulan: b, label: BULAN_ID[b - 1], tagihan: settings.Nominal_Kas_Bulanan,
      dibayar: dibayar, status: status, kurang: Math.max(settings.Nominal_Kas_Bulanan - dibayar, 0)
    });
  }
  return { tahun: th, rows: rows, settings: settings, bulanMulai: getBulanMulaiIuran_() };
}
function getArusKasWarga(token, tahun) {
  requireAktif_(token);
  const th = Number(tahun) || new Date().getFullYear();
  const now = new Date();
  const bulanIni = now.getMonth() + 1, tahunIni = now.getFullYear();
  const semuaMasuk = getMasukInternal_().filter(function (t) { return t.Status === 'Lunas'; });
  const semuaKeluar = getKeluarInternal_();
  const totalMasukAll = semuaMasuk.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
  const totalKeluarAll = semuaKeluar.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0);
  const masukBulanIni = semuaMasuk.filter(function (t) { return Number(t.Periode_Bulan) === bulanIni && Number(t.Periode_Tahun) === tahunIni; });
  const keluarBulanIni = semuaKeluar.filter(function (t) {
    const d = new Date(t.Tanggal);
    return d.getMonth() + 1 === bulanIni && d.getFullYear() === tahunIni;
  });
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(tahunIni, bulanIni - 1 - i, 1);
    const b = d.getMonth() + 1, thTrend = d.getFullYear();
    const m = semuaMasuk.filter(function (x) { return Number(x.Periode_Bulan) === b && Number(x.Periode_Tahun) === thTrend; })
      .reduce(function (s, x) { return s + Number(x.Jumlah_Bayar || 0); }, 0);
    const k = semuaKeluar.filter(function (x) {
      const dd = new Date(x.Tanggal);
      return dd.getMonth() + 1 === b && dd.getFullYear() === thTrend;
    }).reduce(function (s, x) { return s + Number(x.Jumlah || 0); }, 0);
    trend.push({ label: BULAN_ID[b - 1].substring(0, 3) + ' ' + String(thTrend).slice(2), masuk: m, keluar: k });
  }
  const jenisMap = {}, kategoriMap = {};
  masukBulanIni.forEach(function (t) { jenisMap[t.Jenis_Iuran] = (jenisMap[t.Jenis_Iuran] || 0) + Number(t.Jumlah_Bayar || 0); });
  keluarBulanIni.forEach(function (t) { kategoriMap[t.Kategori_Pengeluaran] = (kategoriMap[t.Kategori_Pengeluaran] || 0) + Number(t.Jumlah || 0); });
  const daftarKeluar = semuaKeluar
    .filter(function (t) { return new Date(t.Tanggal).getFullYear() === th; })
    .map(function (t) {
      return {
        Tanggal: t.Tanggal, Kategori_Pengeluaran: t.Kategori_Pengeluaran, Jumlah: t.Jumlah,
        Penanggung_Jawab: t.Penanggung_Jawab || '', Keterangan: t.Keterangan || '', Bukti_Nota_URL: t.Bukti_Nota_URL || ''
      };
    })
    .sort(function (a, b) { return String(b.Tanggal).localeCompare(String(a.Tanggal)); });
  return {
    tahun: th,
    saldo: totalMasukAll - totalKeluarAll,
    totalMasukBulanIni: masukBulanIni.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0),
    totalKeluarBulanIni: keluarBulanIni.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0),
    bulanIniLabel: BULAN_ID[bulanIni - 1] + ' ' + tahunIni,
    trend: trend,
    pemasukanJenis: Object.keys(jenisMap).map(function (k) { return { jenis: k, jumlah: jenisMap[k] }; }),
    pengeluaranKategori: Object.keys(kategoriMap).map(function (k) { return { kategori: k, jumlah: kategoriMap[k] }; }),
    daftarKeluar: daftarKeluar,
    totalKeluarTahun: daftarKeluar.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0)
  };
}
function ajukanPembayaran(token, data) {
  const p = requireAktif_(token);
  if (!data.Jumlah_Bayar || Number(data.Jumlah_Bayar) <= 0) throw new Error('Jumlah pembayaran wajib diisi.');
  if (!p.No_Rumah) throw new Error('Nomor rumah Anda belum ditautkan. Hubungi bendahara.');
  const bulan = Number(data.Periode_Bulan), tahun = Number(data.Periode_Tahun);
  const jenis = data.Jenis_Iuran || 'Kas Bulanan';
  if (!periodeValid_(bulan, tahun)) throw new Error('Periode ini sebelum bulan mulai iuran yang ditetapkan admin.');
  return withLock_(function () {
    const milik = getMasukInternal_().filter(function (t) {
      return rumah_(t.No_Rumah) === rumah_(p.No_Rumah) &&
        Number(t.Periode_Bulan) === bulan && Number(t.Periode_Tahun) === tahun && t.Jenis_Iuran === jenis;
    });
    if (milik.some(function (t) { return t.Status === 'Lunas'; })) throw new Error('Periode ini sudah tercatat lunas.');
    if (milik.some(function (t) { return t.Status === 'Pending'; })) throw new Error('Sudah ada pengajuan untuk periode ini yang menunggu verifikasi.');
    const id = generateId('TM');
    appendObj_(SHEET_MASUK, {
      ID_Transaksi: id, Tanggal: data.Tanggal ? new Date(data.Tanggal) : new Date(),
      No_Rumah: rumah_(p.No_Rumah), Nama_Warga: p.Nama, Jenis_Iuran: jenis,
      Jumlah_Bayar: Number(data.Jumlah_Bayar) || 0, Periode_Bulan: bulan, Periode_Tahun: tahun,
      Metode_Bayar: data.Metode_Bayar || 'Transfer', Status: 'Pending',
      Catatan: 'Diajukan lewat aplikasi oleh ' + p.Email + (data.Catatan ? ' — ' + data.Catatan : ''),
      Proof_URL: data.Proof_URL || ''
    });
    try {
      const st = getPengaturanPublik();
      const pesan = 'Konfirmasi pembayaran baru menunggu verifikasi:\n' +
        'Rumah ' + p.No_Rumah + ' — ' + p.Nama + '\n' +
        jenis + ' ' + BULAN_ID[bulan - 1] + ' ' + tahun + '\n' +
        rupiah_(data.Jumlah_Bayar) + (data.Proof_URL ? '\nBukti: ' + data.Proof_URL : '');
      if (st.WA_Bendahara) kirimWaGateway_(st.WA_Bendahara, pesan);
      const admins = getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif' && a.Email; });
      if (admins.length) MailApp.sendEmail({ to: admins.map(function (a) { return a.Email; }).join(','), subject: 'Konfirmasi pembayaran: ' + p.No_Rumah, body: pesan });
    } catch (e) {}
    return { ok: true, id: id };
  });
}

// =========================== STATUS & LAPORAN ===========================
function getStatusIuranWarga(token, bulan, tahun) {
  requireAdmin_(token);
  const warga = getWargaListInternal_();
  const settings = getPengaturanPublik();
  if (!periodeValid_(bulan, tahun)) return [];
  const masuk = getMasukInternal_().filter(function (t) {
    return Number(t.Periode_Bulan) === Number(bulan) && Number(t.Periode_Tahun) === Number(tahun);
  });
  return warga.map(function (w) {
    const bayar = masuk.filter(function (t) { return rumah_(t.No_Rumah) === rumah_(w.No_Rumah) && t.Status === 'Lunas'; });
    const pending = masuk.filter(function (t) { return rumah_(t.No_Rumah) === rumah_(w.No_Rumah) && t.Status === 'Pending'; });
    const total = bayar.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
    let status = 'Belum Bayar';
    if (total >= settings.Nominal_Kas_Bulanan && settings.Nominal_Kas_Bulanan > 0) status = 'Lunas';
    else if (total > 0) status = 'Kurang Bayar';
    else if (pending.length) status = 'Menunggu Verifikasi';
    return {
      No_Rumah: w.No_Rumah, Nama_Warga: w.Nama_Warga, No_HP: normalizeHp_(w.No_HP),
      Status: status, Total_Dibayar: total,
      Jenis_Dibayar: bayar.map(function (t) { return t.Jenis_Iuran; }).join(', ')
    };
  }).sort(function (a, b) { return String(a.No_Rumah).localeCompare(String(b.No_Rumah), 'id', { numeric: true }); });
}
function getTunggakan(token, bulan, tahun) {
  requireAdmin_(token);
  if (!periodeValid_(bulan, tahun)) return [];
  const settings = getPengaturanPublik();
  const masuk = getMasukInternal_().filter(function (t) {
    return Number(t.Periode_Bulan) === Number(bulan) && Number(t.Periode_Tahun) === Number(tahun) && t.Status === 'Lunas';
  });
  return getWargaListInternal_().filter(function (w) {
    const total = masuk.filter(function (t) { return rumah_(t.No_Rumah) === rumah_(w.No_Rumah); })
      .reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
    return total < (settings.Nominal_Kas_Bulanan || 1);
  }).map(function (w) {
    return { No_Rumah: w.No_Rumah, Nama_Warga: w.Nama_Warga, No_HP: normalizeHp_(w.No_HP), Status: 'Belum Bayar' };
  });
}
function getLaporanMingguan(token, startDate, endDate) {
  requireAdmin_(token);
  const start = new Date(startDate), end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const masuk = getMasukInternal_().filter(function (t) { const d = new Date(t.Tanggal); return d >= start && d <= end && t.Status === 'Lunas'; });
  const keluar = getKeluarInternal_().filter(function (t) { const d = new Date(t.Tanggal); return d >= start && d <= end; });
  return buildLaporan_(masuk, keluar);
}
function getLaporanBulanan(token, bulan, tahun) {
  requireAdmin_(token);
  return laporanBulananInternal_(bulan, tahun);
}
function laporanBulananInternal_(bulan, tahun) {
  if (!periodeValid_(bulan, tahun)) return buildLaporan_([], []);
  const masuk = getMasukInternal_().filter(function (t) {
    return Number(t.Periode_Bulan) === Number(bulan) && Number(t.Periode_Tahun) === Number(tahun) && t.Status === 'Lunas';
  });
  const keluar = getKeluarInternal_().filter(function (t) {
    const d = new Date(t.Tanggal);
    return d.getMonth() + 1 === Number(bulan) && d.getFullYear() === Number(tahun);
  });
  return buildLaporan_(masuk, keluar);
}
function getLaporanTahunan(token, tahun) {
  requireAdmin_(token);
  const th = Number(tahun);
  const bulananArr = [];
  let saldo = getSaldoSebelumTahun_(th);
  for (let b = 1; b <= 12; b++) {
    const lap = laporanBulananInternal_(b, th);
    saldo += lap.totalMasuk - lap.totalKeluar;
    bulananArr.push({ bulan: BULAN_ID[b - 1], totalMasuk: lap.totalMasuk, totalKeluar: lap.totalKeluar, saldoMengendap: saldo });
  }
  const keluarTahun = getKeluarInternal_().filter(function (t) { return new Date(t.Tanggal).getFullYear() === th; });
  const katMap = {};
  keluarTahun.forEach(function (t) { katMap[t.Kategori_Pengeluaran] = (katMap[t.Kategori_Pengeluaran] || 0) + Number(t.Jumlah || 0); });
  return {
    tahun: th, bulananArr: bulananArr,
    totalMasukTahun: bulananArr.reduce(function (s, b) { return s + b.totalMasuk; }, 0),
    totalKeluarTahun: bulananArr.reduce(function (s, b) { return s + b.totalKeluar; }, 0),
    saldoAkhir: saldo,
    perKategoriTahun: Object.keys(katMap).map(function (k) { return { kategori: k, jumlah: katMap[k] }; })
  };
}
function getSaldoSebelumTahun_(tahun) {
  const masuk = getMasukInternal_().filter(function (t) { return Number(t.Periode_Tahun) < Number(tahun) && t.Status === 'Lunas'; })
    .reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
  const keluar = getKeluarInternal_().filter(function (t) { return new Date(t.Tanggal).getFullYear() < Number(tahun); })
    .reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0);
  return masuk - keluar;
}
function buildLaporan_(masuk, keluar) {
  const totalMasuk = masuk.reduce(function (s, t) { return s + Number(t.Jumlah_Bayar || 0); }, 0);
  const totalKeluar = keluar.reduce(function (s, t) { return s + Number(t.Jumlah || 0); }, 0);
  const kategoriMap = {}, jenisMap = {};
  keluar.forEach(function (t) { kategoriMap[t.Kategori_Pengeluaran] = (kategoriMap[t.Kategori_Pengeluaran] || 0) + Number(t.Jumlah || 0); });
  masuk.forEach(function (t) { jenisMap[t.Jenis_Iuran] = (jenisMap[t.Jenis_Iuran] || 0) + Number(t.Jumlah_Bayar || 0); });
  return {
    totalMasuk: totalMasuk, totalKeluar: totalKeluar, saldoBersih: totalMasuk - totalKeluar,
    rincianMasuk: masuk, rincianKeluar: keluar,
    perKategoriKeluar: Object.keys(kategoriMap).map(function (k) { return { kategori: k, jumlah: kategoriMap[k] }; }),
    perJenisMasuk: Object.keys(jenisMap).map(function (k) { return { jenis: k, jumlah: jenisMap[k] }; })
  };
}
function exportLaporanToSheet(token, judul, headers, rows) {
  requireAdmin_(token);
  return withLock_(function () {
    const ss = getSS();
    const name = ('Export_' + judul).substring(0, 90);
    let sh = ss.getSheetByName(name);
    if (sh) ss.deleteSheet(sh);
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    styleHeader_(sh, headers.length);
    if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sh.autoResizeColumns(1, headers.length);
    return { ok: true, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
  });
}

// ========================================================
//  GALERI KEGIATAN WARGA
// ========================================================
function getGaleriList(token, kategoriFilter) {
  const profil = requireAktif_(token);
  const isAdmin = profil.Role === 'admin';
  const album = rows_(SHEET_GALERI)
    .filter(function (g) { return isAdmin || g.Status === 'Aktif'; })
    .filter(function (g) { return !kategoriFilter || g.Kategori === kategoriFilter; });
  const foto = rows_(SHEET_FOTO);
  return album
    .map(function (g) {
      const daftar = foto
        .filter(function (f) { return String(f.ID_Galeri) === String(g.ID_Galeri); })
        .sort(function (a, b) { return Number(a.Urutan || 0) - Number(b.Urutan || 0); })
        .map(function (f) {
          return {
            ID_Foto: f.ID_Foto, Nama_File: f.Nama_File, URL_Foto: f.URL_Foto,
            ID_File_Drive: f.ID_File_Drive, Urutan: Number(f.Urutan || 0),
            Tanggal_Upload: f.Tanggal_Upload ? fmtDate_(f.Tanggal_Upload) : ''
          };
        });
      return {
        ID_Galeri: g.ID_Galeri, Judul_Kegiatan: g.Judul_Kegiatan, Kategori: g.Kategori || 'Kegiatan lainnya',
        Deskripsi: g.Deskripsi || '', Tanggal_Kegiatan: g.Tanggal_Kegiatan ? fmtDate_(g.Tanggal_Kegiatan) : '',
        Dibuat_Oleh: g.Dibuat_Oleh || '', Tanggal_Dibuat: g.Tanggal_Dibuat ? fmtDate_(g.Tanggal_Dibuat) : '',
        Status: g.Status || 'Aktif',
        Foto: daftar, Jumlah_Foto: daftar.length,
        Cover: daftar.length ? daftar[0].URL_Foto : ''
      };
    })
    .sort(function (a, b) { return String(b.Tanggal_Kegiatan).localeCompare(String(a.Tanggal_Kegiatan)); });
}
function getGaleriKategori() {
  const dariSheet = rows_(SHEET_GALERI).map(function (g) { return g.Kategori; }).filter(Boolean);
  const gabung = KATEGORI_GALERI_DEFAULT.concat(dariSheet);
  const unik = [];
  gabung.forEach(function (k) { if (k && unik.indexOf(k) === -1) unik.push(k); });
  return unik;
}
function addGaleri(token, data) {
  const admin = requireAdmin_(token);
  if (!data.Judul_Kegiatan) throw new Error('Judul kegiatan wajib diisi.');
  return withLock_(function () {
    const id = generateId('GAL');
    appendObj_(SHEET_GALERI, {
      ID_Galeri: id, Judul_Kegiatan: data.Judul_Kegiatan,
      Kategori: data.Kategori || 'Kegiatan lainnya',
      Deskripsi: data.Deskripsi || '',
      Tanggal_Kegiatan: data.Tanggal_Kegiatan ? new Date(data.Tanggal_Kegiatan) : new Date(),
      Dibuat_Oleh: admin.Email || admin.Nama || 'admin',
      Tanggal_Dibuat: new Date(),
      Status: data.Status || 'Aktif'
    });
    return { ok: true, id: id };
  });
}
function updateGaleri(token, id, data) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_GALERI, 'ID_Galeri', id);
    if (row === -1) throw new Error('Album tidak ditemukan.');
    const patch = {};
    if (data.Judul_Kegiatan !== undefined) patch.Judul_Kegiatan = data.Judul_Kegiatan;
    if (data.Kategori !== undefined) patch.Kategori = data.Kategori;
    if (data.Deskripsi !== undefined) patch.Deskripsi = data.Deskripsi;
    if (data.Tanggal_Kegiatan !== undefined) patch.Tanggal_Kegiatan = data.Tanggal_Kegiatan ? new Date(data.Tanggal_Kegiatan) : new Date();
    if (data.Status !== undefined) patch.Status = data.Status;
    updateRow_(SHEET_GALERI, row, patch);
    return { ok: true };
  });
}
function deleteGaleri(token, id) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_GALERI, 'ID_Galeri', id);
    if (row === -1) throw new Error('Album tidak ditemukan.');
    const foto = rows_(SHEET_FOTO).filter(function (f) { return String(f.ID_Galeri) === String(id); });
    foto.forEach(function (f) { hapusFotoDrive_(f.URL_Foto); });
    foto.sort(function (a, b) { return b._row - a._row; }).forEach(function (f) { deleteRow_(SHEET_FOTO, f._row); });
    deleteRow_(SHEET_GALERI, row);
    return { ok: true };
  });
}
function uploadFotoGaleri(token, idGaleri, base64Data, filename, mimeType) {
  const admin = requireAdmin_(token);
  if (!base64Data) throw new Error('Tidak ada berkas yang diunggah.');
  const mime = String(mimeType || '').toLowerCase();
  if (MIME_GAMBAR.indexOf(mime) === -1) throw new Error('Foto harus berformat JPG, PNG, atau WebP.');
  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_GALERI_BYTES) throw new Error('Ukuran foto maksimal 5 MB.');
  return withLock_(function () {
    const galeri = rows_(SHEET_GALERI).find(function (g) { return String(g.ID_Galeri) === String(idGaleri); });
    if (!galeri) throw new Error('Album tidak ditemukan.');
    const folderInduk = getOrCreateFolder_(DRIVE_FOLDER_GALERI);
    const namaFolder = String(galeri.ID_Galeri + ' - ' + (galeri.Judul_Kegiatan || 'Album')).substring(0, 80);
    let folder;
    const it = folderInduk.getFoldersByName(namaFolder);
    folder = it.hasNext() ? it.next() : folderInduk.createFolder(namaFolder);
    const ext = mime.split('/')[1].replace('jpeg', 'jpg');
    const namaFile = 'foto-' + Date.now() + '-' + Math.floor(Math.random() * 900 + 100) + '.' + ext;
    const file = folder.createFile(Utilities.newBlob(bytes, mime, namaFile));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
    const urutSekarang = rows_(SHEET_FOTO).filter(function (f) { return String(f.ID_Galeri) === String(idGaleri); }).length + 1;
    const id = generateId('FOT');
    appendObj_(SHEET_FOTO, {
      ID_Foto: id, ID_Galeri: idGaleri, Nama_File: namaFile, URL_Foto: url,
      ID_File_Drive: file.getId(), Urutan: urutSekarang, Tanggal_Upload: new Date(),
      Diupload_Oleh: admin.Email || admin.Nama || 'admin'
    });
    return { ok: true, id: id, url: url, ID_File_Drive: file.getId() };
  });
}
function deleteFotoGaleri(token, idFoto) {
  requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_FOTO, 'ID_Foto', idFoto);
    if (row === -1) throw new Error('Foto tidak ditemukan.');
    const foto = rows_(SHEET_FOTO).find(function (f) { return String(f.ID_Foto) === String(idFoto); });
    if (foto && foto.URL_Foto) hapusFotoDrive_(foto.URL_Foto);
    deleteRow_(SHEET_FOTO, row);
    return { ok: true };
  });
}

// ========================================================
//  CHAT ADMIN ↔ WARGA
// ========================================================
function idPercakapanWarga_(email) { return 'CW-' + String(email || '').toLowerCase(); }

function hitungChatBelumDibacaAdmin_() {
  return rows_(SHEET_CHAT).filter(function (c) {
    return c.Role_Pengirim === 'warga' && !bool_(c.Status_Baca);
  }).length;
}
/** Pesan dari bendahara yang belum dibaca oleh warga tertentu. */
function hitungChatBelumDibacaWarga_(email) {
  const id = idPercakapanWarga_(email);
  return rows_(SHEET_CHAT).filter(function (c) {
    return String(c.ID_Percakapan) === String(id) &&
           c.Role_Pengirim === 'admin' && !bool_(c.Status_Baca);
  }).length;
}
function updateHeartbeat(token) {
  const s = getSesi_(token);
  if (!s || s.pin) return { ok: true };
  return withLock_(function () {
    const a = getAkunByEmail_(s.email);
    if (!a) return { ok: false };
    updateRow_(SHEET_AKUN, a._row, { Last_Aktif: new Date() });
    return { ok: true };
  });
}
function statusOnlineEmail_(email) {
  const a = getAkunByEmail_(email);
  if (!a || !a.Last_Aktif) return { online: false, terakhir: '' };
  const terakhir = new Date(a.Last_Aktif).getTime();
  const online = (Date.now() - terakhir) < ONLINE_WINDOW_MS;
  return { online: online, terakhir: a.Last_Aktif ? fmtDate_(a.Last_Aktif) : '' };
}
function adaAdminOnline_() {
  return getAkunList_().some(function (a) {
    return a.Role === 'admin' && a.Status === 'Aktif' && a.Last_Aktif &&
           (Date.now() - new Date(a.Last_Aktif).getTime() < ONLINE_WINDOW_MS);
  });
}
function getChatPercakapanAdmin(token) {
  requireAdmin_(token);
  const semua = rows_(SHEET_CHAT);
  const map = {};
  semua.forEach(function (c) {
    const id = c.ID_Percakapan;
    if (!id) return;
    if (!map[id]) {
      const emailWarga = id.replace(/^CW-/, '');
      const akun = getAkunByEmail_(emailWarga);
      map[id] = {
        ID_Percakapan: id,
        Email_Warga: emailWarga,
        Nama_Warga: akun ? (akun.Nama || emailWarga) : emailWarga,
        No_Rumah: akun ? akun.No_Rumah : '',
        Avatar: akun ? (akun.Foto_URL || akun.Foto || '') : '',
        Terakhir: '',
        Pesan_Terakhir: '',
        Belum_Dibaca: 0,
        Total_Pesan: 0
      };
    }
    const ts = c.Waktu_Kirim ? new Date(c.Waktu_Kirim).getTime() : 0;
    const tsTerakhir = map[id].Terakhir ? new Date(map[id].Terakhir).getTime() : 0;
    if (ts > tsTerakhir) {
      map[id].Terakhir = c.Waktu_Kirim;
      map[id].Pesan_Terakhir = String(c.Isi_Pesan || '').substring(0, 80);
    }
    if (c.Role_Pengirim === 'warga' && !bool_(c.Status_Baca)) map[id].Belum_Dibaca++;
    map[id].Total_Pesan++;
  });
  return Object.keys(map).map(function (k) {
    const x = map[k];
    const st = statusOnlineEmail_(x.Email_Warga);
    x.Online = st.online;
    x.Last_Aktif = st.terakhir;
    x.Terakhir = x.Terakhir ? fmtDate_(x.Terakhir) : '';
    return x;
  }).sort(function (a, b) {
    if (a.Belum_Dibaca !== b.Belum_Dibaca) return b.Belum_Dibaca - a.Belum_Dibaca;
    return String(b.Terakhir).localeCompare(String(a.Terakhir));
  });
}
function getChatPercakapanSaya(token) {
  const p = requireAktif_(token);
  return getChatPesanInternal_(idPercakapanWarga_(p.Email));
}
function getChatPesanInternal_(idPercakapan) {
  return rows_(SHEET_CHAT)
    .filter(function (c) { return String(c.ID_Percakapan) === String(idPercakapan); })
    .map(function (c) {
      return {
        ID_Pesan: c.ID_Pesan, ID_Percakapan: c.ID_Percakapan,
        Email_Pengirim: c.Email_Pengirim, Nama_Pengirim: c.Nama_Pengirim,
        Role_Pengirim: c.Role_Pengirim, Email_Penerima: c.Email_Penerima,
        Isi_Pesan: c.Isi_Pesan || '', URL_Lampiran: c.URL_Lampiran || '',
        Waktu_Kirim: c.Waktu_Kirim ? new Date(c.Waktu_Kirim).toISOString() : '',
        Status_Baca: bool_(c.Status_Baca)
      };
    })
    .sort(function (a, b) { return String(a.Waktu_Kirim).localeCompare(String(b.Waktu_Kirim)); });
}
/**
 * Dipakai dua arah:
 *  - admin memanggil dengan email warga
 *  - warga memanggil dengan 'admin' untuk mengetahui status bendahara
 */
function getChatAdminDenganWarga(token, emailWarga) {
  const p = requireAktif_(token);
  if (String(emailWarga).toLowerCase() === 'admin') {
    return { ID_Percakapan: idPercakapanWarga_(p.Email), Pesan: [], Online: adaAdminOnline_(), Last_Aktif: '' };
  }
  requireAdmin_(token);
  const id = idPercakapanWarga_(emailWarga);
  const status = statusOnlineEmail_(emailWarga);
  return { ID_Percakapan: id, Pesan: getChatPesanInternal_(id), Online: status.online, Last_Aktif: status.terakhir };
}
function kirimPesanChat(token, data) {
  const p = requireAktif_(token);
  if (!data || !String(data.Isi_Pesan || '').trim()) {
    if (!data || !data.URL_Lampiran) throw new Error('Tulis pesan atau lampirkan berkas dulu.');
  }
  if (String(data.Isi_Pesan || '').length > 2000) throw new Error('Pesan terlalu panjang (maksimal 2000 karakter).');
  return withLock_(function () {
    const idPercakapan = p.Role === 'admin'
      ? idPercakapanWarga_(data.Email_Lawan || data.Email_Penerima || '')
      : idPercakapanWarga_(p.Email);
    if (!idPercakapan || idPercakapan === 'CW-') throw new Error('Pilih warga tujuan lebih dulu.');
    const lawan = p.Role === 'admin' ? String(data.Email_Lawan || '').toLowerCase() : '';
    const id = generateId('MSG');
    appendObj_(SHEET_CHAT, {
      ID_Pesan: id, ID_Percakapan: idPercakapan,
      Email_Pengirim: (p.Email || '').toLowerCase(),
      Nama_Pengirim: p.Nama || (p.Role === 'admin' ? 'Bendahara' : ''),
      Role_Pengirim: p.Role,
      Email_Penerima: p.Role === 'admin' ? lawan : 'admin',
      Isi_Pesan: String(data.Isi_Pesan || '').trim(),
      URL_Lampiran: data.URL_Lampiran || '',
      Waktu_Kirim: new Date(),
      Status_Baca: false
    });
    try {
      const akun = getAkunByEmail_((p.Email || '').toLowerCase());
      if (akun) updateRow_(SHEET_AKUN, akun._row, { Last_Aktif: new Date() });
    } catch (e) {}
    return { ok: true, id: id };
  });
}
function tandaiChatDibaca(token, idPercakapan) {
  const p = requireAktif_(token);
  return withLock_(function () {
    const list = rows_(SHEET_CHAT).filter(function (c) {
      if (String(c.ID_Percakapan) !== String(idPercakapan)) return false;
      if (bool_(c.Status_Baca)) return false;
      if (p.Role === 'admin') return c.Role_Pengirim === 'warga';
      return c.Role_Pengirim === 'admin';
    });
    list.forEach(function (c) { updateRow_(SHEET_CHAT, c._row, { Status_Baca: true }); });
    return { ok: true, jumlah: list.length };
  });
}
function hapusPercakapan(token, idPercakapan) {
  requireAdmin_(token);
  return withLock_(function () {
    const list = rows_(SHEET_CHAT).filter(function (c) { return String(c.ID_Percakapan) === String(idPercakapan); });
    list.sort(function (a, b) { return b._row - a._row; }).forEach(function (c) { deleteRow_(SHEET_CHAT, c._row); });
    return { ok: true };
  });
}
function uploadLampiranChat(token, base64Data, filename, mimeType) {
  requireAktif_(token);
  if (!base64Data) throw new Error('Tidak ada berkas.');
  const bytes = Utilities.base64Decode(base64Data);
  if (bytes.length > MAX_BUKTI_BYTES) throw new Error('Ukuran lampiran maksimal 8 MB.');
  const mime = String(mimeType || '').toLowerCase();
  if (MIME_GAMBAR.indexOf(mime) === -1 && mime !== 'application/pdf') throw new Error('Lampiran harus gambar atau PDF.');
  const folder = getOrCreateFolder_(DRIVE_FOLDER_BUKTI);
  const file = folder.createFile(Utilities.newBlob(bytes, mime, filename || ('lampiran-' + Date.now())));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: file.getUrl(), fileId: file.getId() };
}

// ========================================================
//  PENGAJUAN PINDAH BLOK RUMAH
// ========================================================
function ajukanPindahBlok(token, data) {
  const p = requireAktif_(token);
  if (!p.No_Rumah) throw new Error('Akun Anda belum ditautkan ke rumah. Hubungi bendahara.');
  if (!data.Blok_Tujuan || !data.No_Rumah_Tujuan) throw new Error('Blok dan nomor rumah tujuan wajib diisi.');
  const tujuan = rumah_(data.No_Rumah_Tujuan);
  if (tujuan === rumah_(p.No_Rumah)) throw new Error('Tujuan sama dengan rumah sekarang.');
  return withLock_(function () {
    const adaPending = rows_(SHEET_PINDAH).some(function (x) {
      return String(x.Email_Pemohon).toLowerCase() === String(p.Email).toLowerCase() && x.Status === 'Menunggu';
    });
    if (adaPending) throw new Error('Masih ada pengajuan pindah yang menunggu diproses.');
    const dipakai = getAkunList_().find(function (x) {
      return rumah_(x.No_Rumah) === tujuan && String(x.Email).toLowerCase() !== String(p.Email).toLowerCase() && x.Status === 'Aktif';
    });
    if (dipakai) throw new Error('Rumah tujuan sudah tertaut ke akun lain.');
    const id = generateId('PBP');
    appendObj_(SHEET_PINDAH, {
      ID_Pengajuan: id,
      Email_Pemohon: p.Email, Nama_Pemohon: p.Nama || '',
      Blok_Asal: blokDariRumah_(p.No_Rumah), No_Rumah_Asal: rumah_(p.No_Rumah),
      Blok_Tujuan: String(data.Blok_Tujuan || '').toUpperCase().trim(),
      No_Rumah_Tujuan: tujuan,
      Alasan: String(data.Alasan || '').substring(0, 500),
      Tanggal_Pengajuan: new Date(),
      Status: 'Menunggu',
      Catatan_Admin: '', Diproses_Oleh: '', Tanggal_Diproses: '',
      Dokumen_URL: data.Dokumen_URL || ''
    });
    try {
      const admins = getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif' && a.Email; });
      if (admins.length) {
        MailApp.sendEmail({
          to: admins.map(function (a) { return a.Email; }).join(','),
          subject: 'Pengajuan pindah blok: ' + p.No_Rumah + ' → ' + tujuan,
          body: 'Pengajuan pindah blok dari ' + (p.Nama || p.Email) + '\nDari: ' + p.No_Rumah + '\nKe: ' + tujuan + '\nAlasan: ' + (data.Alasan || '-')
        });
      }
    } catch (e) {}
    return { ok: true, id: id };
  });
}
function batalkanPindahBlok(token, idPengajuan) {
  const p = requireAktif_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_PINDAH, 'ID_Pengajuan', idPengajuan);
    if (row === -1) throw new Error('Pengajuan tidak ditemukan.');
    const x = rows_(SHEET_PINDAH).find(function (r) { return String(r.ID_Pengajuan) === String(idPengajuan); });
    if (String(x.Email_Pemohon).toLowerCase() !== String(p.Email).toLowerCase()) throw new Error('Bukan pengajuan Anda.');
    if (x.Status !== 'Menunggu') throw new Error('Pengajuan sudah diproses, tidak bisa dibatalkan.');
    updateRow_(SHEET_PINDAH, row, { Status: 'Dibatalkan', Tanggal_Diproses: new Date() });
    return { ok: true };
  });
}
function getPengajuanPindahSaya(token) {
  const p = requireAktif_(token);
  return rows_(SHEET_PINDAH)
    .filter(function (x) { return String(x.Email_Pemohon).toLowerCase() === String(p.Email).toLowerCase(); })
    .map(function (x) {
      return {
        ID_Pengajuan: x.ID_Pengajuan, Blok_Asal: x.Blok_Asal, No_Rumah_Asal: x.No_Rumah_Asal,
        Blok_Tujuan: x.Blok_Tujuan, No_Rumah_Tujuan: x.No_Rumah_Tujuan, Alasan: x.Alasan,
        Tanggal_Pengajuan: x.Tanggal_Pengajuan ? fmtDate_(x.Tanggal_Pengajuan) : '',
        Status: x.Status, Catatan_Admin: x.Catatan_Admin || '',
        Tanggal_Diproses: x.Tanggal_Diproses ? fmtDate_(x.Tanggal_Diproses) : '',
        Dokumen_URL: x.Dokumen_URL || ''
      };
    })
    .sort(function (a, b) { return String(b.Tanggal_Pengajuan).localeCompare(String(a.Tanggal_Pengajuan)); });
}
function getPengajuanPindah(token) {
  requireAdmin_(token);
  return rows_(SHEET_PINDAH).map(function (x) {
    return {
      ID_Pengajuan: x.ID_Pengajuan, Email_Pemohon: x.Email_Pemohon, Nama_Pemohon: x.Nama_Pemohon,
      Blok_Asal: x.Blok_Asal, No_Rumah_Asal: x.No_Rumah_Asal,
      Blok_Tujuan: x.Blok_Tujuan, No_Rumah_Tujuan: x.No_Rumah_Tujuan,
      Alasan: x.Alasan, Tanggal_Pengajuan: x.Tanggal_Pengajuan ? fmtDate_(x.Tanggal_Pengajuan) : '',
      Status: x.Status, Catatan_Admin: x.Catatan_Admin || '',
      Diproses_Oleh: x.Diproses_Oleh || '',
      Tanggal_Diproses: x.Tanggal_Diproses ? fmtDate_(x.Tanggal_Diproses) : '',
      Dokumen_URL: x.Dokumen_URL || ''
    };
  }).sort(function (a, b) {
    const urutan = { 'Menunggu': 0, 'Disetujui': 1, 'Ditolak': 2, 'Dibatalkan': 3 };
    const d = (urutan[a.Status] === undefined ? 9 : urutan[a.Status]) - (urutan[b.Status] === undefined ? 9 : urutan[b.Status]);
    return d !== 0 ? d : String(b.Tanggal_Pengajuan).localeCompare(String(a.Tanggal_Pengajuan));
  });
}
function putuskanPindahBlok(token, idPengajuan, setuju, catatan) {
  const admin = requireAdmin_(token);
  return withLock_(function () {
    const row = cariRow_(SHEET_PINDAH, 'ID_Pengajuan', idPengajuan);
    if (row === -1) throw new Error('Pengajuan tidak ditemukan.');
    const x = rows_(SHEET_PINDAH).find(function (r) { return String(r.ID_Pengajuan) === String(idPengajuan); });
    if (x.Status !== 'Menunggu') throw new Error('Pengajuan sudah diproses.');
    if (!setuju) {
      updateRow_(SHEET_PINDAH, row, {
        Status: 'Ditolak',
        Catatan_Admin: String(catatan || '').substring(0, 500),
        Diproses_Oleh: admin.Email || admin.Nama || 'admin',
        Tanggal_Diproses: new Date()
      });
      try {
        MailApp.sendEmail({
          to: x.Email_Pemohon,
          subject: 'Pengajuan pindah blok ditolak',
          body: 'Pengajuan pindah blok Anda ditolak.' + (catatan ? '\n\nCatatan: ' + catatan : '')
        });
      } catch (e) {}
      return { ok: true, disetujui: false };
    }
    const tujuan = rumah_(x.No_Rumah_Tujuan);
    const dipakai = getAkunList_().find(function (a) {
      return rumah_(a.No_Rumah) === tujuan && String(a.Email).toLowerCase() !== String(x.Email_Pemohon).toLowerCase() && a.Status === 'Aktif';
    });
    if (dipakai) throw new Error('Rumah tujuan sudah dipakai akun lain.');
    const akun = getAkunByEmail_(x.Email_Pemohon);
    if (!akun) throw new Error('Akun pemohon tidak ditemukan.');
    updateRow_(SHEET_AKUN, akun._row, { No_Rumah: tujuan, Rumah_Diminta: '', Alasan_Pindah: '' });
    sinkronWargaDariAkun_(tujuan, akun.Nama, akun.No_HP);
    updateRow_(SHEET_PINDAH, row, {
      Status: 'Disetujui',
      Catatan_Admin: String(catatan || '').substring(0, 500),
      Diproses_Oleh: admin.Email || admin.Nama || 'admin',
      Tanggal_Diproses: new Date()
    });
    try {
      MailApp.sendEmail({
        to: x.Email_Pemohon,
        subject: 'Pengajuan pindah blok disetujui',
        body: 'Pengajuan pindah blok Anda disetujui.\nDari: ' + x.No_Rumah_Asal + '\nKe: ' + tujuan + (catatan ? '\n\nCatatan: ' + catatan : '')
      });
    } catch (e) {}
    return { ok: true, disetujui: true, No_Rumah: tujuan };
  });
}

// ============================= PEMELIHARAAN =============================
function bersihkanSesiKedaluwarsa() {
  const all = props_().getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('SESS::') === 0) {
      try { if (JSON.parse(all[k]).exp < Date.now()) props_().deleteProperty(k); }
      catch (e) { props_().deleteProperty(k); }
    }
    if (k.indexOf('OAUTH::') === 0) {
      try { if (Date.now() - JSON.parse(all[k]).created > 15 * 60 * 1000) props_().deleteProperty(k); }
      catch (e) { props_().deleteProperty(k); }
    }
  });
}
function diagnosa() {
  resetCache_();
  const out = [];
  Object.keys(HEADERS).forEach(function (nama) {
    const sh = getSS().getSheetByName(nama);
    if (!sh) { out.push('HILANG: sheet ' + nama); return; }
    const map = colMap_(sh);
    const kurang = HEADERS[nama].filter(function (h) { return !map[h]; });
    out.push(nama + ': ' + (sh.getLastRow() - 1) + ' baris' + (kurang.length ? ' — kolom kurang: ' + kurang.join(', ') : ' — kolom lengkap'));
  });
  out.push('Login Google: ' + (props_().getProperty('GOOGLE_CLIENT_ID') ? 'aktif' : 'belum diisi'));
  out.push('Gateway WA: ' + (props_().getProperty('FONNTE_TOKEN') ? 'aktif' : 'belum diisi'));
  out.push('Bendahara aktif: ' + getAkunList_().filter(function (a) { return a.Role === 'admin' && a.Status === 'Aktif'; }).length);
  out.push('Chat belum dibaca (bendahara): ' + hitungChatBelumDibacaAdmin_());
  return out.join('\n');
}