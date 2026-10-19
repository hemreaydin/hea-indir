# hea-indir 0.4.0 · Chrome kurulumu

1. Windows 0.4.0 ZIP paketini tamamen, kalıcı bir klasöre çıkar. Eski hea-indir sürümünü tamamen kapat.
2. İçindeki **resources → native → Chrome-Baglantisini-Kur.cmd** dosyasını bir kez çalıştır. Yönetici olarak çalıştırmana gerek yok.
3. Chrome'da chrome://extensions sayfasına git ve **Geliştirici modu**nu aç.
4. **Paketlenmemiş öğe yükle** ile Windows paketindeki resources/extension klasörünü veya Chrome ZIP'inden çıkardığın hea-indir-Chrome klasörünü seç.
5. Eklenti önceden yüklüyse eski kaydın klasöründeki dosyaları güncelleyip **Yenile** düğmesine bas. Farklı klasöre geçtiysen eski kaydı kaldırıp yeni klasörü yükle. Sayfaları da yenile.
6. Chrome araç çubuğundaki hea-indir simgesine bas ve **Video indirme** anahtarını **AÇIK** yap.

İlk açılış varsayılan olarak KAPALI'dır. Windows bağlantısı kurulduktan sonra eşleştirme otomatik yapılır. Programı elle açman gerekmez. Anahtar açıkken videoyu oynat; sağ üstteki sarı düğmeye bas veya eklenti içinden kaynağı seç. Son indirmelerin durumunu eklentide görebilirsin.

**KAPALI** yeni indirmeleri engeller ve sayfa düğmesini gizler. Devam eden indirmeler kesilmez. Açık/kapalı tercihi Chrome yeniden açıldığında da korunur.

Program penceresindeki X yalnızca pencereyi gizler. Tamamen kapatmak için saat yanındaki hea-indir simgesinde **Çıkış** seç. Eklenti açıkken sonraki İndir tıklaması programı tekrar başlatır. Windows'a girişte otomatik başlatma veya sürekli çalışan bir sistem servisi kurulmaz.

## Sorun giderme

- **Bir kez kurulum gerekli:** Windows paketindeki bağlantı kurulumunu çalıştır. Eklenti tek başına indirme motorunu içermez.
- **Eski sürüm açık:** 0.3.0 penceresini kapat; 0.4.0 için saat yanından Çıkış kullan. Sonra eklentide anahtarı yeniden aç.
- **Klasörü taşıdım:** Yeni klasörde Chrome-Baglantisini-Kur.cmd dosyasını yeniden çalıştır.
- **Kaynak görünmüyor:** Sayfayı yenile ve videoyu birkaç saniye oynat. Her site desteklenmez; DRM, hesap girişi, canlı yayın ve listeler desteklenmez.
- **Bağlantıyı kaldırmak:** resources/native/Chrome-Baglantisini-Kaldir.cmd çalıştır. İndirmelerin ve ayarların silinmez.

Bağlantı sadece bu eklentinin sabit kimliğine izin verir. Şifre ve tarayıcı çerezleri aktarılmaz. Tür, biçim, kalite ve klasör ayarları masaüstü uygulamasından alınır.
