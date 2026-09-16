-- ============================================================================
-- SKEMA DATABASE KAS PERUMAHAN BLOK L/M (SUPABASE POSTGRESQL) - IDEMPOTENT
-- ============================================================================

-- 1. TABEL PENGATURAN
CREATE TABLE IF NOT EXISTS public.pengaturan (
    id SERIAL PRIMARY KEY,
    nama_perumahan TEXT DEFAULT 'Perumahan Blok L/M',
    nominal_kas_bulanan NUMERIC DEFAULT 150000,
    rekening_tujuan TEXT DEFAULT '1234567890 a.n. Bendahara - BCA',
    nama_bendahara TEXT DEFAULT 'Bendahara RT',
    admin_pin TEXT DEFAULT '123456',
    admin_emails TEXT DEFAULT '',
    wa_bendahara TEXT DEFAULT '',
    qr_code_url TEXT DEFAULT '',
    metode_pembayaran TEXT DEFAULT 'Transfer Bank',
    instruksi_pembayaran TEXT DEFAULT 'Transfer sesuai nominal, lalu unggah bukti pembayaran melalui aplikasi.',
    bulan_mulai_iuran INT DEFAULT 1,
    tahun_mulai_iuran INT DEFAULT 2024,
    pengaturan_aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Masukkan data awal pengaturan jika belum ada
INSERT INTO public.pengaturan (id, nama_perumahan, nominal_kas_bulanan, rekening_tujuan, nama_bendahara, admin_pin)
VALUES (1, 'Perumahan Blok L/M', 150000, '1234567890 a.n. Bendahara - BCA', 'Bendahara RT', '123456')
ON CONFLICT (id) DO NOTHING;

-- 2. TABEL WARGA
CREATE TABLE IF NOT EXISTS public.warga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_warga TEXT UNIQUE,
    no_rumah TEXT UNIQUE NOT NULL,
    nama_warga TEXT NOT NULL,
    status_hunian TEXT DEFAULT 'Tetap',
    no_hp TEXT DEFAULT '',
    tanggal_bergabung TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Contoh data awal warga
INSERT INTO public.warga (id_warga, no_rumah, nama_warga, status_hunian, no_hp)
VALUES 
    ('WRG-001', 'L-01', 'Contoh Warga 1', 'Tetap', '081200000001'),
    ('WRG-002', 'M-01', 'Contoh Warga 2', 'Tetap', '081200000002')
ON CONFLICT (no_rumah) DO NOTHING;

-- 3. TABEL AKUN
CREATE TABLE IF NOT EXISTS public.akun (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_akun TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL DEFAULT '',
    no_rumah TEXT DEFAULT '',
    no_hp TEXT DEFAULT '',
    role TEXT DEFAULT 'warga', -- 'admin' atau 'warga'
    status TEXT DEFAULT 'Aktif', -- 'Aktif', 'Baru', 'Menunggu', 'Nonaktif'
    tanggal_daftar TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ DEFAULT now(),
    foto TEXT DEFAULT '',
    foto_url TEXT DEFAULT '',
    tema TEXT DEFAULT 'sistem',
    notif_email BOOLEAN DEFAULT true,
    notif_wa BOOLEAN DEFAULT true,
    rumah_diminta TEXT DEFAULT '',
    alasan_pindah TEXT DEFAULT '',
    catatan_admin TEXT DEFAULT '',
    last_aktif TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABEL TRANSAKSI MASUK
CREATE TABLE IF NOT EXISTS public.transaksi_masuk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_transaksi TEXT UNIQUE,
    tanggal DATE DEFAULT CURRENT_DATE,
    no_rumah TEXT NOT NULL,
    nama_warga TEXT NOT NULL,
    jenis_iuran TEXT DEFAULT 'Kas Bulanan',
    jumlah_bayar NUMERIC NOT NULL DEFAULT 0,
    periode_bulan INT NOT NULL,
    periode_tahun INT NOT NULL,
    metode_bayar TEXT DEFAULT 'Transfer Bank',
    status TEXT DEFAULT 'Menunggu', -- 'Lunas', 'Menunggu', 'Ditolak'
    catatan TEXT DEFAULT '',
    proof_url TEXT DEFAULT '',
    diproses_oleh TEXT DEFAULT '',
    tanggal_diproses TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABEL TRANSAKSI KELUAR
CREATE TABLE IF NOT EXISTS public.transaksi_keluar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_kategori TEXT,
    tanggal DATE DEFAULT CURRENT_DATE,
    kategori_pengeluaran TEXT NOT NULL,
    jumlah NUMERIC NOT NULL DEFAULT 0,
    penanggung_jawab TEXT NOT NULL,
    bukti_nota_url TEXT DEFAULT '',
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABEL GALERI
CREATE TABLE IF NOT EXISTS public.galeri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_galeri TEXT UNIQUE,
    judul_kegiatan TEXT NOT NULL,
    kategori TEXT DEFAULT 'Kegiatan lainnya',
    deskripsi TEXT DEFAULT '',
    tanggal_kegiatan DATE DEFAULT CURRENT_DATE,
    dibuat_oleh TEXT DEFAULT '',
    tanggal_dibuat TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABEL GALERI FOTO
CREATE TABLE IF NOT EXISTS public.galeri_foto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_foto TEXT UNIQUE,
    id_galeri TEXT NOT NULL,
    nama_file TEXT DEFAULT '',
    url_foto TEXT NOT NULL,
    id_file_drive TEXT DEFAULT '',
    urutan INT DEFAULT 0,
    tanggal_upload TIMESTAMPTZ DEFAULT now(),
    diupload_oleh TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. TABEL CHAT
CREATE TABLE IF NOT EXISTS public.chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pesan TEXT UNIQUE,
    id_percakapan TEXT NOT NULL,
    email_pengirim TEXT NOT NULL,
    nama_pengirim TEXT NOT NULL,
    role_pengirim TEXT DEFAULT 'warga',
    email_penerima TEXT DEFAULT '',
    isi_pesan TEXT NOT NULL,
    url_lampiran TEXT DEFAULT '',
    waktu_kirim TIMESTAMPTZ DEFAULT now(),
    status_baca TEXT DEFAULT 'Belum',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. TABEL PENGAJUAN PINDAH BLOK
CREATE TABLE IF NOT EXISTS public.pengajuan_pindah_blok (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_pengajuan TEXT UNIQUE,
    email_pemohon TEXT NOT NULL,
    nama_pemohon TEXT NOT NULL,
    blok_asal TEXT DEFAULT '',
    no_rumah_asal TEXT NOT NULL,
    blok_tujuan TEXT DEFAULT '',
    no_rumah_tujuan TEXT NOT NULL,
    alasan TEXT DEFAULT '',
    tanggal_pengajuan TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'Menunggu',
    catatan_admin TEXT DEFAULT '',
    diproses_oleh TEXT DEFAULT '',
    tanggal_diproses TIMESTAMPTZ,
    dokumen_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- KEBIJAKAN AKSES & PERMISSIONS (ROW LEVEL SECURITY)
-- ============================================================================

ALTER TABLE public.pengaturan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akun ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_masuk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_keluar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.galeri_foto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengajuan_pindah_blok ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika sudah ada (agar tidak bentrok)
DROP POLICY IF EXISTS "Akses publik penuh pengaturan" ON public.pengaturan;
DROP POLICY IF EXISTS "Akses publik penuh warga" ON public.warga;
DROP POLICY IF EXISTS "Akses publik penuh akun" ON public.akun;
DROP POLICY IF EXISTS "Akses publik penuh transaksi_masuk" ON public.transaksi_masuk;
DROP POLICY IF EXISTS "Akses publik penuh transaksi_keluar" ON public.transaksi_keluar;
DROP POLICY IF EXISTS "Akses publik penuh galeri" ON public.galeri;
DROP POLICY IF EXISTS "Akses publik penuh galeri_foto" ON public.galeri_foto;
DROP POLICY IF EXISTS "Akses publik penuh chat" ON public.chat;
DROP POLICY IF EXISTS "Akses publik penuh pengajuan_pindah_blok" ON public.pengajuan_pindah_blok;

-- Pasang policy baru
CREATE POLICY "Akses publik penuh pengaturan" ON public.pengaturan FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh warga" ON public.warga FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh akun" ON public.akun FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh transaksi_masuk" ON public.transaksi_masuk FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh transaksi_keluar" ON public.transaksi_keluar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh galeri" ON public.galeri FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh galeri_foto" ON public.galeri_foto FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh chat" ON public.chat FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Akses publik penuh pengajuan_pindah_blok" ON public.pengajuan_pindah_blok FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- SETUP STORAGE BUCKETS (FOTO & BUKTI)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('kas-bukti', 'kas-bukti', true),
    ('kas-galeri', 'kas-galeri', true),
    ('kas-foto', 'kas-foto', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access kas-bukti" ON storage.objects;
DROP POLICY IF EXISTS "Public Access kas-galeri" ON storage.objects;
DROP POLICY IF EXISTS "Public Access kas-foto" ON storage.objects;

CREATE POLICY "Public Access kas-bukti" ON storage.objects FOR ALL USING (bucket_id = 'kas-bukti') WITH CHECK (bucket_id = 'kas-bukti');
CREATE POLICY "Public Access kas-galeri" ON storage.objects FOR ALL USING (bucket_id = 'kas-galeri') WITH CHECK (bucket_id = 'kas-galeri');
CREATE POLICY "Public Access kas-foto" ON storage.objects FOR ALL USING (bucket_id = 'kas-foto') WITH CHECK (bucket_id = 'kas-foto');

-- ============================================================================
-- GRANT PRIVILEGES TO ANON & AUTHENTICATED ROLES
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

