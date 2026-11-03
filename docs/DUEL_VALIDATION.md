# Turks Muhafızı ve Knights piyadesi · 3 Kasım 2026

İkili çalışmayı Birlik Talimi'ndeki **Turks ve Knights · İkili talim** bağlantısı açar. **Saldır** hareketi iki karakteri sırayla saldırı ve kalkan karşılamasıyla oynatır. **Duraklat** ve fareyle döndürme, temas pozunu iki açıdan incelemeye yarar. Normal maçta Turks tarafında Muhafız sınıfını veya Knights kılıç-kalkanlı ağır piyadesini seç.

[Blender çalışma sahnesi](../art/duel/IRONFRONT-Duel.blend) iki armature, 18 düzenlenebilir Action ve paketlenmiş malzeme haritaları içerir. KayKit kaynakları, lisans ve yeniden üretme komutları [asset kaydında](../frontend/public/assets/characters/SOURCES.md). Blender MCP 2.2.6, Blender 4.0.2 ile localhost üzerinden sahne okuma ve Python çalıştırma çağrılarıyla doğrulandı.

## Kıyafet ve ölçek geçişi

Turks Muhafızı ile Knights ağır piyadesi aynı iskelet ölçülerini kullanır. Önceki sürümde her modelin boyu başlığı dahil dış sınırına göre belirleniyor, ayrıca heroya 1,16 ölçek çarpanı uygulanıyordu. Aynı pozdaki göz hizaları bu ikilide yaklaşık %27 farklı görünüyordu. Oyun, ikili talim ve Blender önizlemesi artık ortak gövde ölçeğini kullanır. Başlıkların kendi yükseklikleri farklıdır.

Muhafızın kılıcı hazır duruşta uca doğru yukarı kıvrılır. Orta hattı geçişi, yeni uç konumuyla tekrar örneklendi. Kırmızı kaftan, sarılı konik miğfer, zincir ense koruması ve yuvarlak göğüs plakası bu dövüşçüye özgüdür. Knights ağır piyadesinin kapalı miğferi, zincir zırhı ve kalkanıyla aynı çift şeridi taşıyan üstlüğü vardır. Tarihsel esin kaynakları ve yapım bilgisi [asset kaydında](../frontend/public/assets/characters/SOURCES.md).

| Üçgen sayısı | Yakın gövde | Orta gövde | Yakın ve orta mesafedeki silah ve kalkan | Uzak, ekipman dahil |
|---|---:|---:|---:|---:|
| Turks Muhafızı | 2.663 | 1.553 | 434 | 381 |
| Knights ağır piyadesi | 1.802 | 1.102 | 248 | 311 |

Uzak modelde kılıç ve kalkan gövdeyle aynı çizim çağrısını kullanır ve el kemikleriyle hareket eder. Yakında kumaş ve çeliğin yüzey ayrıntıları ayrı haritalardan okunur. Orta ve uzak gövdelerde renk haritası ve basit aydınlatma kullanılır. Karakter dizinindeki BIN, JSON ve PNG dosyalarının diskteki toplam boyutu 7.285.110 bayttan 8.473.859 bayta yükseldi.

### Kıyafet geçişinin ölçüm koşulları

Karşılaştırma aynı makinede Intel UHD Graphics, Chrome, 1440 × 900, DPR 1 ve yüksek kaliteyle yapıldı. `f2c167c` sürümü referans alındı. İki sürümde aynı kamera ve asker konumlarıyla 180 kare ısınma sonrası 419 kare aralığı ölçüldü. Her sahnede konum sağlama toplamları eşleşti. Her koşunun FPS, kare p95 ve GPU medyanı ayrı hesaplandı, ardından aynı sürümün koşularında ortalama alındı.

İlk kıyafet sürümünde 800 askerlik RTS tekrarında kare p95 süresi 45,85 ms’den 58,35 ms’ye yükseldi. Bunun üzerine uzak gövdelerde miğfer, giysi ve kalkanın ana hatları korundu, ince kabartmalar çıkarıldı. Orta ve uzak modellerin malzemesi sadeleştirildi. Yakın gövdeler ve yakın silah geometrileri ilk kıyafet sürümüyle bayt düzeyinde eşleşti.

Son oyun kodu `1b4e30e`. Her hero sahnesinde sürüm başına iki koşu yapıldı. RTS'de sıra ters çevrilerek sürüm başına dört koşu tamamlandı.

| Sahne | FPS eski → yeni | Kare p95, ms | GPU medyanı, ms | Ana geçiş çizim çağrısı |
|---|---:|---:|---:|---:|
| Hero, 400 asker | 41,65 → 41,10 | 33,40 → 33,40 | 16,76 → 15,98 | 44 → 44 |
| Hero, 800 asker | 33,65 → 32,45 | 41,65 → 41,70 | 23,36 → 23,77 | 49 → 50 |
| RTS, 800 asker | 38,63 → 38,23 | 33,40 → 37,50 | 18,27 → 18,61 | 52 → 54 |

RTS'de ana geçişte çizilen medyan üçgen sayısı 575.490’dan 539.151’e indi. Yeni sürümün ilk koşusunda p95 50 ms, diğer üçünde 33,3–33,4 ms ölçüldü. Ölçümler yerel ve sabit kamera tekrarına aittir. [İki kıyafet sürümünün 28 ham koşusu](costume-replay-2026-11-03.json).

