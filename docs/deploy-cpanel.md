# Deploy Subdomain (cPanel) + Konsol Penyerang dari Localhost

Aplikasi GARUDA SHIELD berbasis Node.js/Express (bukan PHP). Setup yang didokumentasikan
di sini: **dashboard dipublish ke subdomain** lewat *Setup Node.js App* di cPanel,
sementara **konsol penyerang dijalankan dari terminal localhost** dan mengirim serangan
simulasi langsung ke server subdomain.

```
┌──────────────────────────────┐        ┌─────────────────────────────────────┐
│  Localhost (PC demonstrator) │        │  Hosting cPanel                     │
│                              │        │                                     │
│  Terminal                    │  HTTP  │  Subdomain, mis.                    │
│  node scripts/konsol-cli.js  │ ─────► │  https://value.id.fadlanbersaudara.com            │
│  serang kodam-jaya zdd       │  JSON  │  ├─ /          (dashboard peta)     │
│                              │        │  ├─ /konsol      (konsol browser)   │
│  Browser (opsional)          │        │  ├─ /laporan/:id                  │
│  https://value.id.fadlanbersaudara.com     │        │  └─ /api/serangan  (endpoint lab)   │
└──────────────────────────────┘        └─────────────────────────────────────┘
```

## 1. Syarat

- Node.js **≥ 22.5** (aplikasi memakai `node:sqlite` bawaan Node). Pilih versi Node
  paling tinggi yang tersedia di panel; bila hanya ada di bawah 22.5, `src/db.js`
  tidak akan jalan — minta penyedia menambah versi Node 22/24.
- Izin membuat subdomain di cPanel (menu **Domains → Create a New Domain**).
- Fitur **Setup Node.js App** (Application Manager) aktif di cPanel.

## 2. Buat subdomain

1. cPanel → **Domains** → **Create a New Domain**, mis. `gs.domainku.com`.
   Root dokumennya otomatis seperti `domainku.com/gs`.
2. Tunggu DNS berlaku (bila DNS dikelola di luar cPanel, buat record
   `A gs → IP server`).

## 3. Siapkan berkas untuk diunggah

Unggah lewat **File Manager** (atau git) ke folder root subdomain tersebut:

```
package.json
package-lock.json
src/            (seluruh isinya)
public/         (seluruh isinya)
scripts/        (konsol-cli.js)
docs/           (opsional)
```

Jangan unggah `node_modules/`, `.env`, dan `*.sqlite` (folder `data` dibuat otomatis).
`node_modules` dipasang lewat panel di langkah berikutnya.

## 4. Daftarkan aplikasi Node di cPanel

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Isi:
   - *Node.js version*: 22.5 atau lebih baru.
   - *Application mode*: Production.
   - *Application root*: folder root subdomain, mis. `gs`.
   - *Application URL*: `gs.domainku.com`.
   - *Application startup file*: `src/server.js`.
3. Klik **Create**. Lalu pada halaman aplikasi klik **Run NPM Install**.
4. Tambahkan **environment variables** pada panel aplikasi itu (Environment variables):

   | Nama             | Nilai                                                  |
   |------------------|--------------------------------------------------------|
   | `GROQ_API_KEY`   | kunci Groq Anda (analisis AI, opsional)                |
   | `GROQ_MODEL`     | `openai/gpt-oss-20b`                                   |
   | `KONSOL_API_KEY` | **wajib diisi acak** — kunci untuk endpoint serangan   |
   | `PORT`           | tidak perlu (dari Passenger otomatis cukup)            |

5. Klik **Restart**.

> Pengaturan `KONSOL_API_KEY` membuat endpoint `POST /api/serangan` menolak semua
> permintaan tanpa header `x-konsol-key` yang cocok. Tanpa itu, siapa pun yang tahu
> alamat subdomain bisa memicu serangan simulasi lewat `/konsol` browser.

## 5. Uji dashboard

Buka `https://value.id.fadlanbersaudara.com` di browser: dashboard peta harus tampil. Laporan AI
memerlukan `GROQ_API_KEY`; tanpa itu laporan memakai heuristik lokal.

## 6. Konsol penyerang dari localhost

Di PC lokal (folder project):

```bash
npm install        # bila belum
set KONSOL_SERVER=https://value.id.fadlanbersaudara.com        # PowerShell: $env:KONSOL_SERVER="..."
set KONSOL_API_KEY=<kunci sesuai cPanel>
npm run konsol
```

Perintah kosong membuka **mode interaktif**:

```
konsol> target
konsol> serang kodam-jaya zdd --preset shanghai
konsol> status
konsol> pulihkan masukkan-attackId
konsol> keluar
```

Konfigurasi bisa pula disimpan permanen (file `.konsol.json`, tidak di-commit):

```
konsol> server https://value.id.fadlanbersaudara.com
konsol> key kunci-acak-anda
```

Serangan itu muncul di dashboard subdomain (`/`, tab yang terbuka di browser):
marker animasi pada peta, alert, badge analisis AI, dan laporan di
`/laporan/<attackId>`.

## 7. Konsol browser di localhost (opsional)

Konsol versi browser tetap bisa dijalankan lokal dengan `node src/server.js`
(`http://localhost:3000/konsol`), tetapi konsol browser selalu menarget server
tempat ia dibuka (same-origin) dan sinkronisasi pop-up/BroadcastChannel hanya
bekerja antar-tab pada origin yang sama. Untuk menyerang dashboard di subdomain,
gunakan konsol CLI di atas atau buka `/konsol` di subdomain yang sama.

Rangkuman kombinasi yang saling terhubung:

| Kombinasi                                                        | Status                                    |
|------------------------------------------------------------------|-------------------------------------------|
| Dashboard subdomain + konsol browser subdomain (`/konsol` di sub) | Saling terhubung (same-origin)            |
| Dashboard subdomain + konsol CLI localhost                        | Saling terhubung (HTTP, rekomendasi)      |
| Dashboard subdomain + konsol browser localhost                    | Tidak otomatis terhubung (lintas-origin)  |

## 8. Pemecahan masalah

| Gejala | Penyebab umum |
|--------|---------------|
| 502/500 saat membuka subdomain | Versi Node < 22.5, atau `node_modules` belum dipasang — cek log di panel aplikasi, jalankan *Run NPM Install*, lalu *Restart* |
| 401 saat `serang` dari CLI | `KONSOL_API_KEY` di cPanel dan `key` di CLI tidak sama |
| `Server tidak dapat dihubungi` | `KONSOL_SERVER` salah, DNS subdomain belum berlaku, atau situs masih error |
| Laporan selalu "heuristik-lokal" | `GROQ_API_KEY` belum diatur di panel aplikasi cPanel |
