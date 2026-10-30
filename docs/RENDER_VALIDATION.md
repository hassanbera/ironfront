# FPS ve çizim doğrulaması — 30 Ekim 2026

Önceki sürüm: `058be2835d954c6fd699d5e7520b5ee8d53762dd`. Yeni istemci: `d5b02778ef26eb185dd69a5c2bf1dbcbe8c68f3c`. Go simülasyonu ve savaş kuralları bu pakette değiştirilmedi.

Ortalama FPS ve GPU çizim süreleri iyileşti. **800 askerli hero sahnesinde kare süresinin p95 değeri yaklaşık 33 ms'de kaldı; bu cihazda kesintisiz 60 FPS veya tüm takılmaların giderildiği iddia edilmiyor.**

## Değişiklikler

- Kamera dışındaki asker, diğer hero ve cesetlerin çizimi atlanır. Konum yumuşatması ve yürüyüş fazı işlemeye devam eder; kamera dönünce güncel konumdan görünürler. Yerel hero her zaman çizilir. Beş metrelik muhafazakâr sınır silah, binek ve kısa güneş gölgesini kapsar.
- 30 metreden uzak binekler aynı eklemli yürüyüşü daha az üçgenle kullanır. Yakındaki modeller korunur. Uzak bacak parçası 84 yerine 12 üçgendir. Yoğun süvaride bacak, toynak, gövde, baş, boyun, kulak ve eyer instance sınırları artırıldı; parçalar kapasiteye takılıp kaybolmaz.
- Her kare güncellenen renk tamponları `DynamicDrawUsage` kullanır. Yalnız kullanılan aralık GPU'ya gönderilir.
- Dünya etiketlerinin tuval boyutu, DOM yazımlarından önce bir kez okunur. Etiket başına zorunlu layout ölçümü kaldırıldı.
- Hero görünümünde gizli ordu paneli üretilmez; diğer HUD parçaları yalnız içerikleri değiştiğinde yenilenir. RTS'ye dönüşte ve yeni maça girişte güncel durum gösterilir.

## Kontrollü tekrar

`scripts/render-replay-browser.js`, üretim derlemelerindeki gerçek `World` çizim yoluna aynı hareket/saldırı/ok/isabet dizisini uygular. Bu, **sentetik bir çizim yüküdür**; gerçek sunucu maçının sonucu veya denge testi değildir. 800 asker normal başlangıçtaki 400 askerin üzerinde bir stres senaryosudur.

- Aynı Chrome oturumu; Intel UHD Graphics, ANGLE / D3D11; 1440×900, DPR 1, yüksek kalite, gölgeler açık.
- Assetler tamamen yüklendikten sonra 180 ısınma ve 420 ölçüm karesi; her çalışmada 419 rAF aralığı. Sabit animasyon zamanı ve kare adımı sayesinde yavaş sürüm hareketleri atlamaz.
- Üç sahne: hareket eden hero + 400 asker, hareket eden hero + 800 asker, RTS + 800 asker. Her iki sürümde fixture checksum eşit: `2580440161`, `3174828545`, `3174828545`.
- Önce A-B-B-A teşhis turu, ardından nihai sürümde B-A-A-B turu. A eski, B yeni. Test sırasında başka derleme veya yük testi çalıştırılmadı. Kullanıcının diğer uygulamaları/oyunu kapatılmadı; dolayısıyla GPU tamamen izole değildi. İki tur arasındaki FPS farkı sistem yükünün etkisini gösterir.
- GPU süresi `EXT_disjoint_timer_query_webgl2` ile ölçülür; geçersiz/disjoint sonuçlar atılır. GPU ölçümü gölge geçişini de kapsar. Three.js üçgen/çizim sayacı yalnız ana render geçişini sayar.
- İlk turdan sonra yalnız binek baş/boyun/kulak/eyer tampon kapasiteleri de artırıldı. Bu fixture bu parçaların eski sınırına ulaşmıyordu. İki turun sonuçları ayrı tutuldu; bütün 24 örnek [ham sonuç dosyasında](render-measurements-2026-10-30.json).

## Nihai sürüm: B-A-A-B

Tablodaki FPS ve süreler her sürümün iki çalışmasının aritmetik ortalamasıdır; p95 sütunu iki ayrı p95 ölçümünün ortalamasıdır, birleştirilmiş yüzdelik değildir. Süreler ms; düşük değer daha iyidir.

| Sahne | FPS eski → yeni | Kare p95 | GPU medyan | GPU p95 | Ordu CPU medyan | Etiket CPU p95 |
|---|---:|---:|---:|---:|---:|---:|
| Hero, 400 | 55,9 → 73,4 | 25,0 → 25,0 | 16,15 → 12,04 | 19,35 → 14,79 | 3,60 → 2,40 | 1,40 → 0,65 |
| Hero, 800 | 41,7 → 51,1 | 33,25 → 33,35 | 22,03 → 17,64 | 26,78 → 23,80 | 6,60 → 5,65 | 3,35 → 0,90 |
| RTS, 800 | 47,8 → 55,9 | 25,15 → 25,05 | 18,45 → 16,06 | 25,09 → 19,83 | 6,55 → 4,65 | 2,85 → 0,70 |

