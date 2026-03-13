# MKÜ TTO Proje Yönetim Sistemi

## Hızlı Başlangıç

### 1. Backend

```bash
cd backend
npm install
npm run start:dev
```

Backend başladıktan sonra, **yeni bir terminalde** seed çalıştır:

```bash
cd backend
npx ts-node src/database/seed.ts
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Tarayıcıda aç

http://localhost:3000

---

## Giriş Bilgileri

| Rol | Email | Şifre |
|-----|-------|-------|
| Süper Admin | admin@mku.edu.tr | Admin123! |
| Akademisyen | ahmet.yilmaz@mku.edu.tr | Demo123! |
| Araştırma Görevlisi | fatma.sahin@mku.edu.tr | Demo123! |
| Bölüm Başkanı | mehmet.kaya@mku.edu.tr | Demo123! |
| Dekan | ayse.demir@mku.edu.tr | Demo123! |

---

## Özellikler

- ✅ SQLite veritabanı (kurulum gerektirmez)
- ✅ JWT kimlik doğrulama
- ✅ Rol tabanlı erişim kontrolü
- ✅ Proje CRUD işlemleri
- ✅ Kullanıcı yönetimi
- ✅ Dashboard istatistikleri ve grafikler
- ✅ Belge yükleme
- ✅ İlerleme raporları
- ✅ Dinamik form alanları
- ✅ Sistem ayarları

## API

- Backend: http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs

## YZ Özet Üretimi

YZ özelliğini aktifleştirmek için Anthropic API anahtarına ihtiyaç vardır:

1. [console.anthropic.com](https://console.anthropic.com) adresinden API anahtarı alın
2. `backend/.env` dosyasına ekleyin:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Backend'i yeniden başlatın

API anahtarı olmadan YZ özet paneli hata mesajı gösterir, diğer tüm özellikler çalışmaya devam eder.

