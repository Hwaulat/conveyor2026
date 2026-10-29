# Roadmap — Conveyor Line-Stop Monitoring, Andon & OEE (PT. Krama Yudha Ratu Motor Indonesia)

Keputusan: UI bilingual (ID/EN), mode demo (data PLC disimulasikan), tanpa login dulu, semua fitur MVP.
Rute terpisah: `/web` (desktop), `/andon` (TV), `/ipad` (tablet E-form). Desain: x.ai (gelap, monokrom, mono aksen), struktur sidebar/header mengikuti referensi PT. Krama Yudha Ratu Motor Indonesia.

- [x] Fondasi: design system, i18n, tipe data, kalkulasi (MTTR/MTBF/OEE), data seed + simulasi live
- [x] Shell /web: sidebar (grup ala referensi) + header (jam, tanggal, bahasa, profil)
- [x] `/web` Dashboard: kartu ringkasan, grafik MTTR/MTBF, frekuensi, Pareto kategori, OEE
- [x] `/web` Log History: filter, ringkasan per stasiun, detail per kejadian, unrecorded stops, koreksi
- [x] `/web` Production (OEE): template Excel, upload + preview baris, hasil OEE
- [x] `/web` Reports: ekspor Excel (netralisasi formula injection)
- [x] `/web` Master Data: area/konveyor/stasiun, kategori + flag, shift, device
- [x] `/web` User Management: daftar user + peran
- [x] `/andon`: papan TV fullscreen, timer berjalan, strip ringkasan, No signal
- [x] `/ipad`: E-form touch besar, + tambah kategori, open stop, recent entries, offline queue
- [x] Redirect `/` → `/web`, head metadata tiap rute
- [x] Test kalkulasi + build hijau
- [ ] Integrasi PLC asli (menunggu detail protokol/tag dari user)
- [ ] Login & peran (menunggu konfirmasi user)
