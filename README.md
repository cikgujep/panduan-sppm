# Panduan Analisis SPPM

Panduan interaktif untuk membaca analisis Dashboard SPPM secara kritikal. Satu fail HTML (`index.html`), folder `img/` (12 tangkapan skrin Dashboard) dan folder `demo/` (Dashboard SPPM yang berjalan dalam pelayar dengan data rekaan): tiada build, tiada pangkalan data.

Semua contoh angka dan tangkapan skrin datang daripada data rekaan (sekolah, nama dan markah). Tiada data murid atau sekolah sebenar dalam repositori ini.

## Demo

`demo/` ialah Dashboard SPPM sebenar yang dijalankan dalam pelayar menggunakan emulator Google Apps Script (`gas-mock.js`) dan data rekaan (112 murid, SMK Demo Bestari). Perubahan yang dibuat dalam demo disimpan dalam pelayar pengguna sahaja; butang **Reset** memulihkan data asal.

## Cetak

Gunakan Cetak (Ctrl+P) dalam pelayar. Gaya cetak disediakan untuk kertas A4: setiap modul bermula di halaman baharu, dan penerangan penanda dicetak sebagai senarai bernombor di bawah setiap gambar.

## Deploy ke GitHub Pages

1. Cipta repositori baharu di GitHub (contoh: `panduan-sppm`).
2. Muat naik `index.html`, folder `img/`, `.nojekyll` dan `README.md` ke cabang `main`.
3. Pergi ke **Settings → Pages**.
4. Di bawah **Build and deployment**, pilih **Deploy from a branch**, cabang `main`, folder `/ (root)`, kemudian **Save**.
5. Selepas 1–2 minit, laman tersedia di `https://<nama-pengguna>.github.io/panduan-sppm/`.

Atau melalui terminal:

```bash
git init
git add index.html img .nojekyll README.md
git commit -m "Panduan Analisis SPPM"
git branch -M main
git remote add origin https://github.com/<nama-pengguna>/panduan-sppm.git
git push -u origin main
```

## Kemas kini kandungan

Kandungan setiap modul berada dalam tatasusunan `MODS` di bahagian bawah `index.html`. Tangkapan skrin dan penanda bernombor berada dalam objek `SHOTS` (kedudukan dalam peratus gambar). Setiap modul ada: `sum` (Ringkas), `steps` (Cara baca), `warn` (Awas), `ask` (soalan mesyuarat), `lab` + `init` (Cuba sendiri), dan `quiz`.

Tanda semakan dan kemajuan bacaan disimpan dalam pelayar pengguna (localStorage) sahaja.
