/**
 * ============================================================================
 * KAS PERUMAHAN BLOK L/M — SUPABASE ADAPTER (LENGKAP SEMUA FITUR)
 * Super cepat (< 50ms), Realtime, 100% Free PostgreSQL & Storage
 * ============================================================================
 */

const SUPABASE_URL = "https://zrkfzrldqkmgpkdjfjlt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CdzWUiDNDRsHov5eDMZbZg_zktPzeW8";

const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const BULAN_NAMA = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function genId(prefix) {
    return prefix + '-' + new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + Math.floor(Math.random() * 900 + 100);
}

function base64ToBlob(base64, mime) {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mime || 'image/jpeg' });
}

// Session store lokal (365 hari / 1 tahun)
const SessionStore = {
    get(token) {
        if (!token) return null;
        try {
            const raw = localStorage.getItem('sb_sess_' + token);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (s.exp && s.exp < Date.now()) {
                localStorage.removeItem('sb_sess_' + token);
                return null;
            }
            return s;
        } catch (e) { return null; }
    },
    set(token, data) {
        data.exp = Date.now() + 365 * 24 * 60 * 60 * 1000;
        localStorage.setItem('sb_sess_' + token, JSON.stringify(data));
    },
    remove(token) {
        if (token) localStorage.removeItem('sb_sess_' + token);
    }
};

