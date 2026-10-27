# ATT&CK TTP Panel — Windows

Windows 10 ve Windows 11 (x64 / ARM64) için sürüm.

## Hazır paketi kullanma

GitHub'daki **Actions → Build** iş akışının çıktılarından (ya da bir sürüm etiketi
yayınlandıysa **Releases** sayfasından) `attack-ttp-panel-windows` paketini indirin:

| Dosya | Açıklama |
| --- | --- |
| `ATTACK-TTP-Panel-<sürüm>-Setup-x64.exe` | Kurulum sihirbazı (masaüstü ve Başlat menüsü kısayolu oluşturur) |
| `ATTACK-TTP-Panel-<sürüm>-Setup-arm64.exe` | ARM işlemcili Windows cihazlar için kurulum |
| `ATTACK-TTP-Panel-<sürüm>-Portable.exe` | Kurulum gerektirmeyen tek dosya — USB bellekten de çalışır |
| `ATTACK-TTP-Panel-<sürüm>-win-x64.zip` | Arşiv; klasöre çıkarıp `ATTACK TTP Panel.exe` dosyasını çalıştırın |

> Paket kod imzalı olmadığından ilk açılışta **Windows SmartScreen** uyarısı
> görebilirsiniz: **Ek bilgi → Yine de çalıştır**.

## Kaynak koddan çalıştırma

1. [Node.js LTS](https://nodejs.org) kurun (22 veya üzeri).
2. Depoyu indirin: `git clone https://github.com/exseron/mitre-navigator-v20.git`
3. `windows\start.bat` dosyasına çift tıklayın.
   İlk çalıştırmada bağımlılıklar otomatik kurulur.

## Kurulum paketini kendiniz oluşturma

`windows\build.bat` dosyasına çift tıklayın ya da PowerShell'de:

```powershell
npm ci
npm run build:win
```

Çıktılar `dist\windows\` klasörüne yazılır. Kod imzalama sertifikanız varsa
`CSC_LINK` (pfx yolu) ve `CSC_KEY_PASSWORD` ortam değişkenlerini ayarlamanız yeterli.

## Windows'a özel davranışlar

- Modern başlık çubuğu: pencere düğmeleri (simge durumu / büyüt / kapat) uygulamanın
  araç çubuğuna gömülüdür ve sistem temasına (açık/koyu) göre renk değiştirir.
- Kısayollar `Ctrl` ile çalışır (`Ctrl+S` kaydet, `Ctrl+E` görsel oluştur, `Ctrl+Y` yinele…).
- Bir proje `.json` dosyasını uygulama simgesinin üzerine sürüklemek veya
  **Birlikte aç → ATTACK TTP Panel** ile açmak mümkündür; uygulama zaten açıksa dosya
  mevcut pencerede açılır.
- Görsel kaydedildikten sonra çıkan bildirimdeki **Klasörde göster** dosyayı
  Dosya Gezgini'nde seçili olarak açar.
- Windows sürümünde uygulama adı `ATTACK TTP Panel` olarak geçer: Windows denetimleri
  `&` karakterini kısayol harfi olarak yorumladığı için kurulum sihirbazında ad bozuk görünürdü.
