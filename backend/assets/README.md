# Backend Assets

Bu klasör, runtime'da dosya sisteminden okunan statik veri dosyalarını içerir.

## `scimago-sjr.csv`

SCImago Journal Rank dergi kalite listesi. Analytics panelindeki Q1-Q4 dağılımı
bu dosyadan beslenir.

### Neden burada?

SCImago (`scimagojr.com`) Cloudflare arkasında — Railway gibi bulut
provider'larının IP'lerine HTTP 403 dönüyor. Bu yüzden CSV'yi yerel
bilgisayarınızda bir kez indirip repo'ya commit ediyoruz, Railway dosya
sisteminden okuyor.

### Nasıl güncellenir?

SCImago CSV'si yılda bir kez güncellenir. Yeni sürüm çıktığında:

```bash
cd backend
node scripts/fetch-scimago.mjs
git add backend/assets/scimago-sjr.csv
git commit -m "data: SCImago SJR snapshot YYYY"
git push
```

Script CSV'yi indirip sadece gerekli kolonları tutar (~30 MB).

### Alternatif (opsiyonel)

Eğer başka bir kaynaktan alınan mirror URL'si varsa, Railway backend
servisinin Variables kısmına şu env'i ekleyebilirsiniz:

- `SCIMAGO_LOCAL_PATH` — özel yerel dosya yolu
- `SCIMAGO_CSV_URL` — virgülle ayrılmış mirror URL'leri (fallback)
