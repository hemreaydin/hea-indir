# hea-indir · Windows


**Windows için video/ses indirme uygulaması ve Chrome eklentisi.** Türkçe arayüz, koyu/açık tema, MP4/MKV video ve MP3/M4A/WAV ses.

### Hazır uygulamayı indir

[Windows ve Chrome indirmeleri → Releases](https://github.com/hemreaydin/hea-indir/releases/latest)

Windows ZIP'ini tamamen bir klasöre çıkarıp `hea-indir.exe` dosyasını aç. Python veya Node.js kurulumu gerekmez. EXE'yi yanındaki dosyalardan ayırma. Windows 10/11 x64 içindir.

Chrome kurulumu için [eklenti kılavuzunu](extension/KURULUM.md) izle. Eklenti Chrome Web Mağazası'nda yayımlanmamıştır; yerel kurulum kullanılır.

Bu depo yalnızca kaynak kodunu, ikonları ve lisansları içerir. İndirme geçmişi, kişisel ayarlar, tarayıcı profilleri ve indirilen videolar paylaşılmaz.



## 0.4.0 · Eklentiden aç/kapat ve otomatik başlatma

Chrome eklentisindeki **Video indirme → AÇIK / KAPALI** anahtarı yeni indirmeleri ve sayfadaki düğmeyi kontrol eder. Tercih tarayıcı yeniden açıldığında korunur. Kapalıyken yeni indirme başlatılmaz; devam eden işler tamamlanır.

İlk kullanımda Windows paketindeki resources/native/Chrome-Baglantisini-Kur.cmd dosyasını bir kez çalıştır. Alternatif olarak programda **Ayarlar → Chrome eklentisi → Chrome'a nasıl eklerim? → Otomatik bağlantıyı kur** düğmesine bas. Yönetici yetkisi gerekmez. Sonra eklentiyi güncelle ve anahtarı aç. Program otomatik olarak arka planda başlar; elle açman veya kod girmen gerekmez.

Pencerenin X düğmesi uygulamayı saat yanına gizler. Tamamen kapatmak için saat yanındaki hea-indir simgesinden **Çıkış** seç. Uygulama kapalıyken de eklenti videoları algılar; **İndir** düğmesi uygulamayı yeniden başlatır. Chrome'un normal durum kontrolleri uygulamayı başlatmaz. Son beş tarayıcı indirmesinin durumu eklentide görünür.

Windows paketi bilgisayarda kalmalıdır. Klasörü taşırsan bağlantı kurulumunu tekrarla. Bağlantıyı kaldırmak için resources/native/Chrome-Baglantisini-Kaldir.cmd çalıştır. Kurulum yalnızca mevcut kullanıcının Chrome Native Messaging kaydını ekler; Windows başlangıcına görev veya servis eklemez.

Biçim, kalite ve kayıt klasörü programdaki seçimlerinden alınır. Ayrıntılar: [Chrome kılavuzu](extension/KURULUM.md).

URL girişi artık dört platformla sınırlı değildir. yt-dlp'nin desteklediği genel video sayfaları ve doğrudan HTTP/HTTPS video bağlantıları kabul edilir. Bazı sitelerde yalnızca eklentinin yakaladığı medya adresi çalışır. Her siteye destek garantisi yoktur; DRM koruması kaldırılmaz, kullanıcı çerezleri veya giriş bilgileri aktarılmaz.

## 0.2.0 güncellemesi

Üst bölümdeki tür, format ve kalite seçimleri artık kuyrukta bekleyen tüm içeriklere hemen uygulanır. Örneğin önce bir bağlantı ekleyip sonra üstten **Yalnızca ses** seçersen aşağıdaki kart da **Yalnızca ses / MP3** olur. Bilgisi alınan veya sırada bekleyen kayıtlar da güncellenir. Devam eden indirmeler ve tamamlanan dosyalar aynı kalır. Her kartı ayrıca özelleştirebilirsin; üst seçim yeniden yapıldığında bekleyen kartlar tekrar bu ayara eşitlenir.

Koyu görünüm varsayılan temadır. Sağ üstteki görünüm düğmesinden veya **Ayarlar → Görünüm** bölümünden açık/koyu tema seçilir; tercih sonraki açılışta korunur. Eski sürümdeki indirme geçmişi, kuyruk ve klasör seçimi korunur.

## Kullanım

1. Windows ZIP paketini bir klasöre tamamen çıkar ve içindeki `hea-indir.exe` dosyasını aç. Hazır `hea-indir-Windows` klasörünü kullanıyorsan doğrudan EXE'yi açabilirsin. Kurulum, Python veya ayrıca FFmpeg kurmak gerekmez. EXE'yi yanındaki dosyalardan ayırma.
2. YouTube, Instagram, TikTok veya Facebook video bağlantısını kopyala. Uygulamada **Yapıştır** düğmesine bas.
3. **Video + ses**, **Yalnızca ses** veya **Yalnızca video** seç. Format ve kaliteyi belirle.
4. **Bağlantıyı ekle** düğmesine bas. Başlık ve süre alındıktan sonra **İndirmeyi başlat** düğmesine bas.
5. Tamamlanan dosyayı **İndirme geçmişi** bölümündeki klasör düğmesiyle bul.

Birden fazla bağlantı ayrı satırlara yapıştırılabilir. Her kartın türü, biçimi ve kalitesi ayrıca değiştirilebilir. Yeni bağlantı eklerken Enter kullanılır; yeni satır için Shift+Enter kullanılır.

## Özellikler

- MP4 ve MKV video; MP3, M4A ve WAV ses.
- Video + ses tek bir dosyada birleştirilir. Yalnızca video seçimi gerçekten sessiz dosya üretir.
- En iyi kaynak kalitesi veya en fazla 4K / 1440p / 1080p / 720p / 480p / 360p seçimi.
- Seçilen çözünürlük üst sınırdır; kaynak daha düşükse yükseltme yapılmaz. 4K yalnızca kaynakta varsa kullanılabilir. Ses bit hızı seçimi de kaynağın gerçek kalitesini artırmaz.
- MP4 çıktısı H.264/AAC uyumluluğuna göre hazırlanır. Gerekirse dönüştürme zaman alabilir. MKV video akışını yeniden kodlamadan korur.
- İndirme kuyruğu, aktarım ilerlemesi, dosya hazırlama ilerlemesi, iptal ve yeniden deneme.
- İndirme geçmişi ve ayarlar bilgisayarda saklanır. Hesap açılmaz; merkezi sunucuya geçmiş gönderilmez. Kaynak platformla indirme için bağlantı kurulur.
- Çıkış klasörü seçilebilir; varsayılan yer Windows İndirilenler klasörü içindeki `hea-indir` klasörüdür.
- Aynı isimli dosyanın üzerine yazılmaz; `(1)`, `(2)` gibi ekler kullanılır.
- Ayarlar bölümünden yt-dlp motor güncellemesi.

## İlk sürümün kapsamı

Windows 10/11, 64 bit içindir. Telefon sürümü dahil değildir.

Herkese açık, tekil videolar hedeflenir. Özel içerikler, hesap girişi isteyen videolar, canlı yayınlar ve oynatma listeleri bu sürümde desteklenmez. Platformun bölge, oturum veya istek sınırları nedeniyle bazı bağlantılar indirilemeyebilir. Her sitedeki her videonun indirileceği garanti edilmez. Yalnızca indirme hakkın olan içerikleri kaydet.

İndirmeler sırayla yapılır. İptal edilen iş yeniden başlatıldığında baştan indirilir. Saat yanındaki Çıkış seçeneği etkin işleri iptal etmeden önce onay sorar. Bekleyen kayıtlar sonraki açılışta korunur; kendiliğinden indirme başlamaz. Liste ve geçmiş temizliği indirilen dosyaları silmez.

Uygulamanın kod imzası yoktur. Uygulama sürümü 0.4.0'dır; motor güncellemesi yalnızca yt-dlp'yi günceller, arayüzü veya FFmpeg'i güncellemez.

## Kaynaktan çalıştırma

Node.js 24 veya uyumlu yeni bir LTS sürümü gerekir. Normal kullanıcı için hazır Windows paketi yeterlidir.

```powershell
npm ci
npm run tools
npm start
```

Electron ilk açılışta resmi çalıştırıcısını indirir. Paket oluşturma:

```powershell
npm test
npm run pack
```

Windows ZIP paketi ve çalıştırılabilir uygulama klasörü `dist/` altında oluşur. `npm run pack:portable` ile NSIS kurulumu çalışabilen geliştirme ortamlarında tek dosyalık taşınabilir EXE de üretilebilir. Teslim edilen sürüm klasör/ZIP paketidir. `scripts/fetch-tools.mjs` resmi yt-dlp ve FFmpeg arşivlerini SHA256 ile doğrular. `assets/` içindeki ikonlar kaynakla birlikte gelir; yeniden çizmek istersen `scripts/create-icon.py` için Python + Pillow kullanılabilir.

## Yapı

- `app/main.cjs`: Windows penceresi, IPC doğrulaması, kuyruk, kalıcı ayarlar, klasörler ve güncelleme.
- `app/browser-bridge.cjs`: eşleştirme, yalnızca loopback dinleyicisi, istemci/token kontrolü ve tarayıcı istekleri.
- `extension/`: Manifest V3 Chrome eklentisi, video algılama ve sayfa düğmesi.
- `app/engine.cjs`: URL doğrulaması, yt-dlp, FFmpeg/FFprobe, süreç iptali ve dosya çıktısı.
- `app/preload.cjs`: dar kapsamlı, izinli masaüstü API köprüsü.
- `app/index.html`, `app/styles.css`, `app/renderer.js`: Türkçe arayüz.
- `tests/engine.test.cjs`: güvenli URL/argüman işleme, süreç iptali, gerçek medya akışı ve dosya koruma testleri.

Renderer Node erişimi olmadan, context isolation ve sandbox açık çalışır. Video başlıkları HTML olarak çalıştırılmaz. Harici sayfa açılması doğrulanmış platform bağlantılarıyla sınırlıdır. Shell komutu oluşturulmaz; araçlara ayrı argüman dizileri geçirilir. Kullanıcı yt-dlp yapılandırmaları yüklenmez.

## Bağımlılıklar ve kaynaklar

Arayüz ve uygulama kodu MIT lisanslıdır. Ayrı çalıştırılan üçüncü taraf araçlar kendi lisanslarına tabidir; dağıtım içindeki `resources/licenses/` belgelerine bak.

- Electron: https://www.electronjs.org/ — MIT; Chromium ve diğer bileşenlerin bildirimleri Electron dağıtımına dahildir.
- yt-dlp: https://github.com/yt-dlp/yt-dlp — proje Unlicense; paketlenmiş Windows çalıştırıcısında GPLv3+ bileşenler bulunur. Kaynak ve üçüncü taraf bildirimleri ilgili sürüm deposunda bulunur.
- FFmpeg / FFprobe: https://ffmpeg.org/ ve https://www.gyan.dev/ffmpeg/builds/ — kullanılan Windows derlemesi GPLv3. Dağıtılan derlemenin sürümü, derleme seçenekleri, kaynak revizyonu ve lisansı `resources/licenses/` altında korunur.

Yeniden dağıtım yaparken paket içindeki lisans ve kaynak bildirimlerini koru; bağımlılıkların kendi dağıtım yükümlülüklerini de incele.