Üretim derlemesi, tekrar üretilebilir asset kontrolü ve el kemiği bağlantıları dahil asset doğrulaması geçti. Tarayıcıda altı model/mesafe birleşiminin gövde ve ekipman çizimleri kontrol edildi. Talimde blok, sola kaçınma ve saldırı çalıştı. Normal maç girişinden Türk Muhafızı ile saldırıp RTS'ye dönüldü. Bu son kontrollerde tarayıcı konsolunda hata veya uyarı görülmedi.

## Önceki paketin görsel ve hareket kontrolleri

Turks Muhafızı kırmızı dokuma, pirinç süslemeli yuvarlak kalkan ve kavisli kılıç kullanır. Knights piyadesi sivri uçlu çift şeritli arma kalkanı ve düz kılıç kullanır. Yakın gövdeler aynı iskeleti ve geometriyi paylaşır. Yeni UV'ler kumaş, deri ve çeliği renk, pürüzlülük, metal ve normal bilgisine göre ayırır. Ekipman sırasıyla 410 ve 248 üçgendir. En uzak gövde seviyesinde mevcut hafif kılıç-kalkan çizimi kullanılır.

İki karakter için yatay kesiş, çapraz kesiş, saplama, kalkan darbesi, darbe tepkisi, yürüme, koşma ve iki yan kaçınma klibi hazırlandı. Kesişler, kendi kılıç uçlarının vücudun önündeki orta hattan geçtiği poza göre yeniden zamanlandı. Bu poz Muhafız'da saldırının %42'sine, piyadede %45'ine denk gelir. Hasar kararını Go sunucusu verir.

- Üretim derlemesi ve asset doğrulaması geçti. Kemik ağırlıkları, sonlu matrisler, geometri sınırları, klip süreleri ve iki kesişin temas fazındaki kılıç ucu kontrol edildi.
- Tarayıcıda gerçek Turks Muhafızıyla maça girme, saldırı ve RTS'ye dönüş geçti. Ön/arka sıra teması, doğru hedef ve saldırı/ok zamanlaması regresyonları geçti.
- İkili talimde iki karakter ve pozlar görsel olarak incelendi. İlk yüklemede eski poz dosyasıyla yeni metadata'nın birlikte kullanılması bulundu. Paket artık dosya içeriğinden türetilmiş sürüm ile yükleniyor ve poz uzunluğu kullanımdan önce doğrulanıyor. Son oyun ve talim kontrollerinde konsol uyarısı veya hatası görülmedi.
- Blender sahnesi ayrı bir Blender sürecinde tekrar açıldı ve kamera render'ı alındı.
- Karakter dizinindeki PNG, BIN ve JSON dosyalarının diskteki toplamı 5.779.524 bayttan 7.285.110 bayta çıktı. Fark 1.505.586 bayt. İlk ağ yükleme süresi ölçülmedi.

## Önceki paketin savaş tekrarında performansı

Eski sürüm `021c19a`, son oyun kodu `2551e1b`. Aynı Chrome oturumu, Intel UHD Graphics / D3D11, 1440 × 900, DPR 1, yüksek kalite ve gölgeler açık. Her çalışma 180 ısınma karesi ve 419 ölçülen kare aralığı içerir. `fighter=duel` Muhafız'ı yerel hero yapar ve Knights piyadesini kamera önüne taşır. Her sahnede iki sürümün asker konumu checksum'ları eşleşti.

Aşağıda son turda her sürümün iki çalışmasının ortalaması gösterilir. Kare p95 sütunu iki çalışmanın ayrı p95 değerlerinin ortalamasıdır. GPU medyanı WebGL zaman sorgusundan gelir.

| Sahne | FPS eski → yeni | Kare p95, ms | GPU medyanı, ms | Ana geçişte çizim çağrısı |
|---|---:|---:|---:|---:|
| Hero, 400 asker | 49,55 → 54,85 | 33,35 → 25,05 | 17,08 → 16,19 | 42 → 44 |
| Hero, 800 asker | 39,80 → 40,95 | 37,60 → 37,50 | 21,67 → 21,20 | 46 → 49 |
| RTS, 800 asker | 47,90 → 51,25 | 29,20 → 25,05 | 17,72 → 17,17 | 52 → 52 |

İlk eski–yeni–yeni–eski turunda ayrıntılı ekipman tüm mesafelerde çiziliyordu. RTS ortalaması 49,30 → 42,55 FPS ve çağrı sayısı 52 → 54 oldu. En uzak seviyede ekipman çizimini paylaşan son sürüm yeni–eski–eski–yeni sırasıyla tekrar ölçüldü. Bu RTS sahnesinde ana geçişte iki sürüm de medyan 575.490 üçgen çizdi.

İki tekrar arasında sistem yükü değişti. Özellikle ilk turdaki eski 800 asker hero çalışmaları 43,9 ve 30,6 FPS verdi. Küçük ortalama farklarından genel bir hız artışı sonucu çıkarılamaz. Ağır hero sahnesinde son turdaki yavaş kareler iki sürümde de yaklaşık 38 ms sürdü.

[24 çalışmanın ham ölçümleri](duel-replay-2026-11-03.json). Tekrar için her iki üretim derlemesinde taze `/crowd-lab.html?scene=hero400&fighter=duel` açıp aynı [tarayıcı ölçümünü](../scripts/render-replay-browser.js) çalıştır. `hero800` ve `rts800` ile aynı sırayı tekrarla.
