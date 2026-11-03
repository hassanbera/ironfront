# Turks Muhafızı ve Knights piyadesi · 3 Kasım 2026

İkili çalışmayı Birlik Talimi'ndeki **Turks ve Knights · İkili talim** bağlantısı açar. **Saldır** hareketi iki karakteri sırayla saldırı ve kalkan karşılamasıyla oynatır. **Duraklat** ve fareyle döndürme, temas pozunu iki açıdan incelemeye yarar. Normal maçta Turks tarafında Muhafız sınıfını veya Knights kılıç-kalkanlı ağır piyadesini seç.

[Blender çalışma sahnesi](../art/duel/IRONFRONT-Duel.blend) iki armature, 18 düzenlenebilir Action ve paketlenmiş malzeme haritaları içerir. KayKit kaynakları, lisans ve yeniden üretme komutları [asset kaydında](../frontend/public/assets/characters/SOURCES.md). Blender MCP 2.2.6, Blender 4.0.2 ile localhost üzerinden sahne okuma ve Python çalıştırma çağrılarıyla doğrulandı.

## Görsel ve hareket kontrolleri

Turks Muhafızı kırmızı dokuma, pirinç süslemeli yuvarlak kalkan ve kavisli kılıç kullanır. Knights piyadesi sivri uçlu çift şeritli arma kalkanı ve düz kılıç kullanır. Yakın gövdeler aynı iskeleti ve geometriyi paylaşır. Yeni UV'ler kumaş, deri ve çeliği renk, pürüzlülük, metal ve normal bilgisine göre ayırır. Ekipman sırasıyla 410 ve 248 üçgendir. En uzak gövde seviyesinde mevcut hafif kılıç-kalkan çizimi kullanılır.

İki karakter için yatay kesiş, çapraz kesiş, saplama, kalkan darbesi, darbe tepkisi, yürüme, koşma ve iki yan kaçınma klibi hazırlandı. Kesişler, kendi kılıç uçlarının vücudun önündeki orta hattan geçtiği poza göre yeniden zamanlandı. Bu poz Muhafız'da saldırının %42'sine, piyadede %45'ine denk gelir. Hasar kararını Go sunucusu verir.

- Üretim derlemesi ve asset doğrulaması geçti. Kemik ağırlıkları, sonlu matrisler, geometri sınırları, klip süreleri ve iki kesişin temas fazındaki kılıç ucu kontrol edildi.
- Tarayıcıda gerçek Turks Muhafızıyla maça girme, saldırı ve RTS'ye dönüş geçti. Ön/arka sıra teması, doğru hedef ve saldırı/ok zamanlaması regresyonları geçti.
- İkili talimde iki karakter ve pozlar görsel olarak incelendi. İlk yüklemede eski poz dosyasıyla yeni metadata'nın birlikte kullanılması bulundu. Paket artık dosya içeriğinden türetilmiş sürüm ile yükleniyor ve poz uzunluğu kullanımdan önce doğrulanıyor. Son oyun ve talim kontrollerinde konsol uyarısı veya hatası görülmedi.
- Blender sahnesi ayrı bir Blender sürecinde tekrar açıldı ve kamera render'ı alındı.
- Karakter dizinindeki PNG, BIN ve JSON dosyalarının diskteki toplamı 5.779.524 bayttan 7.285.110 bayta çıktı. Fark 1.505.586 bayt. İlk ağ yükleme süresi ölçülmedi.

## Aynı savaş tekrarında performans

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
