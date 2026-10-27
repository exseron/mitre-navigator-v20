# ATT&CK TTP Panel — macOS

macOS 12 Monterey ve üzeri için sürüm. Tek **Universal** paket hem Apple Silicon
(M1/M2/M3/M4…) hem de Intel Mac'lerde yerel olarak çalışır.

## Hazır paketi kullanma

GitHub'daki **Actions → Build** iş akışının çıktılarından (ya da **Releases**
sayfasından) `attack-ttp-panel-mac` paketini indirin:

| Dosya | Açıklama |
| --- | --- |
| `ATTACK-TTP-Panel-<sürüm>-mac-universal.dmg` | Açın ve uygulamayı **Applications** klasörüne sürükleyin |
| `ATTACK-TTP-Panel-<sürüm>-mac-universal.zip` | Arşiv; çıkarıp `ATT&CK TTP Panel.app` uygulamasını taşıyın |

### "Uygulama hasarlı" / "doğrulanamadı" uyarısı

Paket Apple tarafından notarize edilmemiştir (ad-hoc imzalıdır). İlk açılışta:

- Finder'da uygulamaya **sağ tık → Aç → Aç** deyin, ya da
- **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç**, ya da
- Terminal'de karantina işaretini kaldırın:

```bash
xattr -cr "/Applications/ATT&CK TTP Panel.app"
```

## Kaynak koddan çalıştırma

1. Node.js 22+ kurun: [nodejs.org](https://nodejs.org) ya da `brew install node`
2. Depoyu indirin: `git clone https://github.com/exseron/mitre-navigator-v20.git`
3. Finder'da `mac/start.command` dosyasına çift tıklayın
   (veya Terminal'de `./mac/start.command`). İlk çalıştırmada bağımlılıklar kurulur.

## DMG paketini kendiniz oluşturma

```bash
./mac/build.sh
```

Çıktılar `dist/mac/` klasörüne yazılır. Apple Developer ID sertifikanız varsa:

```bash
MAC_SIGN_IDENTITY="Developer ID Application: Adınız (TEAMID)" ./mac/build.sh
```

## macOS'a özel davranışlar

- Entegre başlık çubuğu: trafik ışıkları (kapat / küçült / tam ekran) araç çubuğunun içindedir.
- Standart uygulama menüsü (Hakkında, Servisler, Gizle, Çık) ve `⌘` kısayolları
  (`⌘S` kaydet, `⌘E` görsel oluştur, `⇧⌘Z` yinele…).
- Kaydedilmemiş değişiklik olduğunda pencerenin kapat düğmesinde nokta görünür ve
  pencere, Görev Yöneticisi / Mission Control'de açık dosyayı temsil eder.
- Pencere kapatılsa da uygulama Dock'ta açık kalır (`⌘Q` ile çıkılır).
- Proje dosyalarını Dock simgesine sürükleyerek veya **Birlikte Aç** menüsünden açabilirsiniz.
- Görsel kaydedildikten sonra **Klasörde göster** dosyayı Finder'da seçili gösterir.
