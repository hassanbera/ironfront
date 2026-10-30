# Doğrulama — 30 Ekim 2026

Bu kayıt ilk oynanabilir sürümün yerel kontrollerini özetler. İnternet dağıtımı veya farklı fiziksel cihazlarda yük testi yapılmadı.

## GitHub aktarımı sırasında tekrar kontrol

30 Ekim 2026 tarihinde `go test ./...`, `go vet ./...` ve frontend üretim derlemesi yeniden geçti. Dört WebSocket istemcisi testi, kullanıcının açık oyununa dokunmadan geçici bir sunucuda `9890` portunda çalıştırıldı ve geçti. Vite, Three.js chunk boyutu için 500 KB uyarısı verdi; derleme başarılıdır.

GitHub Actions workflow gönderimi, OAuth oturumunun `workflow` kapsamı eksik olduğu için GitHub tarafından reddedildi. Hazırlanan kontrol dosyası `docs/ci.yml.template` olarak saklanır; aktif CI veya başarılı Linux race sonucu yoktur. Etkinleştirme koşulu CONTRIBUTING.md içinde açıklanır.

Design Report şablonuyla hazırlanan `docs/IRONFRONT-Tasarim-Raporu.docx` altı sayfa olarak render edildi ve tüm sayfalar incelendi. Türkçe Word için içindekiler alanı yerelleştirmeden bağımsız hale getirildi; 12 başlığın sayfa numarası doğrulandı. Kaynak şablon değiştirilmedi; stiller, bölüm geometrisi, numaralandırma ve ilişki parçaları korundu.

## Geçen kontroller

- `npm run build`: TypeScript strict kontrolü ve Vite üretim derlemesi başarılı.
- `go test -v ./...`: **13 test başarılı**. Ana üs devri, çekişmeli outpost, üs faaliyete alma süresi, sınıfa özel doğma, kapasite düşüşü, dost üs yanında takviye, komut sahipliği, arkadan saldırı ve fark etme süresi, geriye dönmeden misilleme engeli, hero doğma/çarpışma, blok/kaçınma ve stale-input temizliği.
- Üç haritanın her birinde A* yollarının engelleri dolaşması doğrulandı.
- Üç haritada 20 dakikalık bot maçları simülasyon zamanıyla sonuna kadar çalıştırıldı; durum sayıları sonlu, asker sayıları 0–25 aralığında kaldı ve maçlar sonuçlandı. Bu, rekabetçi denge kanıtı değildir.
- `go vet ./...`: başarılı.
- `node scripts/network-test.mjs`: dört gerçek WebSocket istemcisiyle başlangıçta 16 birlik / 400 asker; beşinci oyuncu reddi; host-only başlangıç; sahiplik kontrolü; hareket, dizilim ve hero yayını; token ile yeniden bağlantı ve yanlış token reddi doğrulandı.
- HTTP `/health`: 200, 20 Hz simülasyon bilgisi.
- WebSocket origin kontrolü, lobby host devri ve boşalan faction slotuna yeni oyuncunun girmesi yerel HTTP/WebSocket entegrasyon testinde geçti.
- Tarayıcıda üç harita ve faction seçimi, hero sınıfı seçimi, bot maçı başlatma, toplu birlik seçimi, sağ tık hareket emri, dizilim değişimi, RTS/hero geçişi, WASD girdisi ve Q yeteneği denendi.
- 1280×800 ve 1440×900 masaüstü yerleşimleri incelendi. Dar panelde masaüstü kontrol gereksinimi açıklaması gösterilir; dokunmatik savaş desteği yoktur.

## Sınırlar

- `go test -race` bu Windows ortamında tamamlanamadı: yüklü GCC yalnızca 32 bit hedef destekliyor (`64-bit mode not compiled in`). Normal testler ve `go vet` geçti; race sonucu için 64 bit MinGW veya Linux CI gerekir.
- Dockerfile ve Vercel ayarları hazırlandı; gerçek Docker image dağıtımı/Vercel yayını doğrulanmadı.
- Uygulama içi Chromium tarayıcısında art arda fare kilidi istekleri `NotAllowedError` / `UnknownError` üretebildi. Son istemcide istekler 2 saniyede birle sınırlandı, reddedilen istekler yakalandı ve kilit yokken sol tuşla sürükleyerek bakış kontrolü eklendi. Standart masaüstü tarayıcısı da kullanılabilir; her tarayıcıda pointer-lock davranışı garanti edilmez.
- Donanımdan bağımsız FPS garantisi verilmez. Test tarayıcısında görülen FPS yalnızca bu makinenin o anki ölçümüdür.
- Hasar ve kayıplar birlik seviyesinde hesaplanır; asker bazında bağımsız fizik ve animasyon iskeleti yoktur. Görsel birimler instancing ile çizilir.
- Denge katsayıları başlangıç ayarıdır. İnsan oyuncularla faction/harita başına galibiyet, saldırı açısı, takviye ve hero etkisi ölçülerek ayarlanmalıdır.
- Kayıt ve hesap sistemi yoktur. Tarayıcı yenilemesi sonrası oturum kimliği korunmaz; yeni oda gerekir. Sunucu restart'ı aktif maçları bitirir.