Her sürüm/sahne için 838 aralıkta **50 ms üstü kare yoktu**. 33,4 ms üstü kare sayısı hero 400'de 0→3, hero 800'de 6→27, RTS 800'de 3→0 oldu. Bu nedenle ortalama hız kazanımını bütün karelerin daha düzenli geldiği şeklinde yorumlamamak gerekir. Hero 800'de GPU ve CPU maliyeti düşmesine rağmen tarayıcının kare sunumu hâlâ değişkendir; ayrı cihazda uzun gerçek maç testi gerekir.

Ana geçişte medyan üçgen sayısı hero 400'de 875.626→419.984, hero 800'de 1.283.701→744.323, RTS 800'de 937.809→575.903 oldu. Sunucu asker sayısı azaltılmadı. Kamera dışındaki askerler çizim sayacından çıkar; hareketleri devam eder.

İlk A-B-B-A turundaki ortalama FPS: hero 400 **36,8→41,1**, hero 800 **40,5→51,1**, RTS 800 **53,0→62,5**. Özellikle eski hero 400 çalışmaları 26,8 ve 46,7 FPS arasında değişti. Bu turda 50 ms üstü kareler sırasıyla 21→6, 3→2, 0→0 idi. Tek en iyi çalışmayı genel performans sonucu olarak kullanmıyoruz.

## İşlev kontrolleri

- TypeScript kontrolü ve Vite üretim derlemesi geçti. Three.js parçasının 500 KB üstü bundle uyarısı devam eder; derleme hatası değildir.
- Görünürlük birim testi: ön/arka, ekran kenarı, yakın düzlem, kamera dönüşü.
- Tarayıcı: görünmeyen askerin interpolasyonu, kamerayı çevirince dönüşü, yerel hero görünürlüğü; yakın bineğin detaylı sekiz bacak parçası; 800 uzak binekte 6.400 bacak, 3.200 toynak ve her ikili parçada 1.600 instance.
- Ön/arka sıra temas ayrımı ve gerçek vurulan asker; saldırı hazırlığı, ok bırakma/varış, olay tekrarını önleme; 96 okun tek ek çizim çağrısı olması geçti.
- Kamera takibinde 356 örnekte ekrandaki sapma yatay 0,00003 px, dikey 0,00009 px altında; WASD/ok tuşları, yön değiştirme, sıçrama, kaçınma, snapshot dalgalanması, çarpışmada durma ve paket kaybı regresyonları geçti.
- HUD'da iki saniyelik değişmeyen durum için eski ordu/hero paneli 10/10, yeni 0/0 DOM yenilemesi. Hero'dan RTS'ye dönüş, birlik seçimi, dizilim ve yeni maçta cache temizliği geçti.
- Oynanabilir hero ekranı görsel olarak incelendi; konsolda hata/uyarı yoktu.
- Linux Docker üretim imajı derlendi ve izole 8796 portunda çalıştırıldı. `/health`, dört gerçek WebSocket bağlantısı, beşinci oyuncu reddi, sahiplik, 400 asker kimliği/konumu, dizilim, hero ve token ile tekrar bağlanma geçti. İki hero istemcisinde ok uçuşu/varış/dodge testi de geçti. Bunlar aynı makineden açılan bağlantılardır; dört fiziksel cihaz testi değildir.
- Bu turda Go kodu değişmedi; önceki Go test/vet sonuçları [COMBAT_VALIDATION.md](COMBAT_VALIDATION.md) içindedir. Yeni race veya GitHub Actions başarısı iddia edilmez.

## Tekrar çalıştırma

Eski ve yeni commitleri ayrı çalışma dizinlerinde üretim olarak derle; iki sunucuyu farklı portlarda aç. Aynı tarayıcı oturumunda her seferinde taze `/crowd-lab.html?scene=hero400` sayfasına git ve Playwright CLI ile `run-code --filename=<repo>/scripts/render-replay-browser.js` çalıştır. `hero800` ve `rts800` için tekrarla. Portları A-B-B-A veya B-A-A-B sırasıyla değiştir. Karşılaştırma sırasında derleme, ikinci test tarayıcısı veya yük testi başlatma.

Ek kontroller: `node --experimental-strip-types scripts/actor-visibility-test.mjs`; taze lab sayfasında `render-visibility-browser.js`, `contact-browser.js`, `attack-timing-browser.js`, `hero-camera-browser.js`; ana sayfada `hud-browser.js` (`?baseline` yalnız eski sürümde mutasyon eşiğini kaldırır).
