<p align="center">
  <img src="https://raw.githubusercontent.com/kodok-ijho/NARA/main/nara_hero.png" alt="NARA Project Hero" width="100%">
</p>

<h1 align="center">🌌 NARA: Neural Automated Resource Agent</h1>

<p align="center">
  <strong>The Ultimate Life Orchestration Engine. Built for Speed. Designed for Impact.</strong>
</p>

<p align="center">
  <a href="https://github.com/kodok-ijho/NARA">
    <img src="https://img.shields.io/badge/Status-BATTLE--TESTED-success?style=for-the-badge&logo=github" alt="Status">
  </a>
  <a href="https://n8n.io">
    <img src="https://img.shields.io/badge/Powered%20By-n8n-FF6D5A?style=for-the-badge&logo=n8n&logoColor=white" alt="n8n">
  </a>
  <a href="https://supabase.com">
    <img src="https://img.shields.io/badge/Database-Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  </a>
</p>

---

## 🇮🇩 Kenalkan NARA: Asisten Masa Depan Kamu

NARA bukan sekadar aplikasi pencatat. NARA adalah sebuah **Orchestration Master** yang menghubungkan ritual kesehatan kamu (**RAGA**) dan manajemen finansial kamu (**ARTA**) ke dalam satu dashboard yang sangat "enteng" dan visualnya mewah.

Built using a **Pure Webhook Architecture**, NARA menghapus kerumitan backend tradisional dan menggantinya dengan alur kerja n8n yang sangat fleksibel.

---

## 🚀 The Core Pillars

### 🥗 RAGA (Health Rituals)
> *Because your metrics matter.*

<p align="center">
  <img src="https://raw.githubusercontent.com/kodok-ijho/NARA/main/nara_raga_card.png" alt="RAGA Card" width="48%">
  <img src="https://raw.githubusercontent.com/kodok-ijho/NARA/main/nara_arta_card.png" alt="ARTA Card" width="48%">
</p>

#### **RAGA Features:**
- **Smart BMI Scale**: Hitung BMI & TDEE secara otomatis dari profil kamu.
- **Ritual Tracking**: Log makanan dan aktivitas dengan sinkronisasi n8n.
- **Contextual Insights**: NARA AI siap memberitahu kapan kamu butuh istirahat atau nutrisi tambahan.

#### **ARTA Features:**
- **Lightning CRUD**: Operasi data finansial yang super cepat (add, edit, delete).
- **Auto-Seeding**: Baru pertama kali pakai? NARA otomatis siapkan kategori buat kamu.
- **Spend Visualization**: Grafik pengeluaran yang tajam dan informatif.

---

## 🧠 Brain Structure (n8n Architecture)

The logic is 100% decoupled from the UI. This means NARA is **future-proof**.

```mermaid
graph TD
    subgraph "Visual Experience"
        React[React Core + Shadcn UI]
    end

    subgraph "The Nervous System"
        Auth[n8n: Auth Sync]
        RAGA[n8n: Health Engine]
        ARTA[n8n: Finance Engine]
    end

    subgraph "The Global Memory"
        DB[(Supabase)]
    end

    React <== "JSON Webhooks" ==> Auth
    React <== "JSON Webhooks" ==> RAGA
    React <== "JSON Webhooks" ==> ARTA

    Auth <== "REST" ==> DB
    RAGA <== "REST" ==> DB
    ARTA <== "REST" ==> DB

    style Auth fill:#FF6D5A,stroke:#333,color:#fff
    style RAGA fill:#FF6D5A,stroke:#333,color:#fff
    style ARTA fill:#FF6D5A,stroke:#333,color:#fff
    style React fill:#61DAFB,stroke:#333,color:#000
    style DB fill:#3ECF8E,stroke:#333,color:#fff
```

---

## 🛠️ Deployment in 2 Minutes

### 1. The Shell (Frontend)
```bash
git clone https://github.com/kodok-ijho/NARA.git
cd nara-app && npm install && npm run dev
```

### 2. The Soul (n8n)
- Import workflows from `/n8n workflow`.
- Hubungkan instance n8n kamu ke Supabase.
- Masukkan URL webhook ke file `.env` kamu.

---

## 🔮 Roadmap: What's Next?
- [ ] **MASA**: Agenda & Productivity management.
- [ ] **LLM Integration**: Chat with NARA via WhatsApp using Gemini/GPT.
- [ ] **Voice Command**: Control your dashboard with voice triggers.

---

<p align="center">
  <strong>Dibuat dengan ❤️ untuk masa depan yang lebih teratur.</strong>
  <br>
  <em>Designed & Engineered by <a href="https://github.com/kodok-ijho">kodok-ijho</a></em>
</p>
