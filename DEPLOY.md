# MKÜ TTO — Railway Deploy Rehberi

## Ön Hazırlık
- GitHub hesabı (github.com)
- Railway hesabı (railway.app) — GitHub ile giriş yapılabilir

---

## ADIM 1 — GitHub'a Yükle

### 1a. ZIP'i aç, klasörü hazırla
ZIP'i bilgisayarına çıkart. `tto-final/` klasörünü göreceksin.

### 1b. GitHub'da yeni repo oluştur
1. github.com → sağ üst **+** → **New repository**
2. Repository name: `mku-tto`
3. Private seç (önerilir)
4. **Create repository** tıkla

### 1c. Kodu yükle
Terminali aç, `tto-final/` klasörünün içine gir:

```bash
cd tto-final
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADIN/mku-tto.git
git push -u origin main
```

---

## ADIM 2 — Railway'de PostgreSQL Veritabanı

1. railway.app → **New Project** → **Deploy from template** → **PostgreSQL** seç
   (veya: New Project → boş proje aç, sonra **+ New** → **Database** → **PostgreSQL**)
2. PostgreSQL servisi oluşturulunca üstüne tıkla
3. **Connect** sekmesinde `DATABASE_URL` değerini kopyala ve bir yere not al

---

## ADIM 3 — Backend Servisi

1. Projende **+ New** → **GitHub Repo** → `mku-tto` reposunu seç
2. **Add Service** dedi mi → **Root Directory** kısmına `backend` yaz
3. Servis oluşturulunca **Variables** sekmesine gir, şunları ekle:

| Değişken | Değer |
|---|---|
| `DATABASE_URL` | PostgreSQL servisinden kopyaladığın URL |
| `JWT_SECRET` | **ZORUNLU** — en az 16 karakterli rastgele güçlü bir anahtar (örn: `openssl rand -hex 32` çıktısı) |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | **ZORUNLU (prod'da)** — frontend'in tam URL'i (örn: `https://frontend-xxx.up.railway.app`) — CORS beyaz listesi ve QR kodları için kullanılır |
| `CORS_ALLOWED_ORIGINS` | (opsiyonel) virgülle ayrılmış ek kabul edilebilir origin listesi |
| `NODE_ENV` | `production` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (isteğe bağlı, YZ için) |

> ⚠ `JWT_SECRET` ayarlanmazsa backend başlamaz — bu bilinçli bir güvenlik önlemidir.

### Akademik entegrasyonlar (opsiyonel, analitik paneli için)

Her biri opsiyonel — yoksa ilgili panel "yapılandırılmadı" der, başka yeri bozmaz.

| Değişken | Değer | Not |
|---|---|---|
| `SCOPUS_API_KEY` | Elsevier Developer | Atıf, h-index, yayın listesi |
| `WOS_API_KEY` | Clarivate Developer Portal | Web of Science Starter API |
| `EPO_CONSUMER_KEY` + `EPO_CONSUMER_SECRET` | developers.epo.org | Patent doğrulama |
| `CROSSREF_MAILTO` | kurum email | Polite pool için önerilir |
| `UNPAYWALL_MAILTO` | kurum email | Açık erişim tespiti |
| `OPENALEX_MAILTO` | kurum email | 240M+ yayın indeksi |
| `PUBMED_MAILTO` | kurum email | NCBI E-utilities politika |
| `SEMANTIC_SCHOLAR_KEY` | api.semanticscholar.org | Yüksek rate limit için opsiyonel |
| `MKU_OPENALEX_ID` | `I1234...` | Kurumsal bibliyometri için |

### SCImago Journal Rank (Q1-Q4 verisi)

SCImago, Railway IP'lerine 403 dönüyor — bu yüzden CSV **yerel olarak indirilip repo'ya commit edilmelidir**:

```bash
cd backend
node scripts/fetch-scimago.mjs       # yerel makinenizde çalıştırın
git add backend/assets/scimago-sjr.csv
git commit -m "data: SCImago snapshot"
git push
```

Railway dosya sisteminden okuyacak. Dosya yoksa analiz panelindeki Q1-Q4
dağılımı "Bilinmiyor" gösterir — panel yine çalışır.

4. **Settings** → **Networking** → **Generate Domain** tıkla
5. Sana `https://backend-xxx.up.railway.app` gibi bir URL verir — bunu kopyala

6. Deploy başlar. **Logs** sekmesinden takip et, `Application is running on port...` görünce hazır.

### Backend'e seed verisi yükle
Backend deploy olduktan sonra Railway terminali kullan:

1. Backend servisine tıkla → sağ üstte **⌃** (shell) ikonu
2. Aşağıdaki komutu çalıştır:
```bash
npx ts-node -r tsconfig-paths/register src/database/seed.ts
```

---

## ADIM 4 — Frontend Servisi

1. Projende yine **+ New** → **GitHub Repo** → aynı `mku-tto` reposu
2. **Root Directory**: `frontend`
3. **Variables** sekmesine gir, şunu ekle:

| Değişken | Değer |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://backend-xxx.up.railway.app/api` (3. adımda aldığın URL + `/api`) |

4. **Settings** → **Networking** → **Generate Domain** tıkla
5. Deploy başlar. `Compiled successfully` görünce hazır.

---

## ADIM 5 — Test

Frontend URL'ine git (örn: `https://frontend-xxx.up.railway.app`).

Demo hesaplar:
| Rol | E-posta | Şifre |
|---|---|---|
| Süper Admin | admin@mku.edu.tr | Admin123! |
| Akademisyen | ahmet.yilmaz@mku.edu.tr | Demo123! |

---

## Sorun Giderme

**Backend ayağa kalkmıyor:**
→ Logs sekmesinde hatayı bul. En sık neden: `DATABASE_URL` eksik veya yanlış.

**Frontend "Network Error" veriyor:**
→ `NEXT_PUBLIC_API_URL` değerini kontrol et. Sonda `/api` var mı?

**Login çalışmıyor:**
→ Seed komutu çalıştırıldı mı? (Adım 3-6)

**CORS hatası:**
→ Backend'in `main.ts`'inde origin listesi güncellenmeli (aşağıya bak).

---

## CORS Güncelleme (önemli)

Frontend URL'ini öğrendikten sonra backend'in `src/main.ts` dosyasını güncelle:

```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://frontend-xxx.up.railway.app',  // ← kendi URL'ini yaz
  ],
  credentials: true,
});
```

Dosyayı güncelleyip GitHub'a push ettiğinde Railway otomatik yeniden deploy eder.

