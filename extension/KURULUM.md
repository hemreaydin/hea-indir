# hea-indir · Chrome eklentisi 0.3.0

Bu klasör Chrome'a yüklenir. Windows için **hea-indir 0.3.0** uygulaması da açık olmalıdır.

## Bir kez kur

1. hea-indir'i aç; **Ayarlar → Chrome eklentisi → Eklenti klasörünü aç** düğmesine bas.
2. Chrome adres çubuğuna `chrome://extensions` yaz.
3. Sağ üstte **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle** düğmesine bas; içinde `manifest.json` bulunan eklenti klasörünü seç. ZIP dosyasını seçme; önce çıkar.
5. Chrome'un yapboz simgesinden **hea-indir** eklentisini aç; istersen sabitle.
6. Programın **Ayarlar → Chrome eklentisi** bölümündeki altı haneli kodu yazıp **Bağlan** de. Kodun süresi dolarsa programdan **Yeni kod** al.

Eklenti klasörünü taşımadan veya silmeden sakla. Programın paketindeki `resources/extension` klasörü veya ayrı çıkarılmış Chrome eklentisi klasörü kullanılabilir. Eklenti Chrome Web Mağazası'nda yayımlanmış değildir; yerel geliştirici kurulumu kullanılır. Chrome kuruluş tarafından yönetiliyorsa bu kurulum kısıtlanmış olabilir.

## Videoyu indir

1. hea-indir'de **Video + ses / Yalnızca ses / Yalnızca video**, format, kalite ve kayıt klasörünü seç.
2. Chrome'da video sayfasını açıp videoyu birkaç saniye oynat. Önceden açık sayfalarda kurulumdan sonra sayfayı yenile.
3. Sağ üstteki sarı **Videoyu indir** düğmesine bas. Birden fazla kaynak bulunursa listeden seç. Programda yalnızca ses seçiliyse düğmede **Sesi indir** yazar.
4. Video bilgileri alınınca indirme programda otomatik başlar. Durumu ve iptal düğmesini hea-indir'den yönet.

Chrome araç çubuğundaki eklenti simgesi de algılanan kaynakları gösterir. Kaynak algılanmazsa **Sayfa bağlantısını programda dene** seçeneği kullanılabilir. Bu seçenek, indirme motorunun desteklediği sayfalarda çalışır.

## Düğmeyi kapat / aç

**hea-indir → Ayarlar → Chrome eklentisi → Video düğmesini göster** anahtarını kapat veya aç. Değişiklik yaklaşık 2–6 saniyede sayfalara yansır. Program kapalıyken düğme gizlenir. Başlamış indirmeler anahtarı kapatınca devam eder. Tercih sonraki açılışta korunur.

## Destek ve veri kullanımı

- YouTube, Instagram, TikTok, Facebook ve yt-dlp'nin desteklediği diğer video sayfaları; doğrudan MP4/WebM gibi video dosyaları; korumasız HLS/DASH kayıtları hedeflenir.
- Her site ve oynatıcı desteklenmez. `blob:` tek başına indirilebilir bir dosya adresi değildir; alttaki yayın bağlantısının algılanması gerekir. Reklam videoları da kaynak listesinde görünebilir.
- DRM koruması, canlı yayın, oynatma listesi, özel hesap oturumu ve erişim denetimi aşma desteklenmez. Süresi dolan bağlantılarda videoyu yeniden oynatıp tekrar gönder.
- Farklı sitelerde ve gömülü oynatıcılarda video algılamak için Chrome tüm HTTP/HTTPS sitelerinde erişim izni gösterir. Eklenti medya adresi, sayfa başlığı ve video isteğinin referans adresi/tarayıcı bilgisini kullanır. Çerez veya hesap şifresi programa aktarılmaz.
- Algılanan adresler tarayıcı oturumunda tutulur. Seçtiğin kaynak, yalnızca yerel `127.0.0.1:38473` bağlantısıyla kendi hea-indir programına gönderilir. Merkezi bir sunucuya gönderim yoktur. İndirme sırasında kaynak video sunucusuna bağlanılır.
- Yalnızca indirme hakkın olan içerikleri kaydet.

Kaynak belgeler: [Chrome eklentisi kurulumu](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked), [webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest), [yt-dlp](https://github.com/yt-dlp/yt-dlp).
