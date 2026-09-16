const API_URL = "https://script.google.com/macros/s/AKfycbw6OV1YmUcdqp8X2-dtWx3s6q4uarLGWn95_m9mTiU2w32g94LGSX2aa2hTVSaRXbxn/exec";

/* ============================================================
           KAS PERUMAHAN BLOK L/M — klien v5
           Perbaikan: badge notifikasi hidup di semua menu, chat warga
           punya badge, chat bendahara satu panel di ponsel, tata letak
           mobile-first, bug hapus foto album.
           ============================================================ */

        const PREFIX_DATA = 'kaslm_c::';
        const PREFIX_WAKTU = 'kaslm_w::';
        const TTL = 120000;
        const TTL_STATIS = 600000;

        const RingkasanLaporan = {
            props: ['data'],
            template: [
                '<div class="space-y-4" v-if="data">',
                '  <div class="grid sm:grid-cols-3 gap-3">',
                '    <div class="stat"><span class="t-label">Kas masuk</span><b class="num" style="color:var(--sea-700)">{{ rp(data.totalMasuk) }}</b></div>',
                '    <div class="stat"><span class="t-label">Kas keluar</span><b class="num" style="color:var(--rose)">{{ rp(data.totalKeluar) }}</b></div>',
                '    <div class="stat"><span class="t-label">Saldo bersih</span><b class="num">{{ rp(data.saldoBersih) }}</b></div>',
                '  </div>',
                '  <div class="grid lg:grid-cols-2 gap-4">',
                '    <div class="panel p-5"><h4 class="font-bold mb-1">Pemasukan per jenis iuran</h4>',
                '      <div v-for="j in (data.perJenisMasuk||[])" :key="j.jenis" class="flex justify-between text-sm py-2.5" style="border-top:1px solid var(--line-soft)">',
                '        <span>{{ j.jenis }}</span><span class="font-semibold num" style="color:var(--sea-700)">{{ rp(j.jumlah) }}</span></div>',
                '      <p v-if="!(data.perJenisMasuk||[]).length" class="text-sm py-5 text-center" style="color:var(--muted)">Tidak ada pemasukan.</p></div>',
                '    <div class="panel p-5"><h4 class="font-bold mb-1">Pengeluaran per kategori</h4>',
                '      <div v-for="k in (data.perKategoriKeluar||[])" :key="k.kategori" class="flex justify-between text-sm py-2.5" style="border-top:1px solid var(--line-soft)">',
                '        <span>{{ k.kategori }}</span><span class="font-semibold num" style="color:var(--rose)">{{ rp(k.jumlah) }}</span></div>',
                '      <p v-if="!(data.perKategoriKeluar||[]).length" class="text-sm py-5 text-center" style="color:var(--muted)">Tidak ada pengeluaran.</p></div>',
                '  </div>',
                '</div>',
                '<p v-else class="text-center py-10" style="color:var(--muted)">Memuat laporan…</p>'
            ].join(''),
            methods: { rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); } }
        };

        function mulaiAplikasi() {
            const { createApp } = Vue;
            createApp({
                components: { 'ringkasan-laporan': RingkasanLaporan },
                data() {
                    const now = new Date();
                    return {
                        BULAN_ID: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
                        loading: false, loadingText: 'Memproses', pendingCalls: 0, menyegarkan: 0, sedangSimpan: false,
                        dark: false, toasts: [],
                        token: null, profil: null, publik: {},

                        modeAuth: 'masuk', pinTerbuka: false, pinInput: '',
                        page: 'dashboard', moreSheet: false, modal: null,

                        /* badge terpusat: diisi getNotifikasi() setiap 30 detik */
                        notif: { transaksi: 0, akun: 0, pindah: 0, chat: 0 },

                        /* Empat item pertama tampil di tab bar ponsel. */
                        menuAdmin: [
                            { key: 'dashboard', label: 'Ringkasan', icon: 'layout-dashboard' },
                            { key: 'transaksi', label: 'Transaksi', icon: 'receipt' },
                            { key: 'chat', label: 'Chat', icon: 'message-circle' },
                            { key: 'status', label: 'Status', icon: 'clipboard-check' },
                            { key: 'galeri', label: 'Galeri', icon: 'images' },
                            { key: 'laporan', label: 'Laporan', icon: 'bar-chart-3' },
                            { key: 'pindah', label: 'Pindah blok', icon: 'arrow-right-left' },
                            { key: 'akun', label: 'Akun warga', icon: 'user-check' },
                            { key: 'pengaturan', label: 'Pengaturan', icon: 'settings' }
                        ],
                        menuWarga: [
                            { key: 'beranda', label: 'Beranda', icon: 'home' },
                            { key: 'tagihan', label: 'Tagihan', icon: 'calendar-check' },
                            { key: 'chat', label: 'Chat', icon: 'message-circle' },
                            { key: 'galeri', label: 'Galeri', icon: 'images' },
                            { key: 'aruskas', label: 'Arus kas', icon: 'trending-up' },
                            { key: 'riwayat', label: 'Riwayat', icon: 'history' },
                            { key: 'profil', label: 'Profil', icon: 'user' }
                        ],

                        dash: {
                            saldo: 0, totalMasukBulanIni: 0, totalKeluarBulanIni: 0, persentaseLunas: 0, totalRumah: 0, rumahLunas: 0,
                            menungguVerifikasi: 0, akunMenunggu: 0, pindahMenunggu: 0, chatBelumDibaca: 0,
                            trend: [], pemasukanJenis: [], pengeluaranKategori: [], statusWarga: { lunas: 0, belumLunas: 0 }, bulanIniLabel: ''
                        },

                        wargaList: [], listMasuk: [], listKeluar: [],
                        trxSearch: '', qTrx: '', trxDateStart: '', trxDateEnd: '', tabTrx: 'masuk',
                        limitMasuk: 100, limitKeluar: 100,
                        statusBulan: now.getMonth() + 1, statusTahun: now.getFullYear(), statusSearch: '', qStatus: '', statusList: [],
                        tabLap: 'bulanan', lapBulan: now.getMonth() + 1, lapTahun: now.getFullYear(), lapData: null,
                        rangeStart: '', rangeEnd: '', tahunLap: now.getFullYear(),
                        lapTahunan: { bulananArr: [], totalMasukTahun: 0, totalKeluarTahun: 0, saldoAkhir: 0, perKategoriTahun: [] },
                        tunggakanList: [],
                        akunList: [], akunSearch: '', qAkun: '', akunFilter: '', permintaanRumah: [],

                        pindahList: [], pindahFilter: '', pindahSaya: [],

                        galeriList: [], filterKategori: '', kategoriGaleri: [],
                        lightbox: null, albumUpload: null, progressUpload: { total: 0, selesai: 0 },

                        chatList: [], chatSearch: '', qChat: '', chatAktif: null, chatPesan: [], chatInput: '',
                        chatAdminOnline: false, chatLampiranUrl: '',
                        _pollChatTimer: null, _heartbeatTimer: null, _notifTimer: null,

                        warga: { daftarTunggakan: [], kasUmum: {}, chatBelumDibaca: 0 },
                        arusKas: { trend: [], pemasukanJenis: [], pengeluaranKategori: [], daftarKeluar: [] }, tahunArus: now.getFullYear(),
                        tagihan: { rows: [] }, tahunTagihan: now.getFullYear(),
                        riwayat: [], tahunRiwayat: now.getFullYear(),

                        formProfil: { Tema: 'sistem', Notif_Email: true, Notif_WA: true },
                        formPindah: { Blok_Tujuan: '', No_Rumah_Tujuan: '', Alasan: '' },
                        formDaftar: { Nama: '', Blok: '', Nomor: '', No_HP: '', No_Rumah: '', Foto_base64: '', Foto_mime: '' },
                        authState: null, pollTimer: null,
                        formMasuk: {}, formKeluar: {}, formWarga: {}, formAkun: {}, formBayar: {},
                        formGaleri: { Judul_Kegiatan: '', Kategori: 'Kerja bakti', Deskripsi: '', Tanggal_Kegiatan: new Date().toISOString().slice(0, 10), Status: 'Aktif' },
                        setForm: {},
                        kuitansi: null, waModal: null
                    };
                },

                created() { this._charts = {}; this._timers = {}; this._ikonTimer = null; },

                computed: {
                    isAdmin() { return this.profil && this.profil.Role === 'admin'; },
                    menuAktif() { return this.isAdmin ? this.menuAdmin : this.menuWarga; },
                    bottomNav() {
                        const list = this.menuAktif;
                        if (list.length <= 5) return list;
                        return list.slice(0, 4).concat([{ key: 'more', label: 'Lainnya', icon: 'menu' }]);
                    },
                    menuLainnya() {
                        const list = this.menuAktif;
                        return list.length <= 5 ? [] : list.slice(4);
                    },
                    notifTotal() { return (this.notif.transaksi || 0) + (this.notif.akun || 0) + (this.notif.pindah || 0) + (this.notif.chat || 0); },
                    inisial() {
                        const n = (this.profil && (this.profil.Nama || this.profil.Email)) || '?';
                        return n.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
                    },
                    judulHalaman() { const m = this.menuAktif.find(x => x.key === this.page); return m ? m.label : ''; },
                    subJudul() {
                        if (this.isAdmin) return (this.publik.Nama_Perumahan || 'Kas warga') + ' · panel bendahara';
                        return 'Rumah ' + (this.profil ? this.profil.No_Rumah : '');
                    },
                    idxMasuk() { return this.listMasuk.map(t => ({ t, s: ((t.No_Rumah || '') + ' ' + (t.Nama_Warga || '') + ' ' + (t.Jenis_Iuran || '')).toLowerCase() })); },
                    idxKeluar() { return this.listKeluar.map(t => ({ t, s: ((t.Kategori_Pengeluaran || '') + ' ' + (t.Penanggung_Jawab || '') + ' ' + (t.Keterangan || '')).toLowerCase() })); },
                    listMasukFiltered() {
                        const q = this.qTrx, a = this.trxDateStart, b = this.trxDateEnd;
                        return this.idxMasuk.filter(x => (!q || x.s.includes(q)) && (!a || x.t.Tanggal >= a) && (!b || x.t.Tanggal <= b)).map(x => x.t);
                    },
                    listKeluarFiltered() {
                        const q = this.qTrx, a = this.trxDateStart, b = this.trxDateEnd;
                        return this.idxKeluar.filter(x => (!q || x.s.includes(q)) && (!a || x.t.Tanggal >= a) && (!b || x.t.Tanggal <= b)).map(x => x.t);
                    },
                    masukTampil() { return this.listMasukFiltered.slice(0, this.limitMasuk); },
                    keluarTampil() { return this.listKeluarFiltered.slice(0, this.limitKeluar); },
                    statusFiltered() {
                        const q = this.qStatus;
                        if (!q) return this.statusList;
                        return this.statusList.filter(s => (s.No_Rumah || '').toLowerCase().includes(q) || (s.Nama_Warga || '').toLowerCase().includes(q));
                    },
                    akunFiltered() {
                        const q = this.qAkun, f = this.akunFilter;
                        return this.akunList.filter(a => {
                            const cocok = !q || (a.Nama || '').toLowerCase().includes(q) || (a.Email || '').toLowerCase().includes(q) || (a.No_Rumah || '').toLowerCase().includes(q);
                            return cocok && (!f || a.Status === f);
                        });
                    },
                    tunggakanBlokL() { return this.tunggakanList.filter(x => String(x.No_Rumah || '').toUpperCase().startsWith('L')); },
                    tunggakanBlokM() { return this.tunggakanList.filter(x => String(x.No_Rumah || '').toUpperCase().startsWith('M')); },
                    galeriTampil() {
                        if (!this.filterKategori) return this.galeriList;
                        return this.galeriList.filter(g => g.Kategori === this.filterKategori);
                    },
                    chatListFiltered() {
                        const q = this.qChat;
                        if (!q) return this.chatList;
                        return this.chatList.filter(c => (c.Nama_Warga || '').toLowerCase().includes(q) || (c.No_Rumah || '').toLowerCase().includes(q));
                    },
                    pindahTampil() {
                        if (!this.pindahFilter) return this.pindahList;
                        return this.pindahList.filter(p => p.Status === this.pindahFilter);
                    },
                    pengajuanPindahSaya() { return this.pindahSaya; }
                },

                watch: {
                    loading(v) {
                        if (v) {
                            clearTimeout(this._loadingWatchdog);
                            this._loadingWatchdog = setTimeout(() => {
                                if (this.loading) {
                                    this.loading = false;
                                    this.pendingCalls = 0;
                                }
                            }, 4000); // Otomatis tutup spinner maksimal 4 detik agar tidak pernah macet
                        } else {
                            clearTimeout(this._loadingWatchdog);
                        }
                    },
                    trxSearch(v) { this.tunda('qTrx', () => { this.qTrx = (v || '').toLowerCase().trim(); this.limitMasuk = 100; this.limitKeluar = 100; }); },
                    statusSearch(v) { this.tunda('qStatus', () => { this.qStatus = (v || '').toLowerCase().trim(); }); },
                    akunSearch(v) { this.tunda('qAkun', () => { this.qAkun = (v || '').toLowerCase().trim(); }); },
                    chatSearch(v) { this.tunda('qChat', () => { this.qChat = (v || '').toLowerCase().trim(); }); },
                    tabTrx() { this.limitMasuk = 100; this.limitKeluar = 100; },
                    tabLap(v) {
                        if (v === 'tahunan') this.$nextTick(() => this.gambarChartTahunan());
                        if (v === 'tunggakan') this.muatTunggakan();
                    },
                    dark() {
                        if (this.page === 'dashboard' && this.isAdmin) this.$nextTick(() => this.gambarChart());
                        if (this.page === 'laporan' && this.tabLap === 'tahunan') this.$nextTick(() => this.gambarChartTahunan());
                        if (this.page === 'aruskas') this.$nextTick(() => this.gambarChartArus());
                    }
                },

                mounted() {
                    const bl = document.getElementById('boot');
                    if (bl) bl.remove();
                    this.dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.classList.toggle('dark', this.dark);
                    if (window.Chart) Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
                    window.addEventListener('message', this.terimaPesanAuth);
                    document.addEventListener('visibilitychange', () => {
                        if (!document.hidden && this.token) { this.updateHeartbeat(); this.muatNotif(); }
                    });
                    this.mulai();
                    this.jadwalkanIkon();
                },

                updated() { this.jadwalkanIkon(); },
                beforeUnmount() { this.stopPollingChat(); this.stopHeartbeat(); },

                methods: {
                    /* ---------- utilitas ---------- */
                    tunda(key, fn, ms) { clearTimeout(this._timers[key]); this._timers[key] = setTimeout(fn, ms || 200); },
                    jadwalkanIkon() { clearTimeout(this._ikonTimer); this._ikonTimer = setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 60); },
                    printPage() { window.print(); },
                    toggleDark() { this.dark = !this.dark; document.documentElement.classList.toggle('dark', this.dark); },
                    rupiah(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
                    tglPendek(s) {
                        if (!s) return '—';
                        const d = new Date(s); if (isNaN(d)) return s;
                        return d.getDate() + ' ' + this.BULAN_ID[d.getMonth()].substring(0, 3) + ' ' + d.getFullYear();
                    },
                    tglPanjang(s) {
                        if (!s) return '—';
                        const d = new Date(s); if (isNaN(d)) return s;
                        return d.getDate() + ' ' + this.BULAN_ID[d.getMonth()] + ' ' + d.getFullYear();
                    },
                    jamPesan(s) {
                        if (!s) return '';
                        const d = new Date(s); if (isNaN(d)) return '';
                        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                    },
                    inisialDari(nama) {
                        const n = String(nama || '?').trim();
                        return n.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
                    },
                    chipTagihan(s) {
                        if (s === 'Lunas') return 'chip-ok';
                        if (s === 'Menunggu verifikasi') return 'chip-warn';
                        if (s === 'Di luar periode iuran' || s === 'Belum jatuh tempo') return 'chip-mute';
                        return 'chip-bad';
                    },
                    chipStatusIuran(s) {
                        if (s === 'Lunas') return 'chip-ok';
                        if (s === 'Menunggu Verifikasi' || s === 'Kurang Bayar') return 'chip-warn';
                        return 'chip-bad';
                    },
                    aksiUtama() {
                        if (this.isAdmin) {
                            if (this.page === 'galeri') return this.bukaFormGaleri();
                            return this.tabTrx === 'masuk' ? this.bukaFormMasuk() : this.bukaFormKeluar();
                        }
                        this.bukaFormBayar();
                    },

                    /* ---------- badge ---------- */
                    badgeSingle(key) {
                        const n = this.notif || {};
                        if (key === 'transaksi') return this.isAdmin ? (n.transaksi || 0) : 0;
                        if (key === 'akun') return this.isAdmin ? (n.akun || 0) : 0;
                        if (key === 'pindah') return this.isAdmin ? (n.pindah || 0) : 0;
                        if (key === 'chat') return n.chat || 0;
                        return 0;
                    },
                    badge(key) {
                        if (key === 'more') return this.menuLainnya.reduce((s, m) => s + this.badgeSingle(m.key), 0);
                        return this.badgeSingle(key);
                    },
                    terapkanNotif(n) {
                        if (!n) return;
                        this.notif = { transaksi: n.transaksi || 0, akun: n.akun || 0, pindah: n.pindah || 0, chat: n.chat || 0 };
                        if (this.isAdmin && this.dash) {
                            this.dash.menungguVerifikasi = this.notif.transaksi;
                            this.dash.akunMenunggu = this.notif.akun;
                            this.dash.pindahMenunggu = this.notif.pindah;
                            this.dash.chatBelumDibaca = this.notif.chat;
                        } else {
                            this.warga.chatBelumDibaca = this.notif.chat;
                        }
                    },
                    async muatNotif() {
                        if (!this.token || !this.profil || this.profil.Status !== 'Aktif') return;
                        try { this.terapkanNotif(await this.jalankan('getNotifikasi', [this.token])); } catch (e) { }
                    },

                    /* ---------- toast & token ---------- */
                    toast(msg, type) {
                        const id = Date.now() + Math.random();
                        this.toasts.push({ id, msg, type: type || 'info' });
                        setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 4000);
                    },
                    simpanToken(t) { this.token = t; try { localStorage.setItem('kaslm_token', t || ''); } catch (e) { } },
                    ambilToken() { try { return localStorage.getItem('kaslm_token') || null; } catch (e) { return null; } },
                    emailAktif() { return (this.profil && this.profil.Email) || 'anon'; },

                    async jalankan(fn, args) {
                        // Utamakan Supabase Backend (< 50ms)
                        if (window.SupabaseBackend && typeof window.SupabaseBackend[fn] === 'function') {
                            try {
                                return await window.SupabaseBackend[fn].apply(window.SupabaseBackend, args || []);
                            } catch (err) {
                                console.error('Supabase error on ' + fn + ':', err);
                                throw err;
                            }
                        }
                        try {
                            const res = await fetch(API_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'text/plain;charset=utf-8'
                                },
                                body: JSON.stringify({ action: fn, args: args || [] })
                            });
                            const data = await res.json();
                            if (!data.ok) {
                                throw new Error(data.error || 'Terjadi kesalahan pada server');
                            }
                            return data.result;
                        } catch (err) {
                            throw err;
                        }
                    },
                    call(fn) {
                        const args = Array.prototype.slice.call(arguments, 1);
                        this.pendingCalls++; this.loading = true;
                        return this.jalankan(fn, args)
                            .then(res => { this.akhirCall(); return res; })
                            .catch(err => {
                                this.akhirCall();
                                const msg = (err && err.message) || 'Terjadi kesalahan.';
                                this.toast(msg, 'error');
                                if (/Sesi berakhir/i.test(msg)) this.keluarPaksa();
                                throw err;
                            });
                    },
                    akhirCall() { this.pendingCalls = Math.max(0, this.pendingCalls - 1); this.loading = this.pendingCalls > 0; },

                    /* ---------- cache lokal ---------- */
                    bacaCache(kunci) { try { const raw = localStorage.getItem(PREFIX_DATA + kunci); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
                    tulisCache(kunci, val) {
                        try {
                            localStorage.setItem(PREFIX_DATA + kunci, JSON.stringify(val));
                            localStorage.setItem(PREFIX_WAKTU + kunci, String(Date.now()));
                        } catch (e) { this.bersihkanCache(); }
                    },
                    cacheSegar(kunci, ttl) {
                        try {
                            const t = Number(localStorage.getItem(PREFIX_WAKTU + kunci) || 0);
                            return t > 0 && (Date.now() - t) < (ttl || TTL);
                        } catch (e) { return false; }
                    },
                    batalkanCache(awalanList) {
                        const daftar = [].concat(awalanList);
                        try {
                            Object.keys(localStorage).forEach(k => {
                                if (k.indexOf(PREFIX_DATA) !== 0 && k.indexOf(PREFIX_WAKTU) !== 0) return;
                                const kunci = k.replace(PREFIX_DATA, '').replace(PREFIX_WAKTU, '');
                                if (daftar.some(a => kunci.indexOf(a) === 0)) localStorage.removeItem(k);
                            });
                        } catch (e) { }
                    },
                    bersihkanCache() {
                        try {
                            Object.keys(localStorage).filter(k => k.indexOf(PREFIX_DATA) === 0 || k.indexOf(PREFIX_WAKTU) === 0).forEach(k => localStorage.removeItem(k));
                        } catch (e) { }
                    },
                    async ambilDenganCache(kunci, fn, args, terapkan, paksaSegar, ttl) {
                        let adaCache = false;
                        if (!paksaSegar) {
                            const lama = this.bacaCache(kunci);
                            if (lama !== null) { terapkan(lama); adaCache = true; }
                            if (adaCache && this.cacheSegar(kunci, ttl)) return null;
                        }
                        if (!adaCache) {
                            this.pendingCalls++; this.loading = true;
                            try {
                                const res = await this.jalankan(fn, args);
                                terapkan(res); this.tulisCache(kunci, res);
                                return res;
                            } catch (err) {
                                const msg = (err && err.message) || 'Terjadi kesalahan.';
                                this.toast(msg, 'error');
                                if (/Sesi berakhir/i.test(msg)) this.keluarPaksa();
                                throw err;
                            } finally { this.akhirCall(); }
                        }
                        this.menyegarkan++;
                        try {
                            const res = await this.jalankan(fn, args);
                            terapkan(res); this.tulisCache(kunci, res);
                            return res;
                        } catch (err) { return null; }
                        finally { this.menyegarkan = Math.max(0, this.menyegarkan - 1); }
                    },
                    segarkan(kunci, fn, args, terapkan) { return this.ambilDenganCache(kunci, fn, args, terapkan, true); },

                    /* ---------- bundel awal ---------- */
                    async muatBundle() {
                        const email = this.emailAktif();
                        let b;
                        this.loadingText = 'Menyiapkan data';
                        try { b = await this.call('getBundleAwal', this.token, { bulan: this.statusBulan, tahun: this.statusTahun }); }
                        catch (e) { return false; }
                        if (!b) return false;
                        const per = (b.bulan || this.statusBulan) + '-' + (b.tahun || this.statusTahun);
                        const th = b.tahun || this.statusTahun;
                        const peta = this.isAdmin ? {
                            ['dash:' + email]: b.dash,
                            ['warga:' + email]: b.warga,
                            ['trxMasuk:' + email]: b.trxMasuk,
                            ['trxKeluar:' + email]: b.trxKeluar,
                            ['akun:' + email]: b.akun,
                            ['pengAdmin:' + email]: b.pengAdmin,
                            ['status:' + email + ':' + per]: b.status,
                            ['lapBulanan:' + email + ':' + per]: b.lapBulanan,
                            ['lapTahunan:' + email + ':' + th]: b.lapTahunan,
                            ['galeri:' + email]: b.galeri,
                            ['pindah:' + email]: b.pindah,
                            ['chatList:' + email]: b.chatList
                        } : {
                            ['beranda:' + email]: b.beranda,
                            ['tagihan:' + email + ':' + th]: b.tagihan,
                            ['riwayat:' + email + ':' + th]: b.riwayat,
                            ['arusKas:' + email + ':' + th]: b.arusKas,
                            ['galeri:' + email]: b.galeri,
                            ['pindahSaya:' + email]: b.pindah
                        };
                        Object.keys(peta).forEach(k => { if (peta[k] !== undefined && peta[k] !== null) this.tulisCache(k, peta[k]); });
                        if (b.notif) this.terapkanNotif(b.notif);
                        else if (!this.isAdmin) this.warga.chatBelumDibaca = b.chatUnread || 0;
                        this.loadingText = 'Memproses';
                        return true;
                    },

                    /* ---------- alur masuk ---------- */
                    async mulai() {
                        const pubLama = this.bacaCache('pub');
                        if (pubLama) this.publik = pubLama;
                        const t = this.ambilToken();
                        
                        // Muat data publik di latar belakang tanpa memblokir layar dengan spinner
                        this.jalankan('getPengaturanPublik', []).then(pub => {
                            if (pub) { this.publik = pub; this.tulisCache('pub', pub); }
                        }).catch(() => {});

                        if (!t) {
                            this.loading = false;
                            this.pendingCalls = 0;
                            return;
                        }

                        let p;
                        try { p = await this.jalankan('getProfil', [t]); } catch (e) { this.keluarPaksa(); return; }
                        if (!p) { this.keluarPaksa(); return; }
                        this.token = t;
                        this.terapkanProfil(p);
                        if (p.Status === 'Aktif') {
                            this.page = this.isAdmin ? 'dashboard' : 'beranda';
                            await this.muatBundle();
                            await this.muatHalaman(this.page);
                            this.startHeartbeat();
                        }
                        this.loading = false;
                        this.pendingCalls = 0;
                    },
                    terapkanProfil(p) {
                        this.profil = p;
                        this.formProfil = { Nama: p.Nama, No_HP: p.No_HP, Tema: p.Tema || 'sistem', Notif_Email: p.Notif_Email !== false, Notif_WA: p.Notif_WA !== false };
                        this.formDaftar = Object.assign({}, this.formDaftar, {
                            Nama: p.Nama || this.formDaftar.Nama,
                            No_Rumah: p.No_Rumah || this.formDaftar.No_Rumah,
                            No_HP: p.No_HP || this.formDaftar.No_HP
                        });
                        this.terapkanTema(p.Tema);
                    },
                    terapkanTema(tema) {
                        if (tema === 'terang') this.dark = false;
                        else if (tema === 'gelap') this.dark = true;
                        else this.dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                        document.documentElement.classList.toggle('dark', this.dark);
                    },
                    async muatProfil() {
                        if (!this.token) return;
                        let p; 
                        try { p = await this.jalankan('getProfil', [this.token]); } catch (e) { this.keluarPaksa(); return; }
                        if (!p) { this.keluarPaksa(); return; }
                        this.terapkanProfil(p);
                        if (p.Status === 'Aktif') {
                            this.page = this.isAdmin ? 'dashboard' : 'beranda';
                            await this.muatBundle();
                            await this.muatHalaman(this.page);
                            this.startHeartbeat();
                            if (this.formDaftar.Foto_base64 && this.formDaftar.Foto_mime) {
                                try {
                                    await this.jalankan('uploadFotoProfil', [this.token, this.formDaftar.Foto_base64,
                                        'foto-daftar.' + (this.formDaftar.Foto_mime.split('/')[1] || 'jpg'), this.formDaftar.Foto_mime]);
                                } catch (e) { }
                                this.formDaftar.Foto_base64 = ''; this.formDaftar.Foto_mime = '';
                                try { this.profil = await this.jalankan('getProfil', [this.token]); } catch (e) { }
                            }
                        }
                        this.loading = false;
                        this.pendingCalls = 0;
                    },
                    async mulaiGoogle() {
                        if (this.modeAuth === 'daftar') {
                            if (!this.formDaftar.Nama || !this.formDaftar.Blok || !this.formDaftar.Nomor) {
                                this.toast('Lengkapi nama, blok, dan nomor rumah.', 'error'); return;
                            }
                            this.formDaftar.No_Rumah = (this.formDaftar.Blok + '-' + this.formDaftar.Nomor).toUpperCase();
                        }

                        // Google Identity Services (GIS) Popup - mendukung multi-akun bebas error
                        if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                            let clientId = (this.publik && this.publik.Google_Client_Id) || '';
                            if (!clientId) {
                                try { clientId = await this.jalankan('getGoogleClientId', []); } catch (e) { }
                            }
                            if (!clientId) {
                                clientId = '629674748384-jlugeggi5u75tbumsrhagjh1n3bqsm5l.apps.googleusercontent.com';
                            }
                            
                            const client = google.accounts.oauth2.initTokenClient({
                                client_id: clientId,
                                scope: 'openid email profile',
                                callback: async (tokenResponse) => {
                                    if (tokenResponse.error) {
                                        this.toast('Login dibatalkan: ' + (tokenResponse.error_description || tokenResponse.error), 'error');
                                        return;
                                    }
                                    try {
                                        this.loading = true;
                                        const res = await this.jalankan('loginDenganGoogleToken', [tokenResponse.access_token]);
                                        if (res && res.ok) {
                                            this.simpanToken(res.token);
                                            if (this.modeAuth === 'daftar') {
                                                await this.jalankan('lengkapiPendaftaran', [res.token, {
                                                    Nama: this.formDaftar.Nama,
                                                    No_Rumah: this.formDaftar.No_Rumah,
                                                    No_HP: this.formDaftar.No_HP
                                                }]);
                                            }
                                            await this.muatProfil();
                                            this.toast('Berhasil masuk sebagai ' + res.email, 'success');
                                        } else {
                                            throw new Error((res && res.message) || 'Gagal membuat sesi login.');
                                        }
                                    } catch (err) {
                                        this.toast('Login gagal: ' + (err.message || err), 'error');
                                    } finally {
                                        this.loading = false;
                                    }
                                }
                            });
                            client.requestAccessToken({ prompt: 'select_account' });
                            return;
                        }

                        // Fallback ke alur lama
                        const res = await this.call('getAuthUrl');
                        if (!res.ok) { this.toast(res.message, 'error'); return; }
                        this.authState = res.state;
                        const w = window.open(res.url, 'login_google', 'width=480,height=660');
                        if (!w) { this.toast('Popup diblokir browser.', 'error'); return; }
                        this.mulaiPolling();
                    },
                    mulaiPolling() {
                        let n = 0;
                        clearInterval(this.pollTimer);
                        this.pollTimer = setInterval(async () => {
                            n++;
                            if (n > 60 || this.profil) { clearInterval(this.pollTimer); return; }
                            try {
                                const r = await this.jalankan('claimSession', [this.authState]);
                                if (r && r.ok) { clearInterval(this.pollTimer); this.simpanToken(r.token); await this.muatProfil(); }
                            } catch (e) { }
                        }, 2500);
                    },
                    async terimaPesanAuth(ev) {
                        const d = ev && ev.data;
                        if (!d || d.type !== 'KASLM_AUTH') return;
                        clearInterval(this.pollTimer);
                        if (!d.ok) { this.toast('Login Google dibatalkan.', 'error'); return; }
                        this.simpanToken(d.token);
                        await this.muatProfil();
                        this.toast('Berhasil masuk.', 'success');
                    },
                    async masukAkunAktif() {
                        try { const r = await this.call('loginDenganAkunAktif'); this.simpanToken(r.token); await this.muatProfil(); } catch (e) { }
                    },
                    async masukPin() {
                        let r; try { r = await this.call('loginPin', this.pinInput); } catch (e) { return; }
                        if (!r.ok) { this.toast(r.message, 'error'); return; }
                        this.pinInput = ''; this.pinTerbuka = false;
                        this.simpanToken(r.token); await this.muatProfil();
                        this.toast('Masuk sebagai bendahara.', 'success');
                    },
                    async keluar() {
                        this.stopPollingChat(); this.stopHeartbeat();
                        if (this.token) { try { await this.call('logout', this.token); } catch (e) { } }
                        this.keluarPaksa();
                    },
                    keluarPaksa() {
                        this.stopPollingChat(); this.stopHeartbeat(); this.musnahkanChart();
                        this.simpanToken(''); this.bersihkanCache();
                        this.token = null; this.profil = null; this.page = 'dashboard';
                        this.lightbox = null; this.chatAktif = null; this.chatPesan = [];
                        this.notif = { transaksi: 0, akun: 0, pindah: 0, chat: 0 };
                    },
                    pilihFotoDaftar(e) {
                        const f = e.target.files[0]; if (!f) return;
                        if (f.size > 3 * 1024 * 1024) { this.toast('Foto maksimal 3 MB.', 'error'); e.target.value = ''; return; }
                        const r = new FileReader();
                        r.onload = () => { this.formDaftar.Foto_base64 = r.result.split(',')[1]; this.formDaftar.Foto_mime = f.type; };
                        r.readAsDataURL(f);
                    },
                    async kirimPendaftaran() {
                        try {
                            await this.call('lengkapiPendaftaran', this.token,
                                { Nama: this.formDaftar.Nama, No_Rumah: this.formDaftar.No_Rumah, No_HP: this.formDaftar.No_HP });
                        } catch (e) { return; }
                        await this.muatProfil();
                        this.toast('Pendaftaran berhasil. Selamat datang!', 'success');
                    },

                    /* ---------- navigasi ---------- */
                    goTo(key) {
                        if (this.page !== key) this.musnahkanChart();
                        if (this.page === 'chat' && key !== 'chat') this.stopPollingChat();
                        this.page = key; this.moreSheet = false;
                        window.scrollTo({ top: 0 });
                        this.muatHalaman(key);
                        if (key === 'chat') this.$nextTick(() => this.afterMasukChat());
                    },
                    muatUlangHalaman() { this.muatHalaman(this.page, true); this.muatNotif(); this.toast('Mengambil data terbaru.', 'info'); },
                    async muatHalaman(key, paksa) {
                        const email = this.emailAktif();
                        if (this.isAdmin) {
                            if (key === 'dashboard') {
                                await this.ambilDenganCache('dash:' + email, 'getDashboardData', [this.token], res => {
                                    this.dash = res; this.$nextTick(() => this.gambarChart());
                                }, paksa);
                            }
                            if (key === 'transaksi') {
                                await Promise.all([
                                    this.muatTransaksi(paksa),
                                    this.ambilDenganCache('warga:' + email, 'getWargaList', [this.token], r => { this.wargaList = r; }, paksa, TTL_STATIS)
                                ]);
                            }
                            if (key === 'status') await this.muatStatus(paksa);
                            if (key === 'laporan') await Promise.all([this.muatLaporanBulanan(paksa), this.muatLaporanTahunan(paksa)]);
                            if (key === 'akun') {
                                await Promise.all([
                                    this.ambilDenganCache('akun:' + email, 'getDaftarAkun', [this.token], r => { this.akunList = r; }, paksa),
                                    this.ambilDenganCache('permintaanRumah:' + email, 'getPermintaanRumah', [this.token], r => { this.permintaanRumah = r; }, paksa)
                                ]);
                            }
                            if (key === 'pengaturan') {
                                await Promise.all([
                                    this.ambilDenganCache('pengAdmin:' + email, 'getPengaturanAdmin', [this.token], r => { this.setForm = Object.assign({}, r); }, paksa, TTL_STATIS),
                                    this.ambilDenganCache('warga:' + email, 'getWargaList', [this.token], r => { this.wargaList = r; }, paksa, TTL_STATIS)
                                ]);
                            }
                            if (key === 'galeri') await this.muatGaleri(paksa);
                            if (key === 'pindah') await this.ambilDenganCache('pindah:' + email, 'getPengajuanPindah', [this.token], r => { this.pindahList = r; }, paksa);
                            if (key === 'chat') {
                                await this.ambilDenganCache('chatList:' + email, 'getChatPercakapanAdmin', [this.token], r => { this.chatList = r; }, paksa);
                                this.startPollingChat();
                            }
                        } else {
                            if (key === 'beranda') {
                                await this.ambilDenganCache('beranda:' + email, 'getBerandaWarga', [this.token], r => {
                                    this.warga = Object.assign({}, r);
                                    if (r && typeof r.chatBelumDibaca === 'number') this.notif.chat = r.chatBelumDibaca;
                                }, paksa);
                            }
                            if (key === 'aruskas') await this.muatArusKas(paksa);
                            if (key === 'tagihan') await this.muatTagihan(paksa);
                            if (key === 'riwayat') await this.muatRiwayat(paksa);
                            if (key === 'galeri') await this.muatGaleri(paksa);
                            if (key === 'profil') await this.ambilDenganCache('pindahSaya:' + email, 'getPengajuanPindahSaya', [this.token], r => { this.pindahSaya = r; }, paksa);
                            if (key === 'chat') { await this.muatChatWarga(true); this.startPollingChat(); }
                        }
                    },

                    /* ---------- transaksi ---------- */
                    async muatTransaksi(paksaSegar) {
                        const email = this.emailAktif();
                        await Promise.all([
                            this.ambilDenganCache('trxMasuk:' + email, 'getTransaksiMasuk', [this.token], r => { this.listMasuk = r; }, !!paksaSegar),
                            this.ambilDenganCache('trxKeluar:' + email, 'getTransaksiKeluar', [this.token], r => { this.listKeluar = r; }, !!paksaSegar)
                        ]);
                    },
                    batalkanTurunanTransaksi() {
                        const email = this.emailAktif();
                        this.batalkanCache(['dash:' + email, 'status:' + email, 'tunggakan:' + email, 'lapBulanan:' + email, 'lapTahunan:' + email]);
                    },
                    isiNamaOtomatis() {
                        const w = this.wargaList.find(x => x.No_Rumah === this.formMasuk.No_Rumah);
                        this.formMasuk.Nama_Warga = w ? w.Nama_Warga : '';
                    },
                    bukaFormMasuk(t) {
                        this.formMasuk = t ? Object.assign({}, t) : {
                            Periode_Bulan: new Date().getMonth() + 1, Periode_Tahun: new Date().getFullYear(),
                            Tanggal: new Date().toISOString().slice(0, 10), Metode_Bayar: 'Tunai', Status: 'Lunas',
                            Jenis_Iuran: 'Kas Bulanan', Jumlah_Bayar: Number(this.publik.Nominal_Kas_Bulanan) || 0
                        };
                        this.modal = 'masuk';
                    },
                    async simpanMasuk() {
                        if (!this.formMasuk.No_Rumah || !this.formMasuk.Jumlah_Bayar) return this.toast('Nomor rumah dan jumlah wajib diisi.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try {
                            if (this.formMasuk.ID_Transaksi) await this.call('updateTransaksiMasuk', this.token, this.formMasuk.ID_Transaksi, this.formMasuk);
                            else await this.call('addTransaksiMasuk', this.token, this.formMasuk);
                        } catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null; this.toast('Kas masuk tersimpan.', 'success');
                        this.batalkanTurunanTransaksi();
                        await this.muatTransaksi(true); this.muatNotif();
                    },
                    async hapusMasuk(t) {
                        if (!confirm('Hapus transaksi ' + t.No_Rumah + '?')) return;
                        try { await this.call('deleteTransaksiMasuk', this.token, t.ID_Transaksi); } catch (e) { return; }
                        this.toast('Transaksi dihapus.', 'success');
                        this.batalkanTurunanTransaksi();
                        await this.muatTransaksi(true); this.muatNotif();
                    },
                    async verifikasi(t) {
                        let r; try { r = await this.call('verifikasiPembayaran', this.token, t.ID_Transaksi); } catch (e) { return; }
                        this.batalkanTurunanTransaksi();
                        await this.muatTransaksi(true); this.muatNotif();
                        this.toast('Pembayaran diverifikasi.', 'success');
                        this.tampilkanWa(r);
                    },
                    bukaFormKeluar(t) {
                        this.formKeluar = t ? Object.assign({}, t) : { Tanggal: new Date().toISOString().slice(0, 10), Kategori_Pengeluaran: 'Perbaikan Jalan' };
                        this.modal = 'keluar';
                    },
                    async simpanKeluar() {
                        if (!this.formKeluar.Kategori_Pengeluaran || !this.formKeluar.Jumlah) return this.toast('Kategori dan jumlah wajib diisi.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try {
                            if (this.formKeluar.ID_Kategori) await this.call('updateTransaksiKeluar', this.token, this.formKeluar.ID_Kategori, this.formKeluar);
                            else await this.call('addTransaksiKeluar', this.token, this.formKeluar);
                        } catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null; this.toast('Kas keluar tersimpan.', 'success');
                        this.batalkanTurunanTransaksi();
                        await this.muatTransaksi(true);
                    },
                    async hapusKeluar(t) {
                        if (!confirm('Hapus pengeluaran ' + t.Kategori_Pengeluaran + '?')) return;
                        try { await this.call('deleteTransaksiKeluar', this.token, t.ID_Kategori); } catch (e) { return; }
                        this.toast('Transaksi dihapus.', 'success');
                        this.batalkanTurunanTransaksi();
                        await this.muatTransaksi(true);
                    },

                    unggah(e, target) {
                        const file = e.target.files[0]; if (!file) return;
                        if (file.size > 8 * 1024 * 1024) { this.toast('Ukuran maksimal 8 MB.', 'error'); e.target.value = ''; return; }
                        const reader = new FileReader();
                        reader.onload = async () => {
                            const base64 = reader.result.split(',')[1];
                            let res; try { res = await this.call('uploadBuktiFile', this.token, base64, file.name, file.type); } catch (err) { return; }
                            if (target === 'masuk') this.formMasuk.Proof_URL = res.url;
                            else if (target === 'keluar') this.formKeluar.Bukti_Nota_URL = res.url;
                            else this.formBayar.Proof_URL = res.url;
                            this.toast('Bukti terunggah.', 'success');
                        };
                        reader.readAsDataURL(file);
                    },

                    /* ---------- WhatsApp ---------- */
                    tampilkanWa(r) { if (!r) return; this.waModal = { mode: r.mode, hp: r.hp, url: r.url, pesan: r.pesan, message: r.message }; },
                    async kirimKuitansiWa(t) { try { this.tampilkanWa(await this.call('kirimNotifPembayaran', this.token, t.ID_Transaksi)); } catch (e) { } },
                    async kirimPengingatWa(noRumah) { try { this.tampilkanWa(await this.call('kirimPengingat', this.token, noRumah, this.statusBulan, this.statusTahun)); } catch (e) { } },
                    async kirimPengingatSemua() {
                        if (!confirm('Kirim pengingat ke ' + this.tunggakanList.length + ' warga?')) return;
                        let r; try { r = await this.call('kirimPengingatMassal', this.token, this.statusBulan, this.statusTahun); } catch (e) { return; }
                        const terkirim = (r.hasil || []).filter(h => h.status === 'terkirim').length;
                        if (r.otomatis) this.toast(terkirim + ' pengingat terkirim.', 'success');
                        else this.toast('Gateway WhatsApp belum aktif. Kirim satu per satu.', 'info');
                    },
                    async salinPesanWa() {
                        try { await navigator.clipboard.writeText(this.waModal.pesan); this.toast('Pesan disalin.', 'success'); }
                        catch (e) { this.toast('Salin manual dari kotak pesan.', 'error'); }
                    },
                    async salinNomor() {
                        const nomor = this.tunggakanList.map(w => w.No_HP).filter(Boolean).join(', ');
                        if (!nomor) return this.toast('Belum ada nomor WhatsApp tersimpan.', 'error');
                        try { await navigator.clipboard.writeText(nomor); this.toast('Nomor disalin.', 'success'); }
                        catch (e) { this.toast('Salin manual dari daftar.', 'error'); }
                    },

                    /* ---------- status & laporan ---------- */
                    async muatStatus(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('status:' + email + ':' + this.statusBulan + '-' + this.statusTahun, 'getStatusIuranWarga',
                            [this.token, this.statusBulan, this.statusTahun], r => { this.statusList = r; }, !!paksaSegar);
                    },
                    async muatTunggakan(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('tunggakan:' + email + ':' + this.statusBulan + '-' + this.statusTahun, 'getTunggakan',
                            [this.token, this.statusBulan, this.statusTahun], r => { this.tunggakanList = r; }, !!paksaSegar);
                    },
                    async muatLaporanBulanan(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('lapBulanan:' + email + ':' + this.lapBulan + '-' + this.lapTahun, 'getLaporanBulanan',
                            [this.token, this.lapBulan, this.lapTahun], r => { this.lapData = r; }, !!paksaSegar);
                    },
                    async muatLaporanRentang() {
                        if (!this.rangeStart || !this.rangeEnd) return this.toast('Pilih rentang tanggalnya dulu.', 'error');
                        if (this.rangeStart > this.rangeEnd) return this.toast('Tanggal awal melewati tanggal akhir.', 'error');
                        const email = this.emailAktif();
                        await this.ambilDenganCache('lapRentang:' + email + ':' + this.rangeStart + '_' + this.rangeEnd, 'getLaporanMingguan',
                            [this.token, this.rangeStart, this.rangeEnd], r => { this.lapData = r; }, true);
                    },
                    async muatLaporanTahunan(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('lapTahunan:' + email + ':' + this.tahunLap, 'getLaporanTahunan', [this.token, this.tahunLap], r => {
                            this.lapTahunan = r;
                            if (this.tabLap === 'tahunan') this.$nextTick(() => this.gambarChartTahunan());
                        }, !!paksaSegar);
                    },
                    async exportLaporan() {
                        let headers, rows, judul;
                        if (this.tabLap === 'bulanan' || this.tabLap === 'rentang') {
                            headers = ['Tanggal', 'No_Rumah', 'Nama_Warga', 'Jenis_Iuran', 'Jumlah_Bayar'];
                            rows = ((this.lapData && this.lapData.rincianMasuk) || []).map(r => [r.Tanggal, r.No_Rumah, r.Nama_Warga, r.Jenis_Iuran, r.Jumlah_Bayar]);
                            judul = 'Kas_Masuk_' + Date.now();
                        } else if (this.tabLap === 'tahunan') {
                            headers = ['Bulan', 'Total_Masuk', 'Total_Keluar', 'Saldo_Mengendap'];
                            rows = (this.lapTahunan.bulananArr || []).map(b => [b.bulan, b.totalMasuk, b.totalKeluar, b.saldoMengendap]);
                            judul = 'Tahunan_' + this.tahunLap;
                        } else {
                            headers = ['No_Rumah', 'Nama_Warga', 'No_HP'];
                            rows = this.tunggakanList.map(t => [t.No_Rumah, t.Nama_Warga, t.No_HP]);
                            judul = 'Tunggakan_' + this.statusBulan + '_' + this.statusTahun;
                        }
                        if (!rows.length) return this.toast('Tidak ada baris untuk diekspor.', 'error');
                        let res; try { res = await this.call('exportLaporanToSheet', this.token, judul, headers, rows); } catch (e) { return; }
                        this.toast('Diekspor ke Google Sheet.', 'success');
                        window.open(res.url, '_blank');
                    },

                    /* ---------- galeri ---------- */
                    async muatGaleri(paksaSegar) {
                        const email = this.emailAktif();
                        try { this.kategoriGaleri = await this.jalankan('getGaleriKategori', []); } catch (e) { }
                        await this.ambilDenganCache('galeri:' + email, 'getGaleriList', [this.token, null], r => { this.galeriList = r; }, !!paksaSegar);
                    },
                    bukaFormGaleri(a) {
                        this.formGaleri = a ? {
                            ID_Galeri: a.ID_Galeri, Judul_Kegiatan: a.Judul_Kegiatan, Kategori: a.Kategori,
                            Deskripsi: a.Deskripsi, Tanggal_Kegiatan: a.Tanggal_Kegiatan, Status: a.Status
                        } : { Judul_Kegiatan: '', Kategori: 'Kerja bakti', Deskripsi: '', Tanggal_Kegiatan: new Date().toISOString().slice(0, 10), Status: 'Aktif' };
                        this.modal = 'galeri';
                    },
                    async simpanGaleri() {
                        if (!this.formGaleri.Judul_Kegiatan) return this.toast('Judul kegiatan wajib diisi.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try {
                            if (this.formGaleri.ID_Galeri) await this.call('updateGaleri', this.token, this.formGaleri.ID_Galeri, this.formGaleri);
                            else await this.call('addGaleri', this.token, this.formGaleri);
                        } catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null; this.toast('Album tersimpan.', 'success');
                        await this.muatGaleri(true);
                    },
                    async hapusGaleri(a) {
                        if (!confirm('Hapus album "' + a.Judul_Kegiatan + '" beserta semua fotonya?')) return;
                        try { await this.call('deleteGaleri', this.token, a.ID_Galeri); } catch (e) { return; }
                        this.toast('Album dihapus.', 'success');
                        await this.muatGaleri(true);
                    },
                    bukaUploadFoto(alb) {
                        this.albumUpload = alb;
                        this.progressUpload = { total: 0, selesai: 0 };
                        this.modal = 'uploadFoto';
                    },
                    async unggahFotoGaleri(e) {
                        if (!this.albumUpload) return;
                        const files = Array.from(e.target.files || []);
                        if (!files.length) return;
                        this.progressUpload = { total: files.length, selesai: 0 };
                        for (const f of files) {
                            if (f.size > 5 * 1024 * 1024) { this.toast('"' + f.name + '" lebih dari 5 MB, dilewati.', 'error'); this.progressUpload.selesai++; continue; }
                            try {
                                const base64 = await this.bacaBase64(f);
                                await this.call('uploadFotoGaleri', this.token, this.albumUpload.ID_Galeri, base64, f.name, f.type);
                                this.progressUpload.selesai++;
                            } catch (err) { this.progressUpload.selesai++; }
                        }
                        this.toast('Selesai mengunggah ' + this.progressUpload.selesai + ' foto.', 'success');
                        e.target.value = '';
                        await this.muatGaleri(true);
                        this.modal = null;
                    },
                    bacaBase64(file) {
                        return new Promise((resolve, reject) => {
                            const r = new FileReader();
                            r.onload = () => resolve(r.result.split(',')[1]);
                            r.onerror = reject;
                            r.readAsDataURL(file);
                        });
                    },
                    /* Nama berbeda dari hapus foto profil supaya tidak saling menimpa. */
                    async hapusFotoAlbum(alb, f) {
                        if (!confirm('Hapus foto ini?')) return;
                        try { await this.call('deleteFotoGaleri', this.token, f.ID_Foto); } catch (e) { return; }
                        this.toast('Foto dihapus.', 'success');
                        await this.muatGaleri(true);
                    },
                    bukaLightbox(alb, i) { this.lightbox = { album: alb, index: i }; },
                    nextFoto() { if (!this.lightbox) return; const n = this.lightbox.album.Foto.length; this.lightbox.index = (this.lightbox.index + 1) % n; },
                    prevFoto() { if (!this.lightbox) return; const n = this.lightbox.album.Foto.length; this.lightbox.index = (this.lightbox.index - 1 + n) % n; },

                    /* ---------- chat ---------- */
                    afterMasukChat() {
                        this.$nextTick(() => this.scrollChat());
                        if (this.isAdmin && !this.chatAktif && this.chatList.length && window.innerWidth >= 1024) {
                            this.bukaChatWarga(this.chatList[0].Email_Warga);
                        }
                    },
                    scrollChat() { const el = this.$refs.chatBox; if (el) el.scrollTop = el.scrollHeight; },
                    async bukaChatWarga(emailWarga) {
                        try {
                            const r = await this.jalankan('getChatAdminDenganWarga', [this.token, emailWarga]);
                            const item = this.chatList.find(c => c.Email_Warga === emailWarga) || {};
                            this.chatAktif = {
                                Email_Warga: emailWarga, Nama_Warga: item.Nama_Warga || emailWarga,
                                No_Rumah: item.No_Rumah || '', Avatar: item.Avatar || '',
                                Online: r.Online, Last_Aktif: r.Last_Aktif
                            };
                            this.chatPesan = r.Pesan || [];
                            await this.tandaiDibaca();
                            this.$nextTick(() => this.scrollChat());
                        } catch (e) { }
                    },
                    async muatChatWarga(pertamaKali) {
                        try {
                            const pesan = await this.jalankan('getChatPercakapanSaya', [this.token]);
                            const berubah = pertamaKali || (pesan || []).length !== this.chatPesan.length;
                            this.chatPesan = pesan || [];
                            const st = await this.jalankan('getChatAdminDenganWarga', [this.token, 'admin']);
                            this.chatAdminOnline = !!(st && st.Online);
                            if (berubah) this.$nextTick(() => this.scrollChat());
                            if (this.chatPesan.some(m => m.Role_Pengirim === 'admin' && !m.Status_Baca)) await this.tandaiDibaca();
                        } catch (e) { }
                    },
                    async tandaiDibaca() {
                        if (!this.chatPesan || !this.chatPesan.length) return;
                        const belum = this.chatPesan.filter(m => !m.Status_Baca);
                        if (!belum.length) return;
                        const idPer = this.isAdmin
                            ? 'CW-' + String(this.chatAktif.Email_Warga).toLowerCase()
                            : 'CW-' + String(this.profil.Email).toLowerCase();
                        try { await this.jalankan('tandaiChatDibaca', [this.token, idPer]); } catch (e) { }
                        this.chatPesan.forEach(m => { if (!m.Status_Baca) m.Status_Baca = true; });
                        this.notif.chat = 0;
                        if (!this.isAdmin) this.warga.chatBelumDibaca = 0;
                        if (this.isAdmin && this.dash) this.dash.chatBelumDibaca = 0;
                        if (this.isAdmin) this.muatNotif();
                    },
                    startPollingChat() {
                        this.stopPollingChat();
                        this._pollChatTimer = setInterval(() => {
                            if (document.hidden || this.page !== 'chat') return;
                            if (this.isAdmin) {
                                if (this.chatAktif) this.refreshChatAdmin();
                                this.refreshChatListAdmin();
                            } else {
                                this.muatChatWarga(false);
                            }
                        }, 4000);
                    },
                    stopPollingChat() { if (this._pollChatTimer) { clearInterval(this._pollChatTimer); this._pollChatTimer = null; } },
                    async refreshChatAdmin() {
                        if (!this.chatAktif) return;
                        try {
                            const r = await this.jalankan('getChatAdminDenganWarga', [this.token, this.chatAktif.Email_Warga]);
                            const berubah = (r.Pesan || []).length !== this.chatPesan.length;
                            this.chatPesan = r.Pesan || [];
                            this.chatAktif.Online = r.Online;
                            this.chatAktif.Last_Aktif = r.Last_Aktif;
                            if (berubah) { await this.tandaiDibaca(); this.$nextTick(() => this.scrollChat()); }
                        } catch (e) { }
                    },
                    async refreshChatListAdmin() {
                        try { this.chatList = await this.jalankan('getChatPercakapanAdmin', [this.token]); } catch (e) { }
                    },
                    async kirimChat() {
                        const isi = (this.chatInput || '').trim();
                        if (!isi && !this.chatLampiranUrl) return;
                        const payload = { Isi_Pesan: isi, URL_Lampiran: this.chatLampiranUrl || '' };
                        if (this.isAdmin && this.chatAktif) payload.Email_Lawan = this.chatAktif.Email_Warga;
                        try { await this.jalankan('kirimPesanChat', [this.token, payload]); }
                        catch (e) { this.toast((e && e.message) || 'Gagal mengirim pesan.', 'error'); return; }
                        this.chatInput = ''; this.chatLampiranUrl = '';
                        if (this.isAdmin) await this.refreshChatAdmin();
                        else await this.muatChatWarga(false);
                        this.$nextTick(() => this.scrollChat());
                    },
                    async unggahLampiranChat(e) {
                        const file = e.target.files[0]; if (!file) return;
                        if (file.size > 8 * 1024 * 1024) { this.toast('Lampiran maksimal 8 MB.', 'error'); e.target.value = ''; return; }
                        try {
                            const base64 = await this.bacaBase64(file);
                            const r = await this.call('uploadLampiranChat', this.token, base64, file.name, file.type);
                            this.chatLampiranUrl = r.url;
                            this.toast('Lampiran siap dikirim.', 'success');
                        } catch (err) { }
                        e.target.value = '';
                    },
                    async hapusChat(c) {
                        if (!confirm('Hapus seluruh percakapan dengan ' + c.Nama_Warga + '?')) return;
                        try { await this.jalankan('hapusPercakapan', [this.token, 'CW-' + String(c.Email_Warga).toLowerCase()]); } catch (e) { return; }
                        this.chatAktif = null; this.chatPesan = [];
                        await this.refreshChatListAdmin(); this.muatNotif();
                        this.toast('Percakapan dihapus.', 'success');
                    },

                    /* ---------- heartbeat & notifikasi ---------- */
                    startHeartbeat() {
                        this.stopHeartbeat();
                        this._heartbeatTimer = setInterval(() => { if (!document.hidden) this.updateHeartbeat(); }, 60000);
                        this.updateHeartbeat();
                        this._notifTimer = setInterval(() => { if (!document.hidden) this.muatNotif(); }, 30000);
                        this.muatNotif();
                    },
                    stopHeartbeat() {
                        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
                        if (this._notifTimer) { clearInterval(this._notifTimer); this._notifTimer = null; }
                    },
                    async updateHeartbeat() { try { await this.jalankan('updateHeartbeat', [this.token]); } catch (e) { } },

                    /* ---------- pindah blok ---------- */
                    async ajukanPindah() {
                        if (!this.formPindah.Blok_Tujuan || !this.formPindah.No_Rumah_Tujuan) return this.toast('Isi blok dan nomor rumah tujuan.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try { await this.call('ajukanPindahBlok', this.token, this.formPindah); }
                        catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.formPindah = { Blok_Tujuan: '', No_Rumah_Tujuan: '', Alasan: '' };
                        this.toast('Pengajuan pindah terkirim.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['pindahSaya:' + email]);
                        await this.ambilDenganCache('pindahSaya:' + email, 'getPengajuanPindahSaya', [this.token], r => { this.pindahSaya = r; }, true);
                    },
                    async batalkanPindahBlok(p) {
                        if (!confirm('Batalkan pengajuan pindah ke ' + p.No_Rumah_Tujuan + '?')) return;
                        try { await this.call('batalkanPindahBlok', this.token, p.ID_Pengajuan); } catch (e) { return; }
                        this.toast('Pengajuan dibatalkan.', 'success');
                        const email = this.emailAktif();
                        await this.ambilDenganCache('pindahSaya:' + email, 'getPengajuanPindahSaya', [this.token], r => { this.pindahSaya = r; }, true);
                    },
                    async putuskanPindah(p, setuju) {
                        if (setuju && !confirm('Setujui pindah ' + p.No_Rumah_Asal + ' ke ' + p.No_Rumah_Tujuan + '?')) return;
                        try { await this.call('putuskanPindahBlok', this.token, p.ID_Pengajuan, setuju, ''); } catch (e) { return; }
                        this.toast(setuju ? 'Pindah disetujui.' : 'Pindah ditolak.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['akun:' + email, 'warga:' + email, 'dash:' + email, 'status:' + email]);
                        await this.ambilDenganCache('pindah:' + email, 'getPengajuanPindah', [this.token], r2 => { this.pindahList = r2; }, true);
                        this.muatNotif();
                    },

                    /* ---------- akun ---------- */
                    bukaFormAkun(a) { this.formAkun = Object.assign({}, a); this.modal = 'akun'; },
                    async simpanAkun() {
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try { await this.call('updateAkun', this.token, this.formAkun.ID_Akun, this.formAkun); }
                        catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null; this.toast('Akun diperbarui.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['warga:' + email, 'dash:' + email]);
                        await this.segarkan('akun:' + email, 'getDaftarAkun', [this.token], r => { this.akunList = r; });
                        this.muatNotif();
                    },
                    async setujuiAkun(a) {
                        if (!a.No_Rumah) { this.bukaFormAkun(a); return this.toast('Isi nomor rumah dulu.', 'info'); }
                        try {
                            await this.call('updateAkun', this.token, a.ID_Akun,
                                { Nama: a.Nama, No_Rumah: a.No_Rumah, No_HP: a.No_HP, Role: a.Role, Status: 'Aktif' });
                        } catch (e) { return; }
                        this.toast((a.Nama || a.Email) + ' disetujui.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['warga:' + email, 'dash:' + email, 'status:' + email]);
                        await this.segarkan('akun:' + email, 'getDaftarAkun', [this.token], r => { this.akunList = r; });
                        this.muatNotif();
                    },
                    async hapusAkunKlik(a) {
                        if (!confirm('Hapus akun ' + (a.Email || a.Nama) + '?')) return;
                        try { await this.call('hapusAkun', this.token, a.ID_Akun); } catch (e) { return; }
                        this.toast('Akun dihapus.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['dash:' + email]);
                        await this.segarkan('akun:' + email, 'getDaftarAkun', [this.token], r => { this.akunList = r; });
                        this.muatNotif();
                    },
                    async putuskanRumah(r, setuju) {
                        if (setuju && !confirm('Setujui pindah ke ' + r.Rumah_Diminta + '?')) return;
                        try { await this.call('putuskanPermintaanRumah', this.token, r.ID_Akun, setuju); } catch (e) { return; }
                        this.permintaanRumah = this.permintaanRumah.filter(x => x.ID_Akun !== r.ID_Akun);
                        this.toast(setuju ? 'Disetujui.' : 'Ditolak.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['akun:' + email, 'warga:' + email, 'dash:' + email]);
                        this.muatNotif();
                    },

                    /* ---------- warga (CRUD) ---------- */
                    bukaFormWarga(w) {
                        this.formWarga = w ? Object.assign({}, w) : { Status_Hunian: 'Tetap', Tanggal_Bergabung: new Date().toISOString().slice(0, 10) };
                        this.modal = 'warga';
                    },
                    async simpanWarga() {
                        if (!this.formWarga.No_Rumah || !this.formWarga.Nama_Warga) return this.toast('Nomor rumah dan nama wajib diisi.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try {
                            if (this.formWarga.ID_Warga) await this.call('updateWarga', this.token, this.formWarga.ID_Warga, this.formWarga);
                            else await this.call('addWarga', this.token, this.formWarga);
                        } catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null; this.toast('Data warga tersimpan.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['dash:' + email, 'status:' + email, 'tunggakan:' + email]);
                        await this.segarkan('warga:' + email, 'getWargaList', [this.token], r => { this.wargaList = r; });
                    },
                    async hapusWarga(w) {
                        if (!confirm('Hapus data warga ' + w.Nama_Warga + '?')) return;
                        try { await this.call('deleteWarga', this.token, w.ID_Warga); } catch (e) { return; }
                        this.toast('Data warga dihapus.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['dash:' + email, 'status:' + email, 'tunggakan:' + email]);
                        await this.segarkan('warga:' + email, 'getWargaList', [this.token], r => { this.wargaList = r; });
                    },

                    /* ---------- pengaturan ---------- */
                    async simpanPengaturan() {
                        try { await this.call('updatePengaturan', this.token, this.setForm); } catch (e) { return; }
                        this.publik = await this.call('getPengaturanPublik');
                        this.tulisCache('pub', this.publik);
                        this.batalkanCache(['pengAdmin:' + this.emailAktif(), 'beranda:', 'tagihan:', 'dash:', 'status:']);
                        this.toast('Pengaturan tersimpan.', 'success');
                    },
                    async unggahQr(e) {
                        const f = e.target.files[0]; if (!f) return;
                        try {
                            const base64 = await this.bacaBase64(f);
                            const r = await this.call('uploadQrCode', this.token, base64, f.name, f.type);
                            this.setForm.QR_Code_URL = r.url;
                            this.publik = await this.call('getPengaturanPublik');
                            this.tulisCache('pub', this.publik);
                            this.toast('QR Code diperbarui.', 'success');
                        } catch (err) { }
                        e.target.value = '';
                    },
                    async hapusQr() {
                        if (!confirm('Hapus QR Code pembayaran?')) return;
                        try { await this.call('hapusQrCode', this.token); } catch (e) { return; }
                        this.setForm.QR_Code_URL = '';
                        this.publik = await this.call('getPengaturanPublik');
                        this.tulisCache('pub', this.publik);
                        this.toast('QR dihapus.', 'success');
                    },
                    async backup() {
                        let r; try { r = await this.call('backupData', this.token); } catch (e) { return; }
                        this.toast('Cadangan dibuat: ' + r.name, 'success');
                        window.open(r.url, '_blank');
                    },

                    /* ---------- area warga ---------- */
                    async muatTagihan(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('tagihan:' + email + ':' + this.tahunTagihan, 'getTagihanSaya', [this.token, this.tahunTagihan], r => { this.tagihan = r; }, !!paksaSegar);
                    },
                    async muatArusKas(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('arusKas:' + email + ':' + this.tahunArus, 'getArusKasWarga', [this.token, this.tahunArus],
                            r => { this.arusKas = r; this.$nextTick(() => this.gambarChartArus()); }, !!paksaSegar);
                    },
                    async muatRiwayat(paksaSegar) {
                        const email = this.emailAktif();
                        await this.ambilDenganCache('riwayat:' + email + ':' + this.tahunRiwayat, 'getRiwayatSaya', [this.token, this.tahunRiwayat], r => { this.riwayat = r; }, !!paksaSegar);
                    },
                    bukaFormBayar(bulan) {
                        const now = new Date();
                        this.formBayar = {
                            Periode_Bulan: bulan || (now.getMonth() + 1),
                            Periode_Tahun: this.tahunTagihan || now.getFullYear(),
                            Jenis_Iuran: 'Kas Bulanan', Jumlah_Bayar: Number(this.publik.Nominal_Kas_Bulanan) || 0,
                            Metode_Bayar: 'Transfer', Tanggal: now.toISOString().slice(0, 10), Catatan: '', Proof_URL: ''
                        };
                        this.modal = 'bayar';
                    },
                    async kirimPengajuan() {
                        if (!this.formBayar.Jumlah_Bayar) return this.toast('Isi jumlah pembayarannya.', 'error');
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        try { await this.call('ajukanPembayaran', this.token, this.formBayar); }
                        catch (e) { return; } finally { this.sedangSimpan = false; }
                        this.modal = null;
                        this.toast('Konfirmasi terkirim. Menunggu verifikasi bendahara.', 'success');
                        const email = this.emailAktif();
                        this.batalkanCache(['beranda:' + email, 'tagihan:' + email, 'riwayat:' + email]);
                        await this.muatHalaman(this.page, true);
                    },
                    async simpanProfil() {
                        if (this.sedangSimpan) return;
                        this.sedangSimpan = true;
                        let r;
                        try { r = await this.call('updateProfilSaya', this.token, this.formProfil); }
                        catch (e) { return; } finally { this.sedangSimpan = false; }
                        if (r && r.profil) this.terapkanProfil(r.profil);
                        if (!r || !r.tidakAdaPerubahan) this.toast('Profil diperbarui.', 'success');
                    },
                    async unggahFoto(e) {
                        const file = e.target.files[0]; if (!file) return;
                        if (file.size > 3 * 1024 * 1024) { this.toast('Foto maksimal 3 MB.', 'error'); e.target.value = ''; return; }
                        try {
                            const base64 = await this.bacaBase64(file);
                            const res = await this.call('uploadFotoProfil', this.token, base64, file.name, file.type);
                            this.profil.Avatar = res.url; this.profil.Foto_URL = res.url;
                            this.toast('Foto diperbarui.', 'success');
                        } catch (err) { }
                        e.target.value = '';
                    },
                    async hapusFotoProfilKlik() {
                        let r; try { r = await this.call('hapusFotoProfil', this.token); } catch (e) { return; }
                        this.profil.Avatar = r.url || ''; this.profil.Foto_URL = '';
                        this.toast('Foto dihapus.', 'success');
                    },
                    async nonaktifkanAkun() {
                        if (!confirm('Nonaktifkan akun Anda?')) return;
                        let r; try { r = await this.call('nonaktifkanAkunSaya', this.token); } catch (e) { return; }
                        this.toast(r.message || 'Akun dinonaktifkan.', 'info');
                        this.keluarPaksa();
                    },
                    bukaKuitansi(t) { this.kuitansi = t; },

                    /* ---------- grafik ---------- */
                    warnaChart() {
                        return this.dark
                            ? { teks: '#8DA0B5', grid: 'rgba(255,255,255,.07)', masuk: '#3FBFA8', keluar: '#F0918A', netral: '#5A6E86' }
                            : { teks: '#6B7C91', grid: 'rgba(21,34,50,.07)', masuk: '#12796B', keluar: '#B93A2F', netral: '#3C4C60' };
                    },
                    pasangChart(key, id, cfg) {
                        const el = document.getElementById(id);
                        if (!el || !window.Chart) return;
                        const ada = this._charts[key];
                        if (ada && ada.config.type === cfg.type) { ada.data = cfg.data; ada.options = cfg.options; ada.update('none'); return; }
                        if (ada) ada.destroy();
                        this._charts[key] = new Chart(el, cfg);
                    },
                    musnahkanChart() {
                        Object.keys(this._charts).forEach(k => { if (this._charts[k]) this._charts[k].destroy(); delete this._charts[k]; });
                    },
                    opsiSumbu(w) {
                        return {
                            responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
                            plugins: { legend: { labels: { color: w.teks, usePointStyle: true, boxWidth: 8, padding: 14 } } },
                            scales: {
                                x: { ticks: { color: w.teks, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
                                y: { ticks: { color: w.teks, font: { size: 11 } }, grid: { color: w.grid }, border: { display: false } }
                            }
                        };
                    },
                    garis(labels, masuk, keluar, w) {
                        return {
                            labels: labels,
                            datasets: [
                                { label: 'Masuk', data: masuk, borderColor: w.masuk, backgroundColor: this.dark ? 'rgba(63,191,168,.14)' : 'rgba(18,121,107,.12)', tension: .38, fill: true, borderWidth: 2, pointRadius: 3, pointBackgroundColor: w.masuk },
                                { label: 'Keluar', data: keluar, borderColor: w.keluar, backgroundColor: this.dark ? 'rgba(240,145,138,.10)' : 'rgba(185,58,47,.08)', tension: .38, fill: true, borderWidth: 2, pointRadius: 3, pointBackgroundColor: w.keluar }
                            ]
                        };
                    },
                    gambarChart() {
                        if (!window.Chart) return;
                        const w = this.warnaChart();
                        const trend = this.dash.trend || [];
                        this.pasangChart('trend', 'chartTrend', {
                            type: 'line',
                            data: this.garis(trend.map(t => t.label), trend.map(t => t.masuk), trend.map(t => t.keluar), w),
                            options: this.opsiSumbu(w)
                        });
                        const sw = this.dash.statusWarga || { lunas: 0, belumLunas: 0 };
                        this.pasangChart('status', 'chartStatus', {
                            type: 'doughnut',
                            data: { labels: ['Lunas', 'Belum lunas'], datasets: [{ data: [sw.lunas, sw.belumLunas], backgroundColor: [w.masuk, this.dark ? '#E3A44A' : '#C98A2E'], borderWidth: 0 }] },
                            options: {
                                responsive: true, maintainAspectRatio: false, cutout: '64%', animation: { duration: 250 },
                                plugins: { legend: { position: 'bottom', labels: { color: w.teks, usePointStyle: true, boxWidth: 8, padding: 14 } } }
                            }
                        });
                        const kat = this.dash.pengeluaranKategori || [];
                        if (kat.length) this.pasangChart('kategori', 'chartKategori', {
                            type: 'bar',
                            data: { labels: kat.map(k => k.kategori), datasets: [{ data: kat.map(k => k.jumlah), backgroundColor: w.netral, borderRadius: 8, maxBarThickness: 42 }] },
                            options: Object.assign(this.opsiSumbu(w), { plugins: { legend: { display: false } } })
                        });
                        const jns = this.dash.pemasukanJenis || [];
                        if (jns.length) this.pasangChart('pemasukan', 'chartPemasukan', {
                            type: 'bar',
                            data: { labels: jns.map(k => k.jenis), datasets: [{ data: jns.map(k => k.jumlah), backgroundColor: w.masuk, borderRadius: 8, maxBarThickness: 42 }] },
                            options: Object.assign(this.opsiSumbu(w), { plugins: { legend: { display: false } } })
                        });
                    },
                    gambarChartTahunan() {
                        if (!window.Chart) return;
                        const w = this.warnaChart();
                        const arr = this.lapTahunan.bulananArr || [];
                        if (arr.length) this.pasangChart('lapTren', 'chartLapTren', {
                            type: 'line',
                            data: this.garis(arr.map(b => String(b.bulan).substring(0, 3)), arr.map(b => b.totalMasuk), arr.map(b => b.totalKeluar), w),
                            options: this.opsiSumbu(w)
                        });
                        const kat = this.lapTahunan.perKategoriTahun || [];
                        if (kat.length) this.pasangChart('tahunan', 'chartTahunanKategori', {
                            type: 'doughnut',
                            data: {
                                labels: kat.map(k => k.kategori), datasets: [{
                                    data: kat.map(k => k.jumlah),
                                    backgroundColor: ['#12796B', '#2E7DA8', '#C98A2E', '#B93A2F', '#6C5CA8', '#B2568C', '#169B88', '#5A6E86'], borderWidth: 0
                                }]
                            },
                            options: {
                                responsive: true, maintainAspectRatio: false, cutout: '56%', animation: { duration: 250 },
                                plugins: { legend: { position: 'bottom', labels: { color: w.teks, usePointStyle: true, boxWidth: 8, padding: 12 } } }
                            }
                        });
                    },
                    gambarChartArus() {
                        if (!window.Chart) return;
                        const w = this.warnaChart();
                        const trend = this.arusKas.trend || [];
                        if (trend.length) this.pasangChart('arusTrend', 'chartArusTrend', {
                            type: 'line',
                            data: this.garis(trend.map(t => t.label), trend.map(t => t.masuk), trend.map(t => t.keluar), w),
                            options: this.opsiSumbu(w)
                        });
                        const jns = this.arusKas.pemasukanJenis || [];
                        if (jns.length) this.pasangChart('arusJenis', 'chartArusJenis', {
                            type: 'bar',
                            data: { labels: jns.map(k => k.jenis), datasets: [{ data: jns.map(k => k.jumlah), backgroundColor: w.masuk, borderRadius: 8, maxBarThickness: 42 }] },
                            options: Object.assign(this.opsiSumbu(w), { plugins: { legend: { display: false } } })
                        });
                        const kat = this.arusKas.pengeluaranKategori || [];
                        if (kat.length) this.pasangChart('arusKategori', 'chartArusKategori', {
                            type: 'bar',
                            data: { labels: kat.map(k => k.kategori), datasets: [{ data: kat.map(k => k.jumlah), backgroundColor: w.netral, borderRadius: 8, maxBarThickness: 42 }] },
                            options: Object.assign(this.opsiSumbu(w), { plugins: { legend: { display: false } } })
                        });
                    }
                }
            }).mount('#app');
        }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulaiAplikasi);
        else mulaiAplikasi();