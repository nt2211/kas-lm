# Split Apps Script Web App into Frontend (GitHub Pages) and Backend (Apps Script API)

Tujuan dari perubahan ini adalah untuk memisahkan frontend agar bisa dihosting mandiri (misalnya di GitHub Pages) dan menjadikan Google Apps Script hanya sebagai backend API. Hal ini akan menghilangkan banner "This application was created by a Google Apps Script user" yang mengganggu, serta memungkinkan Anda menggunakan custom domain yang lebih pendek.

## User Review Required

> [!IMPORTANT]
> - Setelah perubahan ini, Anda harus mendeploy (atau melakukan "New Deployment") ulang script `Code.gs` di Apps Script sebagai **Web App** dengan akses `Anyone`.
> - Anda akan mendapatkan URL Web App baru (yang berakhiran `/exec`). URL ini harus disalin ke dalam `app.js` sebagai `const API_URL`.
> - Apakah Anda siap melanjutkan proses deploy manual tersebut nantinya? 

## Open Questions

> [!WARNING]
> 1. Apakah Anda ingin CSS dan JavaScript dipisah sepenuhnya menjadi `style.css` dan `app.js` seperti yang Anda ilustrasikan, atau dibiarkan saja dalam `index.html` dan hanya mengganti logikanya?
> 2. Untuk login Google (OAuth), OAuth redirect uri saat ini mengarah ke Apps Script url. Kita mungkin perlu penyesuaian khusus atau Anda harus mengubah `redirect_uri` di Google Cloud Console ke URL GitHub Pages Anda. Apakah Anda memiliki akses ke Google Cloud Console dari project OAuth ini?

## Proposed Changes

### 1. Backend (Google Apps Script)
Kita akan menambahkan fungsi `doPost(e)` di dalam `Code.gs` yang akan bertindak sebagai router/dispatcher API untuk menerima HTTP POST berisi JSON dan mengeksekusi fungsi backend, lalu mengembalikan hasilnya dalam format JSON.

#### [MODIFY] `Code.gs`
- Menambahkan fungsi `doPost(e)` untuk membaca payload JSON: `{ action: 'namaFungsi', args: [arg1, arg2] }`.
- Mengeksekusi fungsi yang diminta secara dinamis.
- Mengembalikan response `ContentService.createTextOutput(JSON.stringify({ result: ... })).setMimeType(ContentService.MimeType.JSON)`.
- Mengatur header CORS (secara implisit ditangani oleh Apps Script JSON response).

### 2. Frontend (Static Web)
Kita akan memisahkan `Index.html` saat ini menjadi 3 file berbeda sesuai keinginan Anda.

#### [NEW] `index.html`
- File HTML bersih yang hanya berisi kerangka struktur, tag `<link>` ke CSS, dan tag `<script>` ke `app.js`.

#### [NEW] `style.css`
- Berisi seluruh definisi CSS (termasuk Dark Mode) yang saat ini ada di dalam `<style>` pada `Index.html`.

#### [NEW] `app.js`
- Berisi seluruh logika Vue.js.
- Mengubah mekanisme pemanggilan backend yang sebelumnya menggunakan `google.script.run` (biasanya terbungkus dalam method `call()` atau `jalankan()`) menjadi fungsi asinkron menggunakan `fetch()` ke URL Web App Anda.
- Contoh:
  ```javascript
  const API_URL = "URL_WEB_APP_APPS_SCRIPT_ANDA";
  
  async function callBackend(action, ...args) {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: action, args: args })
    });
    return await response.json();
  }
  ```

#### [DELETE] `Index.html`
- Menghapus file `Index.html` lama dari folder/project (karena sudah digantikan oleh 3 file di atas).

## Verification Plan
### Manual Verification
- Deploy Google Apps Script dan dapatkan URL Web App.
- Masukkan URL ke `app.js`.
- Buka `index.html` secara lokal atau deploy ke GitHub Pages.
- Pastikan tampilan dan semua fitur (login, memuat data dashboard, notifikasi) berjalan normal tanpa banner Google Apps Script.