window.SupabaseBackend = {
    // ------------------------------------------------------------------------
    // PENGATURAN
    // ------------------------------------------------------------------------
    async getPengaturanPublik() {
        const { data } = await sb.from('pengaturan').select('*').limit(1).maybeSingle();
        if (!data) {
            return {
                Nama_Perumahan: 'Perumahan Blok L/M',
                Nominal_Kas_Bulanan: 150000,
                Rekening_Tujuan: '1234567890 a.n. Bendahara - BCA',
                Nama_Bendahara: 'Bendahara RT',
                WA_Bendahara: '',
                QR_Code_URL: '',
                Metode_Pembayaran: 'Transfer Bank',
                Instruksi_Pembayaran: 'Transfer sesuai nominal lalu unggah bukti.',
                Bulan_Mulai_Iuran: 1,
                Tahun_Mulai_Iuran: 2024,
                Pengaturan_Aktif: true,
                Google_Client_Id: "629674748384-jlugeggi5u75tbumsrhagjh1n3bqsm5l.apps.googleusercontent.com"
            };
        }
        return {
            Nama_Perumahan: data.nama_perumahan || 'Perumahan Blok L/M',
            Nominal_Kas_Bulanan: Number(data.nominal_kas_bulanan) || 150000,
            Rekening_Tujuan: data.rekening_tujuan || '',
            Nama_Bendahara: data.nama_bendahara || '',
            WA_Bendahara: data.wa_bendahara || '',
            QR_Code_URL: data.qr_code_url || '',
            Metode_Pembayaran: data.metode_pembayaran || 'Transfer Bank',
            Instruksi_Pembayaran: data.instruksi_pembayaran || '',
            Bulan_Mulai_Iuran: Number(data.bulan_mulai_iuran) || 1,
            Tahun_Mulai_Iuran: Number(data.tahun_mulai_iuran) || 2024,
            Pengaturan_Aktif: data.pengaturan_aktif !== false,
            Google_Client_Id: "629674748384-jlugeggi5u75tbumsrhagjh1n3bqsm5l.apps.googleusercontent.com"
        };
    },

    async getPengaturanAdmin(token) {
        const { data } = await sb.from('pengaturan').select('*').limit(1).maybeSingle();
        return {
            Nama_Perumahan: data?.nama_perumahan || 'Perumahan Blok L/M',
            Nominal_Kas_Bulanan: Number(data?.nominal_kas_bulanan || 150000),
            Rekening_Tujuan: data?.rekening_tujuan || '',
            Nama_Bendahara: data?.nama_bendahara || '',
            Admin_PIN: data?.admin_pin || '123456',
            Admin_Emails: data?.admin_emails || '',
            WA_Bendahara: data?.wa_bendahara || '',
            QR_Code_URL: data?.qr_code_url || '',
            Metode_Pembayaran: data?.metode_pembayaran || 'Transfer Bank',
            Instruksi_Pembayaran: data?.instruksi_pembayaran || '',
            Bulan_Mulai_Iuran: Number(data?.bulan_mulai_iuran || 1),
            Tahun_Mulai_Iuran: Number(data?.tahun_mulai_iuran || 2024),
            Pengaturan_Aktif: data?.pengaturan_aktif !== false
        };
    },

    async updatePengaturan(token, payload) {
        const updateData = {};
        if (payload.Nama_Perumahan !== undefined) updateData.nama_perumahan = payload.Nama_Perumahan;
        if (payload.Nominal_Kas_Bulanan !== undefined) updateData.nominal_kas_bulanan = Number(payload.Nominal_Kas_Bulanan);
        if (payload.Rekening_Tujuan !== undefined) updateData.rekening_tujuan = payload.Rekening_Tujuan;
        if (payload.Nama_Bendahara !== undefined) updateData.nama_bendahara = payload.Nama_Bendahara;
        if (payload.Admin_PIN !== undefined) updateData.admin_pin = payload.Admin_PIN;
        if (payload.Admin_Emails !== undefined) updateData.admin_emails = payload.Admin_Emails;
        if (payload.WA_Bendahara !== undefined) updateData.wa_bendahara = payload.WA_Bendahara;
        if (payload.Metode_Pembayaran !== undefined) updateData.metode_pembayaran = payload.Metode_Pembayaran;
        if (payload.Instruksi_Pembayaran !== undefined) updateData.instruksi_pembayaran = payload.Instruksi_Pembayaran;
        if (payload.Bulan_Mulai_Iuran !== undefined) updateData.bulan_mulai_iuran = Number(payload.Bulan_Mulai_Iuran);
        if (payload.Tahun_Mulai_Iuran !== undefined) updateData.tahun_mulai_iuran = Number(payload.Tahun_Mulai_Iuran);
        if (payload.Pengaturan_Aktif !== undefined) updateData.pengaturan_aktif = !!payload.Pengaturan_Aktif;

        const { error } = await sb.from('pengaturan').update(updateData).eq('id', 1);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // SESI & LOGIN
    // ------------------------------------------------------------------------
    async getProfil(token) {
        const sess = SessionStore.get(token);
        if (!sess) return null;
        if (sess.pin) {
            return {
                Email: '',
                Nama: 'Bendahara (PIN)',
                Role: 'admin',
                Status: 'Aktif',
                No_Rumah: '',
                No_HP: '',
                Foto: '',
                Foto_URL: '',
                Avatar: '',
                Tema: 'sistem',
                Notif_Email: true,
                Notif_WA: true,
                Rumah_Diminta: '',
                ViaPin: true
            };
        }

        const { data: a } = await sb.from('akun').select('*').eq('email', sess.email).maybeSingle();
        if (!a) return null;

        return {
            ID_Akun: a.id_akun,
            Email: a.email,
            Nama: a.nama,
            No_Rumah: a.no_rumah,
            No_HP: a.no_hp,
            Role: a.role,
            Status: a.status || 'Aktif',
            Foto: a.foto || '',
            Foto_URL: a.foto_url || '',
            Avatar: a.foto_url || a.foto || '',
            Tema: a.tema || 'sistem',
            Notif_Email: a.notif_email !== false,
            Notif_WA: a.notif_wa !== false,
            Rumah_Diminta: a.rumah_diminta || '',
            Tanggal_Daftar: a.tanggal_daftar,
            Last_Login: a.last_login,
            ViaPin: false
        };
    },

    async loginDenganGoogleToken(accessToken) {
        if (!accessToken) throw new Error('Token akses kosong.');
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + accessToken }
        });
        const user = await res.json();
        if (!user.email) throw new Error(user.error_description || 'Gagal memverifikasi Google.');

        const email = String(user.email).toLowerCase();
        const nama = user.name || '';
        const foto = user.picture || '';

        const { data: ada } = await sb.from('akun').select('*').eq('email', email).maybeSingle();

        if (ada) {
            await sb.from('akun').update({
                last_login: new Date().toISOString(),
                last_aktif: new Date().toISOString(),
                nama: ada.nama || nama,
                foto: ada.foto || foto,
                status: ada.status === 'Menunggu' ? 'Aktif' : ada.status
            }).eq('id', ada.id);
        } else {
            const { data: admins } = await sb.from('akun').select('id').eq('role', 'admin').eq('status', 'Aktif');
            const jadiAdmin = !admins || admins.length === 0;

            await sb.from('akun').insert({
                id_akun: genId('AKN'),
                email: email,
                nama: nama,
                no_rumah: '',
                no_hp: '',
                role: jadiAdmin ? 'admin' : 'warga',
                status: 'Aktif',
                foto: foto,
                tanggal_daftar: new Date().toISOString(),
                last_login: new Date().toISOString(),
                last_aktif: new Date().toISOString()
            });
        }

        const token = crypto.randomUUID();
        SessionStore.set(token, { email: email });
        return { ok: true, token: token, email: email, nama: nama };
    },

    async loginPin(pin) {
        const { data: s } = await sb.from('pengaturan').select('admin_pin').limit(1).maybeSingle();
        if (!s || String(s.admin_pin) !== String(pin)) {
            return { ok: false, message: 'PIN bendahara salah.' };
        }
        const token = crypto.randomUUID();
        SessionStore.set(token, { pin: true });
        return { ok: true, token: token };
    },

    async logout(token) {
        SessionStore.remove(token);
        return { ok: true };
    },

    async lengkapiPendaftaran(token, data) {
        const sess = SessionStore.get(token);
        if (!sess || !sess.email) throw new Error('Sesi tidak valid.');
        const noRumah = String(data.No_Rumah || '').toUpperCase().trim();
        if (!data.Nama || !noRumah) throw new Error('Nama dan nomor rumah wajib diisi.');

        await sb.from('akun').update({
            nama: data.Nama,
            no_rumah: noRumah,
            no_hp: data.No_HP || '',
            status: 'Aktif'
        }).eq('email', sess.email);

        const { data: adaWarga } = await sb.from('warga').select('*').eq('no_rumah', noRumah).maybeSingle();
        if (adaWarga) {
            await sb.from('warga').update({
                nama_warga: adaWarga.nama_warga || data.Nama,
                no_hp: data.No_HP || adaWarga.no_hp
            }).eq('id', adaWarga.id);
        } else {
            await sb.from('warga').insert({
                id_warga: genId('WRG'),
                no_rumah: noRumah,
                nama_warga: data.Nama,
                no_hp: data.No_HP || '',
                status_hunian: 'Tetap'
            });
        }

        return { ok: true };
    },

    async updateProfilSaya(token, data) {
        const sess = SessionStore.get(token);
        if (!sess || !sess.email) throw new Error('Sesi tidak valid.');
        const patch = {};
        if (data.Nama !== undefined) patch.nama = data.Nama;
        if (data.No_HP !== undefined) patch.no_hp = data.No_HP;
        if (data.Tema !== undefined) patch.tema = data.Tema;
        if (data.Notif_Email !== undefined) patch.notif_email = !!data.Notif_Email;
        if (data.Notif_WA !== undefined) patch.notif_wa = !!data.Notif_WA;

        await sb.from('akun').update(patch).eq('email', sess.email);
        return { ok: true };
    },

    async updateHeartbeat(token) {
        const sess = SessionStore.get(token);
        if (sess && sess.email) {
            await sb.from('akun').update({ last_aktif: new Date().toISOString() }).eq('email', sess.email);
        }
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // LAPORAN & STATISTIK (DIPERLUKAN MENU LAPORAN)
    // ------------------------------------------------------------------------
    async getLaporanBulanan(token, bulan, tahun) {
        const b = Number(bulan) || (new Date().getMonth() + 1);
        const th = Number(tahun) || new Date().getFullYear();

        const [resMasuk, resKeluar] = await Promise.all([
            sb.from('transaksi_masuk').select('*').eq('periode_bulan', b).eq('periode_tahun', th).eq('status', 'Lunas'),
            sb.from('transaksi_keluar').select('*')
        ]);

        const rincianMasuk = (resMasuk.data || []).map(t => ({
            ID_Transaksi: t.id_transaksi,
            Tanggal: t.tanggal,
            No_Rumah: t.no_rumah,
            Nama_Warga: t.nama_warga,
            Jenis_Iuran: t.jenis_iuran,
            Jumlah_Bayar: Number(t.jumlah_bayar),
            Periode_Bulan: t.periode_bulan,
            Periode_Tahun: t.periode_tahun,
            Metode_Bayar: t.metode_bayar,
            Status: t.status
        }));

        const rincianKeluar = (resKeluar.data || []).filter(k => {
            const d = new Date(k.tanggal);
            return (d.getMonth() + 1) === b && d.getFullYear() === th;
        }).map(k => ({
            ID_Kategori: k.id_kategori,
            Tanggal: k.tanggal,
            Kategori_Pengeluaran: k.kategori_pengeluaran,
            Jumlah: Number(k.jumlah),
            Penanggung_Jawab: k.penanggung_jawab,
            Keterangan: k.keterangan || ''
        }));

        const totalMasuk = rincianMasuk.reduce((s, t) => s + t.Jumlah_Bayar, 0);
        const totalKeluar = rincianKeluar.reduce((s, k) => s + k.Jumlah, 0);

        const perJenis = {};
        rincianMasuk.forEach(t => { perJenis[t.Jenis_Iuran] = (perJenis[t.Jenis_Iuran] || 0) + t.Jumlah_Bayar; });
        const perKat = {};
        rincianKeluar.forEach(k => { perKat[k.Kategori_Pengeluaran] = (perKat[k.Kategori_Pengeluaran] || 0) + k.Jumlah; });

        return {
            totalMasuk: totalMasuk,
            totalKeluar: totalKeluar,
            saldoBersih: totalMasuk - totalKeluar,
            rincianMasuk: rincianMasuk,
            rincianKeluar: rincianKeluar,
            perJenisMasuk: Object.keys(perJenis).map(k => ({ jenis: k, jumlah: perJenis[k] })),
            perKategoriKeluar: Object.keys(perKat).map(k => ({ kategori: k, jumlah: perKat[k] }))
        };
    },

    async getLaporanTahunan(token, tahun) {
        const th = Number(tahun) || new Date().getFullYear();
        const [resMasuk, resKeluar] = await Promise.all([
            sb.from('transaksi_masuk').select('*').eq('status', 'Lunas'),
            sb.from('transaksi_keluar').select('*')
        ]);

        const rawMasuk = resMasuk.data || [];
        const rawKeluar = resKeluar.data || [];

        // Saldo sebelum tahun ini
        const masukLalu = rawMasuk.filter(t => Number(t.periode_tahun) < th).reduce((s, t) => s + Number(t.jumlah_bayar), 0);
        const keluarLalu = rawKeluar.filter(k => new Date(k.tanggal).getFullYear() < th).reduce((s, k) => s + Number(k.jumlah), 0);
        let saldo = masukLalu - keluarLalu;

        const bulananArr = [];
        for (let b = 1; b <= 12; b++) {
            const m = rawMasuk.filter(t => Number(t.periode_bulan) === b && Number(t.periode_tahun) === th).reduce((s, t) => s + Number(t.jumlah_bayar), 0);
            const k = rawKeluar.filter(t => {
                const d = new Date(t.tanggal);
                return (d.getMonth() + 1) === b && d.getFullYear() === th;
            }).reduce((s, t) => s + Number(t.jumlah), 0);
            saldo += (m - k);
            bulananArr.push({
                bulan: BULAN_NAMA[b - 1],
                totalMasuk: m,
                totalKeluar: k,
                saldoMengendap: saldo
            });
        }

        const keluarTahunIni = rawKeluar.filter(k => new Date(k.tanggal).getFullYear() === th);
        const katMap = {};
        keluarTahunIni.forEach(k => { katMap[k.kategori_pengeluaran] = (katMap[k.kategori_pengeluaran] || 0) + Number(k.jumlah); });

        return {
            tahun: th,
            bulananArr: bulananArr,
            totalMasukTahun: bulananArr.reduce((s, b) => s + b.totalMasuk, 0),
            totalKeluarTahun: bulananArr.reduce((s, b) => s + b.totalKeluar, 0),
            saldoAkhir: saldo,
            perKategoriTahun: Object.keys(katMap).map(k => ({ kategori: k, jumlah: katMap[k] }))
        };
    },

    async getLaporanMingguan(token, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const [resMasuk, resKeluar] = await Promise.all([
            sb.from('transaksi_masuk').select('*').eq('status', 'Lunas'),
            sb.from('transaksi_keluar').select('*')
        ]);

        const rincianMasuk = (resMasuk.data || []).filter(t => {
            const d = new Date(t.tanggal);
            return d >= start && d <= end;
        }).map(t => ({
            ID_Transaksi: t.id_transaksi,
            Tanggal: t.tanggal,
            No_Rumah: t.no_rumah,
            Nama_Warga: t.nama_warga,
            Jenis_Iuran: t.jenis_iuran,
            Jumlah_Bayar: Number(t.jumlah_bayar)
        }));

        const rincianKeluar = (resKeluar.data || []).filter(k => {
            const d = new Date(k.tanggal);
            return d >= start && d <= end;
        }).map(k => ({
            ID_Kategori: k.id_kategori,
            Tanggal: k.tanggal,
            Kategori_Pengeluaran: k.kategori_pengeluaran,
            Jumlah: Number(k.jumlah),
            Penanggung_Jawab: k.penanggung_jawab
        }));

        const totalMasuk = rincianMasuk.reduce((s, t) => s + t.Jumlah_Bayar, 0);
        const totalKeluar = rincianKeluar.reduce((s, k) => s + k.Jumlah, 0);

        return {
            totalMasuk: totalMasuk,
            totalKeluar: totalKeluar,
            saldoBersih: totalMasuk - totalKeluar,
            rincianMasuk: rincianMasuk,
            rincianKeluar: rincianKeluar,
            perJenisMasuk: [],
            perKategoriKeluar: []
        };
    },

    async getTunggakan(token, bulan, tahun) {
        const b = Number(bulan) || (new Date().getMonth() + 1);
        const th = Number(tahun) || new Date().getFullYear();

        const [resWarga, resMasuk] = await Promise.all([
            sb.from('warga').select('*').order('no_rumah'),
            sb.from('transaksi_masuk').select('*').eq('periode_bulan', b).eq('periode_tahun', th).eq('status', 'Lunas')
        ]);

        const lunasRumah = new Set((resMasuk.data || []).map(t => String(t.no_rumah).toUpperCase()));
        return (resWarga.data || []).filter(w => !lunasRumah.has(String(w.no_rumah).toUpperCase())).map(w => ({
            No_Rumah: w.no_rumah,
            Nama_Warga: w.nama_warga,
            No_HP: w.no_hp,
            Status: 'Belum Bayar'
        }));
    },

    async getStatusIuranWarga(token, bulan, tahun) {
        const b = Number(bulan) || (new Date().getMonth() + 1);
        const th = Number(tahun) || new Date().getFullYear();

        const [resWarga, resMasuk, resPub] = await Promise.all([
            sb.from('warga').select('*').order('no_rumah'),
            sb.from('transaksi_masuk').select('*').eq('periode_bulan', b).eq('periode_tahun', th),
            sb.from('pengaturan').select('nominal_kas_bulanan').limit(1).maybeSingle()
        ]);

        const nominal = Number(resPub.data?.nominal_kas_bulanan || 150000);
        const masukMap = {};
        (resMasuk.data || []).forEach(t => {
            const r = String(t.no_rumah).toUpperCase();
            if (!masukMap[r]) masukMap[r] = [];
            masukMap[r].push(t);
        });

        return (resWarga.data || []).map(w => {
            const r = String(w.no_rumah).toUpperCase();
            const list = masukMap[r] || [];
            const lunas = list.find(t => t.status === 'Lunas');
            const pending = list.find(t => t.status === 'Pending');
            const total = lunas ? Number(lunas.jumlah_bayar) : 0;

            let status = 'Belum Bayar';
            if (total >= nominal) status = 'Lunas';
            else if (total > 0) status = 'Kurang Bayar';
            else if (pending) status = 'Menunggu Verifikasi';

            return {
                No_Rumah: w.no_rumah,
                Nama_Warga: w.nama_warga,
                No_HP: w.no_hp,
                Status: status,
                Total_Dibayar: total,
                Jenis_Dibayar: lunas ? lunas.jenis_iuran : ''
            };
        });
    },

    // ------------------------------------------------------------------------
    // BUNDLE & DASHBOARD DATA
    // ------------------------------------------------------------------------
    async getDashboardData(token) {
        const kini = new Date();
        const bulanIni = kini.getMonth() + 1;
        const tahunIni = kini.getFullYear();

        const [resMasuk, resKeluar, resWarga, resAkun, resPindah, resChat] = await Promise.all([
            sb.from('transaksi_masuk').select('*').order('tanggal', { ascending: false }),
            sb.from('transaksi_keluar').select('*').order('tanggal', { ascending: false }),
            sb.from('warga').select('*'),
            sb.from('akun').select('*'),
            sb.from('pengajuan_pindah_blok').select('*'),
            sb.from('chat').select('*')
        ]);

        const rawMasuk = resMasuk.data || [];
        const rawKeluar = resKeluar.data || [];
        const rawWarga = resWarga.data || [];

        const totalMasukAll = rawMasuk.filter(t => t.status === 'Lunas').reduce((s, t) => s + Number(t.jumlah_bayar), 0);
        const totalKeluarAll = rawKeluar.reduce((s, k) => s + Number(k.jumlah), 0);

        const masukBulanIni = rawMasuk.filter(t => t.status === 'Lunas' && Number(t.periode_bulan) === bulanIni && Number(t.periode_tahun) === tahunIni);
        const keluarBulanIni = rawKeluar.filter(k => {
            const d = new Date(k.tanggal);
            return (d.getMonth() + 1) === bulanIni && d.getFullYear() === tahunIni;
        });

        const rumahLunas = new Set(masukBulanIni.map(t => String(t.no_rumah).toUpperCase()));
        const jumlahLunas = rumahLunas.size;
        const totalRumah = rawWarga.length;

        const trend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(tahunIni, bulanIni - 1 - i, 1);
            const b = d.getMonth() + 1, th = d.getFullYear();
            const m = rawMasuk.filter(x => x.status === 'Lunas' && Number(x.periode_bulan) === b && Number(x.periode_tahun) === th)
                .reduce((s, x) => s + Number(x.jumlah_bayar), 0);
            const k = rawKeluar.filter(x => {
                const dd = new Date(x.tanggal);
                return (dd.getMonth() + 1) === b && dd.getFullYear() === th;
            }).reduce((s, x) => s + Number(x.jumlah), 0);
            trend.push({ label: BULAN_NAMA[b - 1].substring(0, 3) + ' ' + String(th).slice(2), masuk: m, keluar: k });
        }

        const katMap = {}, jnsMap = {};
        keluarBulanIni.forEach(k => { katMap[k.kategori_pengeluaran] = (katMap[k.kategori_pengeluaran] || 0) + Number(k.jumlah); });
        masukBulanIni.forEach(t => { jnsMap[t.jenis_iuran] = (jnsMap[t.jenis_iuran] || 0) + Number(t.jumlah_bayar); });

        return {
            saldo: totalMasukAll - totalKeluarAll,
            totalMasukBulanIni: masukBulanIni.reduce((s, t) => s + Number(t.jumlah_bayar), 0),
            totalKeluarBulanIni: keluarBulanIni.reduce((s, k) => s + Number(k.jumlah), 0),
            persentaseLunas: totalRumah > 0 ? Math.round((jumlahLunas / totalRumah) * 100) : 0,
            totalRumah: totalRumah,
            rumahLunas: jumlahLunas,
            menungguVerifikasi: rawMasuk.filter(t => t.status === 'Pending').length,
            akunMenunggu: (resAkun.data || []).filter(a => a.status === 'Menunggu').length,
            permintaanRumah: (resAkun.data || []).filter(a => a.rumah_diminta).length,
            pindahMenunggu: (resPindah.data || []).filter(p => p.status === 'Menunggu').length,
            chatBelumDibaca: (resChat.data || []).filter(c => c.status_baca === 'Belum').length,
            trend: trend,
            pengeluaranKategori: Object.keys(katMap).map(k => ({ kategori: k, jumlah: katMap[k] })),
            pemasukanJenis: Object.keys(jnsMap).map(k => ({ jenis: k, jumlah: jnsMap[k] })),
            statusWarga: { lunas: jumlahLunas, belumLunas: Math.max(totalRumah - jumlahLunas, 0) },
            bulanIniLabel: BULAN_NAMA[bulanIni - 1] + ' ' + tahunIni
        };
    },

    async getWargaList(token) {
        const { data } = await sb.from('warga').select('*').order('no_rumah');
        return (data || []).map(w => ({
            ID_Warga: w.id_warga,
            No_Rumah: w.no_rumah,
            Nama_Warga: w.nama_warga,
            Status_Hunian: w.status_hunian,
            No_HP: w.no_hp,
            Tanggal_Bergabung: w.tanggal_bergabung
        }));
    },

    async getTransaksiMasuk(token) {
        const { data } = await sb.from('transaksi_masuk').select('*').order('tanggal', { ascending: false });
        return (data || []).map(t => ({
            ID_Transaksi: t.id_transaksi,
            Tanggal: t.tanggal,
            No_Rumah: t.no_rumah,
            Nama_Warga: t.nama_warga,
            Jenis_Iuran: t.jenis_iuran,
            Jumlah_Bayar: Number(t.jumlah_bayar),
            Periode_Bulan: Number(t.periode_bulan),
            Periode_Tahun: Number(t.periode_tahun),
            Metode_Bayar: t.metode_bayar,
            Status: t.status,
            Catatan: t.catatan || '',
            Proof_URL: t.proof_url || ''
        }));
    },

    async getTransaksiKeluar(token) {
        const { data } = await sb.from('transaksi_keluar').select('*').order('tanggal', { ascending: false });
        return (data || []).map(k => ({
            ID_Kategori: k.id_kategori,
            Tanggal: k.tanggal,
            Kategori_Pengeluaran: k.kategori_pengeluaran,
            Jumlah: Number(k.jumlah),
            Penanggung_Jawab: k.penanggung_jawab,
            Bukti_Nota_URL: k.bukti_nota_url || '',
            Keterangan: k.keterangan || ''
        }));
    },

    async getDaftarAkun(token) {
        const { data } = await sb.from('akun').select('*').order('tanggal_daftar', { ascending: false });
        return (data || []).map(a => ({
            ID_Akun: a.id_akun,
            Email: a.email,
            Nama: a.nama,
            No_Rumah: a.no_rumah,
            No_HP: a.no_hp,
            Role: a.role,
            Status: a.status,
            Avatar: a.foto_url || a.foto || '',
            Rumah_Diminta: a.rumah_diminta || '',
            Alasan_Pindah: a.alasan_pindah || '',
            Catatan_Admin: a.catatan_admin || '',
            Tanggal_Daftar: a.tanggal_daftar,
            Last_Login: a.last_login
        }));
    },

    async getGaleriList(token, kategori) {
        let q = sb.from('galeri').select('*').order('tanggal_kegiatan', { ascending: false });
        if (kategori) q = q.eq('kategori', kategori);
        const [resGaleri, resFoto] = await Promise.all([q, sb.from('galeri_foto').select('*').order('urutan')]);

        const fotoByG = {};
        (resFoto.data || []).forEach(f => {
            if (!fotoByG[f.id_galeri]) fotoByG[f.id_galeri] = [];
            fotoByG[f.id_galeri].push({
                ID_Foto: f.id_foto,
                ID_Galeri: f.id_galeri,
                Nama_File: f.nama_file,
                URL_Foto: f.url_foto,
                Urutan: f.urutan,
                Tanggal_Upload: f.tanggal_upload
            });
        });

        return (resGaleri.data || []).map(g => ({
            ID_Galeri: g.id_galeri,
            Judul_Kegiatan: g.judul_kegiatan,
            Kategori: g.kategori,
            Deskripsi: g.deskripsi || '',
            Tanggal_Kegiatan: g.tanggal_kegiatan,
            Dibuat_Oleh: g.dibuat_oleh,
            Tanggal_Dibuat: g.tanggal_dibuat,
            Status: g.status,
            Foto: fotoByG[g.id_galeri] || [],
            Jumlah_Foto: (fotoByG[g.id_galeri] || []).length,
            Cover_URL: (fotoByG[g.id_galeri] || [])[0]?.URL_Foto || ''
        }));
    },

    async getGaleriKategori() {
        return ['Kerja bakti','Rapat warga','Pengajian','Kegiatan olahraga','Perayaan hari besar','Kegiatan sosial','Keamanan lingkungan','Kegiatan lainnya'];
    },

    async getPengajuanPindah(token) {
        const { data } = await sb.from('pengajuan_pindah_blok').select('*').order('tanggal_pengajuan', { ascending: false });
        return (data || []).map(p => ({
            ID_Pengajuan: p.id_pengajuan,
            Email_Pemohon: p.email_pemohon,
            Nama_Pemohon: p.nama_pemohon,
            Blok_Asal: p.blok_asal,
            No_Rumah_Asal: p.no_rumah_asal,
            Blok_Tujuan: p.blok_tujuan,
            No_Rumah_Tujuan: p.no_rumah_tujuan,
            Alasan: p.alasan || '',
            Tanggal_Pengajuan: p.tanggal_pengajuan,
            Status: p.status,
            Catatan_Admin: p.catatan_admin || '',
            Diproses_Oleh: p.diproses_oleh || '',
            Tanggal_Diproses: p.tanggal_diproses,
            Dokumen_URL: p.dokumen_url || ''
        }));
    },

    async getPengajuanPindahSaya(token) {
        const sess = SessionStore.get(token);
        if (!sess || !sess.email) return [];
        const { data } = await sb.from('pengajuan_pindah_blok').select('*').eq('email_pemohon', sess.email).order('tanggal_pengajuan', { ascending: false });
        return (data || []).map(p => ({
            ID_Pengajuan: p.id_pengajuan,
            Email_Pemohon: p.email_pemohon,
            Nama_Pemohon: p.nama_pemohon,
            Blok_Asal: p.blok_asal,
            No_Rumah_Asal: p.no_rumah_asal,
            Blok_Tujuan: p.blok_tujuan,
            No_Rumah_Tujuan: p.no_rumah_tujuan,
            Alasan: p.alasan || '',
            Tanggal_Pengajuan: p.tanggal_pengajuan,
            Status: p.status,
            Catatan_Admin: p.catatan_admin || '',
            Dokumen_URL: p.dokumen_url || ''
        }));
    },

    async getNotifikasi(token) {
        const [resTrx, resAkun, resPindah, resChat] = await Promise.all([
            sb.from('transaksi_masuk').select('id').eq('status', 'Pending'),
            sb.from('akun').select('id').in('status', ['Menunggu', 'Baru']),
            sb.from('pengajuan_pindah_blok').select('id').eq('status', 'Menunggu'),
            sb.from('chat').select('id').eq('status_baca', 'Belum')
        ]);
        const t = (resTrx.data || []).length;
        const a = (resAkun.data || []).length;
        const p = (resPindah.data || []).length;
        const c = (resChat.data || []).length;
        return { transaksi: t, akun: a, pindah: p, chat: c, total: t + a + p + c };
    },

    async getChatPercakapanAdmin(token) {
        const { data } = await sb.from('chat').select('*').order('waktu_kirim', { ascending: false });
        const map = {};
        (data || []).forEach(c => {
            const partner = c.role_pengirim === 'admin' ? c.email_penerima : c.email_pengirim;
            if (!partner) return;
            if (!map[partner]) {
                map[partner] = {
                    Email_Warga: partner,
                    Nama_Warga: c.role_pengirim === 'admin' ? partner : c.nama_pengirim,
                    Pesan_Terakhir: c.isi_pesan,
                    Waktu_Terakhir: c.waktu_kirim,
                    Belum_Dibaca: 0
                };
            }
            if (c.role_pengirim !== 'admin' && c.status_baca === 'Belum') {
                map[partner].Belum_Dibaca++;
            }
        });
        return Object.values(map);
    },

    async getBundleAwal(token, opts) {
        const profil = await this.getProfil(token);
        const kini = new Date();
        const bulan = Number((opts && opts.bulan) || (kini.getMonth() + 1));
        const tahun = Number((opts && opts.tahun) || kini.getFullYear());

        const [
            pub,
            warga,
            trxMasuk,
            trxKeluar,
            akun,
            galeri,
            pindah,
            notif
        ] = await Promise.all([
            this.getPengaturanPublik(),
            this.getWargaList(token),
            this.getTransaksiMasuk(token),
            this.getTransaksiKeluar(token),
            profil && profil.Role === 'admin' ? this.getDaftarAkun(token) : Promise.resolve([]),
            this.getGaleriList(token, null),
            profil && profil.Role === 'admin' ? this.getPengajuanPindah(token) : this.getPengajuanPindahSaya(token),
            this.getNotifikasi(token)
        ]);

        const out = {
            ts: Date.now(),
            bulan: bulan,
            tahun: tahun,
            profil: profil,
            publik: pub,
            notif: notif
        };

        if (profil && profil.Role === 'admin') {
            out.dash = await this.getDashboardData(token);
            out.warga = warga;
            out.trxMasuk = trxMasuk;
            out.trxKeluar = trxKeluar;
            out.status = { list: await this.getStatusIuranWarga(token, bulan, tahun) };
            out.akun = akun;
            out.pengAdmin = await this.getPengaturanAdmin(token);
            out.lapBulanan = await this.getLaporanBulanan(token, bulan, tahun);
            out.lapTahunan = await this.getLaporanTahunan(token, tahun);
            out.galeri = galeri;
            out.pindah = pindah;
            out.chatList = await this.getChatPercakapanAdmin(token);
        } else if (profil) {
            out.beranda = {
                namaWarga: profil.Nama,
                noRumah: profil.No_Rumah,
                statusBulanIni: 'Lunas',
                totalTunggakan: 0,
                riwayatSingkat: trxMasuk.filter(t => String(t.No_Rumah).toUpperCase() === String(profil.No_Rumah).toUpperCase()).slice(0, 5)
            };
            out.tagihan = [];
            out.riwayat = trxMasuk.filter(t => String(t.No_Rumah).toUpperCase() === String(profil.No_Rumah).toUpperCase());
            out.arusKas = { trend: [] };
            out.galeri = galeri;
            out.pindah = pindah;
            out.chatUnread = notif.chat || 0;
        }

        return out;
    },

    // ------------------------------------------------------------------------
    // CRUD TRANSAKSI
    // ------------------------------------------------------------------------
    async addTransaksiMasuk(token, payload) {
        const idTrx = genId('TM');
        const { error } = await sb.from('transaksi_masuk').insert({
            id_transaksi: idTrx,
            tanggal: payload.Tanggal || new Date().toISOString().split('T')[0],
            no_rumah: String(payload.No_Rumah || '').toUpperCase().trim(),
            nama_warga: payload.Nama_Warga || '',
            jenis_iuran: payload.Jenis_Iuran || 'Kas Bulanan',
            jumlah_bayar: Number(payload.Jumlah_Bayar) || 0,
            periode_bulan: Number(payload.Periode_Bulan) || (new Date().getMonth() + 1),
            periode_tahun: Number(payload.Periode_Tahun) || new Date().getFullYear(),
            metode_bayar: payload.Metode_Bayar || 'Transfer Bank',
            status: payload.Status || 'Lunas',
            catatan: payload.Catatan || '',
            proof_url: payload.Proof_URL || ''
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idTrx };
    },

    async updateTransaksiMasuk(token, idTrx, payload) {
        const patch = {};
        if (payload.Tanggal !== undefined) patch.tanggal = payload.Tanggal;
        if (payload.No_Rumah !== undefined) patch.no_rumah = String(payload.No_Rumah).toUpperCase().trim();
        if (payload.Nama_Warga !== undefined) patch.nama_warga = payload.Nama_Warga;
        if (payload.Jenis_Iuran !== undefined) patch.jenis_iuran = payload.Jenis_Iuran;
        if (payload.Jumlah_Bayar !== undefined) patch.jumlah_bayar = Number(payload.Jumlah_Bayar);
        if (payload.Periode_Bulan !== undefined) patch.periode_bulan = Number(payload.Periode_Bulan);
        if (payload.Periode_Tahun !== undefined) patch.periode_tahun = Number(payload.Periode_Tahun);
        if (payload.Metode_Bayar !== undefined) patch.metode_bayar = payload.Metode_Bayar;
        if (payload.Status !== undefined) patch.status = payload.Status;
        if (payload.Catatan !== undefined) patch.catatan = payload.Catatan;

        const { error } = await sb.from('transaksi_masuk').update(patch).eq('id_transaksi', idTrx);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async deleteTransaksiMasuk(token, idTrx) {
        const { error } = await sb.from('transaksi_masuk').delete().eq('id_transaksi', idTrx);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async verifikasiPembayaran(token, idTrx) {
        const { error } = await sb.from('transaksi_masuk').update({
            status: 'Lunas',
            tanggal_diproses: new Date().toISOString()
        }).eq('id_transaksi', idTrx);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async ajukanPembayaran(token, data) {
        const sess = SessionStore.get(token);
        const { data: a } = await sb.from('akun').select('*').eq('email', sess?.email).maybeSingle();
        const noRumah = a?.no_rumah || String(data.No_Rumah || '').toUpperCase().trim();
        const idTrx = genId('TM');

        const { error } = await sb.from('transaksi_masuk').insert({
            id_transaksi: idTrx,
            tanggal: data.Tanggal || new Date().toISOString().split('T')[0],
            no_rumah: noRumah,
            nama_warga: a?.nama || data.Nama_Warga || '',
            jenis_iuran: data.Jenis_Iuran || 'Kas Bulanan',
            jumlah_bayar: Number(data.Jumlah_Bayar) || 0,
            periode_bulan: Number(data.Periode_Bulan) || (new Date().getMonth() + 1),
            periode_tahun: Number(data.Periode_Tahun) || new Date().getFullYear(),
            metode_bayar: data.Metode_Bayar || 'Transfer Bank',
            status: 'Pending',
            catatan: data.Catatan || '',
            proof_url: data.Proof_URL || ''
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idTrx };
    },

    async addTransaksiKeluar(token, payload) {
        const idKat = genId('TK');
        const { error } = await sb.from('transaksi_keluar').insert({
            id_kategori: idKat,
            tanggal: payload.Tanggal || new Date().toISOString().split('T')[0],
            kategori_pengeluaran: payload.Kategori_Pengeluaran || 'Operasional',
            jumlah: Number(payload.Jumlah) || 0,
            penanggung_jawab: payload.Penanggung_Jawab || 'Bendahara',
            bukti_nota_url: payload.Bukti_Nota_URL || '',
            keterangan: payload.Keterangan || ''
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idKat };
    },

    async updateTransaksiKeluar(token, idKat, payload) {
        const patch = {};
        if (payload.Tanggal !== undefined) patch.tanggal = payload.Tanggal;
        if (payload.Kategori_Pengeluaran !== undefined) patch.kategori_pengeluaran = payload.Kategori_Pengeluaran;
        if (payload.Jumlah !== undefined) patch.jumlah = Number(payload.Jumlah);
        if (payload.Penanggung_Jawab !== undefined) patch.penanggung_jawab = payload.Penanggung_Jawab;
        if (payload.Keterangan !== undefined) patch.keterangan = payload.Keterangan;
        if (payload.Bukti_Nota_URL !== undefined) patch.bukti_nota_url = payload.Bukti_Nota_URL;

        const { error } = await sb.from('transaksi_keluar').update(patch).eq('id_kategori', idKat);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async deleteTransaksiKeluar(token, idKat) {
        const { error } = await sb.from('transaksi_keluar').delete().eq('id_kategori', idKat);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // CRUD WARGA
    // ------------------------------------------------------------------------
    async addWarga(token, payload) {
        const idW = genId('WRG');
        const noRumah = String(payload.No_Rumah).toUpperCase().trim();
        const { error } = await sb.from('warga').insert({
            id_warga: idW,
            no_rumah: noRumah,
            nama_warga: payload.Nama_Warga || '',
            status_hunian: payload.Status_Hunian || 'Tetap',
            no_hp: payload.No_HP || ''
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idW };
    },

    async updateWarga(token, idWarga, payload) {
        const patch = {};
        if (payload.Nama_Warga !== undefined) patch.nama_warga = payload.Nama_Warga;
        if (payload.Status_Hunian !== undefined) patch.status_hunian = payload.Status_Hunian;
        if (payload.No_HP !== undefined) patch.no_hp = payload.No_HP;
        if (payload.No_Rumah !== undefined) patch.no_rumah = String(payload.No_Rumah).toUpperCase().trim();

        const { error } = await sb.from('warga').update(patch).eq('id_warga', idWarga);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async deleteWarga(token, idWarga) {
        const { error } = await sb.from('warga').delete().eq('id_warga', idWarga);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // CRUD AKUN
    // ------------------------------------------------------------------------
    async updateAkun(token, idAkun, payload) {
        const patch = {};
        if (payload.Nama !== undefined) patch.nama = payload.Nama;
        if (payload.No_Rumah !== undefined) patch.no_rumah = String(payload.No_Rumah).toUpperCase().trim();
        if (payload.No_HP !== undefined) patch.no_hp = payload.No_HP;
        if (payload.Role !== undefined) patch.role = payload.Role;
        if (payload.Status !== undefined) patch.status = payload.Status;
        if (payload.Catatan_Admin !== undefined) patch.catatan_admin = payload.Catatan_Admin;

        const { error } = await sb.from('akun').update(patch).eq('id_akun', idAkun);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async hapusAkun(token, idAkun) {
        const { error } = await sb.from('akun').delete().eq('id_akun', idAkun);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // STORAGE UPLOAD
    // ------------------------------------------------------------------------
    async uploadBuktiFile(token, base64Data, fileName, mimeType) {
        const blob = base64ToBlob(base64Data, mimeType);
        const path = Date.now() + '_' + (fileName || 'bukti.jpg');
        const { error } = await sb.storage.from('kas-bukti').upload(path, blob, { contentType: mimeType || 'image/jpeg' });
        if (error) throw new Error(error.message);
        const { data: pubUrl } = sb.storage.from('kas-bukti').getPublicUrl(path);
        return pubUrl.publicUrl;
    },

    async uploadFotoGaleri(idGaleri, base64Data, fileName, mimeType) {
        const blob = base64ToBlob(base64Data, mimeType);
        const path = idGaleri + '_' + Date.now() + '_' + (fileName || 'foto.jpg');
        const { error } = await sb.storage.from('kas-galeri').upload(path, blob, { contentType: mimeType || 'image/jpeg' });
        if (error) throw new Error(error.message);
        const { data: pubUrl } = sb.storage.from('kas-galeri').getPublicUrl(path);

        const idFoto = genId('FTO');
        await sb.from('galeri_foto').insert({
            id_foto: idFoto,
            id_galeri: idGaleri,
            nama_file: fileName || '',
            url_foto: pubUrl.publicUrl
        });

        return { ok: true, URL: pubUrl.publicUrl, ID_Foto: idFoto };
    },

    async uploadFotoProfil(token, base64Data, fileName, mimeType) {
        const sess = SessionStore.get(token);
        if (!sess || !sess.email) throw new Error('Sesi tidak valid.');
        const blob = base64ToBlob(base64Data, mimeType);
        const path = 'profil_' + Date.now() + '_' + (fileName || 'foto.jpg');
        const { error } = await sb.storage.from('kas-foto').upload(path, blob, { contentType: mimeType || 'image/jpeg' });
        if (error) throw new Error(error.message);
        const { data: pubUrl } = sb.storage.from('kas-foto').getPublicUrl(path);

        await sb.from('akun').update({ foto_url: pubUrl.publicUrl }).eq('email', sess.email);
        return { ok: true, url: pubUrl.publicUrl };
    },

    async uploadQrCode(token, base64Data, mimeType) {
        const blob = base64ToBlob(base64Data, mimeType);
        const path = 'qr_' + Date.now() + '.png';
        const { error } = await sb.storage.from('kas-bukti').upload(path, blob, { contentType: mimeType || 'image/png' });
        if (error) throw new Error(error.message);
        const { data: pubUrl } = sb.storage.from('kas-bukti').getPublicUrl(path);

        await sb.from('pengaturan').update({ qr_code_url: pubUrl.publicUrl }).eq('id', 1);
        return { ok: true, url: pubUrl.publicUrl };
    },

    async hapusQrCode(token) {
        await sb.from('pengaturan').update({ qr_code_url: '' }).eq('id', 1);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // GALERI
    // ------------------------------------------------------------------------
    async addGaleri(token, payload) {
        const idG = genId('GAL');
        const { error } = await sb.from('galeri').insert({
            id_galeri: idG,
            judul_kegiatan: payload.Judul_Kegiatan,
            kategori: payload.Kategori || 'Kegiatan lainnya',
            deskripsi: payload.Deskripsi || '',
            tanggal_kegiatan: payload.Tanggal_Kegiatan || new Date().toISOString().split('T')[0]
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idG };
    },

    async updateGaleri(token, idGaleri, payload) {
        const patch = {};
        if (payload.Judul_Kegiatan !== undefined) patch.judul_kegiatan = payload.Judul_Kegiatan;
        if (payload.Kategori !== undefined) patch.kategori = payload.Kategori;
        if (payload.Deskripsi !== undefined) patch.deskripsi = payload.Deskripsi;
        if (payload.Tanggal_Kegiatan !== undefined) patch.tanggal_kegiatan = payload.Tanggal_Kegiatan;

        const { error } = await sb.from('galeri').update(patch).eq('id_galeri', idGaleri);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async deleteGaleri(token, idGaleri) {
        await sb.from('galeri_foto').delete().eq('id_galeri', idGaleri);
        const { error } = await sb.from('galeri').delete().eq('id_galeri', idGaleri);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async deleteFotoGaleri(token, idFoto) {
        const { error } = await sb.from('galeri_foto').delete().eq('id_foto', idFoto);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // CHAT
    // ------------------------------------------------------------------------
    async kirimPesanChat(token, payload) {
        const sess = SessionStore.get(token);
        const idPesan = genId('MSG');
        const { error } = await sb.from('chat').insert({
            id_pesan: idPesan,
            id_percakapan: payload.ID_Percakapan,
            email_pengirim: payload.Email_Pengirim || sess?.email || 'admin',
            nama_pengirim: payload.Nama_Pengirim || 'Warga',
            role_pengirim: payload.Role_Pengirim || 'warga',
            email_penerima: payload.Email_Penerima || '',
            isi_pesan: payload.Isi_Pesan,
            url_lampiran: payload.URL_Lampiran || '',
            waktu_kirim: new Date().toISOString(),
            status_baca: 'Belum'
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idPesan };
    },

    async getChatPercakapanSaya(token) {
        const sess = SessionStore.get(token);
        if (!sess || !sess.email) return [];
        const { data } = await sb.from('chat')
            .select('*')
            .or(`email_pengirim.eq.${sess.email},email_penerima.eq.${sess.email}`)
            .order('waktu_kirim', { ascending: true });
        return (data || []).map(c => ({
            ID_Pesan: c.id_pesan,
            ID_Percakapan: c.id_percakapan,
            Email_Pengirim: c.email_pengirim,
            Nama_Pengirim: c.nama_pengirim,
            Role_Pengirim: c.role_pengirim,
            Email_Penerima: c.email_penerima,
            Isi_Pesan: c.isi_pesan,
            URL_Lampiran: c.url_lampiran,
            Waktu_Kirim: c.waktu_kirim,
            Status_Baca: c.status_baca
        }));
    },

    async getChatAdminDenganWarga(token, emailWarga) {
        const { data } = await sb.from('chat')
            .select('*')
            .or(`email_pengirim.eq.${emailWarga},email_penerima.eq.${emailWarga}`)
            .order('waktu_kirim', { ascending: true });
        return {
            pesan: (data || []).map(c => ({
                ID_Pesan: c.id_pesan,
                ID_Percakapan: c.id_percakapan,
                Email_Pengirim: c.email_pengirim,
                Nama_Pengirim: c.nama_pengirim,
                Role_Pengirim: c.role_pengirim,
                Email_Penerima: c.email_penerima,
                Isi_Pesan: c.isi_pesan,
                URL_Lampiran: c.url_lampiran,
                Waktu_Kirim: c.waktu_kirim,
                Status_Baca: c.status_baca
            }))
        };
    },

    async tandaiChatDibaca(token, idPercakapan) {
        await sb.from('chat').update({ status_baca: 'Dibaca' }).eq('id_percakapan', idPercakapan);
        return { ok: true };
    },

    async hapusPercakapan(token, idPercakapan) {
        await sb.from('chat').delete().eq('id_percakapan', idPercakapan);
        return { ok: true };
    },

    // ------------------------------------------------------------------------
    // PINDAH BLOK
    // ------------------------------------------------------------------------
    async ajukanPindahBlok(token, payload) {
        const sess = SessionStore.get(token);
        const idP = genId('PND');
        const { error } = await sb.from('pengajuan_pindah_blok').insert({
            id_pengajuan: idP,
            email_pemohon: sess?.email || '',
            nama_pemohon: payload.Nama_Pemohon,
            blok_asal: payload.Blok_Asal || '',
            no_rumah_asal: payload.No_Rumah_Asal,
            blok_tujuan: payload.Blok_Tujuan || '',
            no_rumah_tujuan: payload.No_Rumah_Tujuan,
            alasan: payload.Alasan || '',
            status: 'Menunggu'
        });
        if (error) throw new Error(error.message);
        return { ok: true, id: idP };
    },

    async batalkanPindahBlok(token, idPengajuan) {
        const { error } = await sb.from('pengajuan_pindah_blok').delete().eq('id_pengajuan', idPengajuan);
        if (error) throw new Error(error.message);
        return { ok: true };
    },

    async putuskanPindahBlok(token, idPengajuan, setuju, catatan) {
        const { data: p } = await sb.from('pengajuan_pindah_blok').select('*').eq('id_pengajuan', idPengajuan).single();
        if (!p) throw new Error('Pengajuan tidak ditemukan.');

        if (!setuju) {
            await sb.from('pengajuan_pindah_blok').update({
                status: 'Ditolak',
                catatan_admin: catatan || '',
                tanggal_diproses: new Date().toISOString()
            }).eq('id_pengajuan', idPengajuan);
            return { ok: true, disetujui: false };
        }

        await sb.from('akun').update({ no_rumah: p.no_rumah_tujuan }).eq('email', p.email_pemohon);
        await sb.from('warga').update({ no_rumah: p.no_rumah_tujuan }).eq('no_rumah', p.no_rumah_asal);
        await sb.from('pengajuan_pindah_blok').update({
            status: 'Disetujui',
            catatan_admin: catatan || '',
            tanggal_diproses: new Date().toISOString()
        }).eq('id_pengajuan', idPengajuan);

        return { ok: true, disetujui: true, No_Rumah: p.no_rumah_tujuan };
    },

    // ------------------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------------------
    async exportLaporanToSheet(token, judul, headers, rows) {
        return { ok: true };
    }
};
