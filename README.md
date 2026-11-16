# Connect-Four AI — Depth-Limited Minimax (TIM 12)

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/zysrnh/ConnectFour_UTS/blob/main/Praktikum_AI_UTS_TIM12.ipynb)

Proyek **Ujian Tengah Semester (UTS) — Project-Based Learning (PjBL)** mata kuliah **Kecerdasan Buatan & Sistem Cerdas**, Program Studi Teknik Informatika / Sistem Informasi, Institut Digital Ekonomi (IDE) LPKIA Bandung.

- **Tema Proyek (TIM 12):** Bot Game AI Connect-Four Berbasis Minimax
- **Metode AI Utama:** *Adversarial Search* — *Depth-Limited Minimax* dengan *Heuristic Evaluation Function* & optimasi *Alpha-Beta Pruning*
- **Live Demo Web UI (GitHub Pages):** `https://zysrnh.github.io/ConnectFour_UTS/`
- **Notebook Google Colab:** [`Praktikum_AI_UTS_TIM12.ipynb`](Praktikum_AI_UTS_TIM12.ipynb)

---

## Kesamaan 1:1 antara Notebook Colab (Python) & Demo Web (JavaScript)

Seluruh logika inti permainan dan AI pada [`Praktikum_AI_UTS_TIM12.ipynb`](Praktikum_AI_UTS_TIM12.ipynb) dan [`js/ai.js`](js/ai.js) menggunakan spesifikasi yang **identik 100%**:

1. **Representasi Papan:** Matriks `6 baris × 7 kolom` (`HUMAN = 1 / MIN`, `AI = 2 / MAX`).
2. **Prioritas Pencarian Kolom:** `[3, 2, 4, 1, 5, 0, 6]` (tengah ke pinggir) untuk efisiensi *pruning* dan *tie-breaking* deterministik.
3. **Heuristic Evaluation Function (`evaluate_board` / `evaluateBoard`):**
   - Menilai 69 jendela 4-petak (horizontal, vertikal, diagonal naik & turun):
     - `4 bidak AI`: `+100000` (dikurangi penalti kedalaman `depth` agar menang lebih cepat)
     - `3 bidak AI + 1 kosong`: `+12`
     - `2 bidak AI + 2 kosong`: `+3`
     - `3 bidak Lawan + 1 kosong`: `-80` (prioritas memblokir ancaman langsung lawan)
     - `2 bidak Lawan + 2 kosong`: `-2`
   - Kontrol kolom tengah (`kolom 3`): `+4` per selisih bidak AI vs Lawan.
4. **Tingkat Kesulitan:**
   - **Easy:** Random Move
   - **Medium:** *Depth-Limited Minimax Murni* (`max_depth = 3`)
   - **Hard:** *Depth-Limited Minimax + Alpha-Beta Pruning* (`max_depth = 5`)

---

## Struktur Repository

```text
ConnectFour_UTS/
├── Praktikum_AI_UTS_TIM12.ipynb   # Notebook Google Colab utama (lengkap dengan benchmark & arena interaktif)
├── index.html                     # Antarmuka Web Demo Arena Connect-Four + Panel Inspektor AI
├── style.css                      # Desain UI flat & solid untuk layar demo/proyektor
├── js/
│   ├── ai.js                      # Engine AI (sinkron 1:1 dengan notebook Python)
│   └── app.js                     # Controller permainan, inspektor skor evaluasi, & benchmark langsung
└── README.md
```

---

## Cara Menjalankan

### 1. Google Colab
Klik tombol **Open in Colab** di bagian atas README ini, lalu pilih **Runtime → Run all** untuk menjalankan pemodelan, pengujian taktis, benchmark Minimax vs Alpha-Beta Pruning, dan simulasi turnamen secara otomatis. Untuk bermain interaktif di Colab, ubah `JALANKAN_GAME_INTERAKTIF = True` pada sel terakhir.

### 2. Live Demo via GitHub Pages
1. Buka tab **Settings → Pages** pada repository GitHub ini.
2. Pada bagian **Build and deployment**, pilih **Source: Deploy from a branch**.
3. Pilih branch `main` dan folder `/ (root)`, lalu klik **Save**.
4. Akses arena interaktif di `https://zysrnh.github.io/ConnectFour_UTS/`.
