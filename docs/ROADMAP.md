# IRONFRONT durum ve yol haritası

Durum tarihi: 30 Ekim 2026. Bu dosya yapılmış işleri ve gelecek değişiklikleri ayırır. Sıralama öneridir; tarihler ve rekabetçi denge garantisi verilmez.

## Tamamlanan ilk sürüm

- [x] Go otoriter sunucu; dört oyunculu oda, host başlangıcı, bot antrenmanı, kısa kopmada token ile geri dönüş.
- [x] Three.js 3D RTS; birlik/kutu seçimi, grup emri, dizilim, minimap, savaş arayüzü.
- [x] Dört faction, faction başına dört birlik sınıfı ve üç dizilim; üç arazi haritası.
- [x] 25 kişilik birlikler, başlangıç 100 kapasite, outpost +25, ek üs +50 ve ana üs devri.
- [x] Sınıfa göre takviye süreleri, flank/notice time, kahraman modu ve üç hero sınıfı.
- [x] CC0 çevre varlıkları, font ve bağımlılık lisansları.
- [x] Go kural testleri, üç simülasyon maçı ve dört WebSocket istemcisi entegrasyonu.
- [x] Windows başlatıcı, Dockerfile, Vercel frontend ayarı ve dağıtım kılavuzu.
- [x] GitHub'da mantıksal kaynak commitleri ve geliştirme kuralları.
- [x] GitHub Actions taslağı; etkinleştirme yetki bekliyor.

## Tamamlanan karakter ve animasyon iyileştirmesi

- [x] CC0 KayKit karakterleri, silahlar, kaynak lisansı ve yeniden üretilebilir asset dönüştürücüsü.
- [x] GPU üzerinde oynatılan 20 hareket/poz, üç geometri detay seviyesi ve faction kumaş renkleri.
- [x] Koşu, silaha göre saldırı, yay çekme, blok, darbe, kaçınma, zıplama ve düşme animasyonları; sunucu olaylarıyla bağlantı.
- [x] Oturan süvari pozu; eklemli prosedürel at/deve görünümü ve yürüyüşü.
- [x] Hero omuz kamerası ve karakteri kapatmayan can paneli.
- [x] Birlik Talimi sayfası; hareket seçimi, duraklatma, kamera ve 400 asker görünümü.
- [x] Asset bütünlük kontrolü, üretim derlemesi, yerel tarayıcı ve bot maçı kontrolü. Ölçümler: [VISUAL_UPGRADE.md](VISUAL_UPGRADE.md).

## Sıradaki işler

30 Ekim 2026'da [Vercel frontend](https://ironfront-ebon.vercel.app) ve Render Frankfurt Go servisi yayımlandı. Dört WSS istemcisi, tarayıcıdan faction reddi/tekrar katılım, 400 asker, hero hareketi/isabeti ve origin denetimi canlıda doğrulandı. Katılım reddinde proxy close gecikmesinin arayüzü bekletmesi düzeltildi. [Dağıtım kimlikleri ve test kaydı](DEPLOYMENT.md). Dört farklı cihazla gerçek oyuncu testi hâlâ kullanıcı denemesini bekliyor.

Birlik teması gerçek asker gövdelerinden hesaplanır: yalnız menzil/açı/engel denetimini geçen askerler saldırır, yakındaki askerler merkezleri uzakta olsa da çatışabilir. Vurulan slot hasar tepkisini ve ölümü taşır. Hero blok/kaçınma, üs yüzeyi, engeller ve allocation üretmeyen temas sorgusu testleri; tüm Go testleri/vet, üretim derlemesi, dört WebSocket istemcisi ve tarayıcıda ön/arka sıra ayrımı geçti.

Saldırı hazırlık/temas zamanlaması tamamlandı. Yakın dövüş hasarı hazırlık sonrası yeniden doğrulanan temasta; birlik ve Akıncı hero atışları mesafeye bağlı uçuş sonunda çözülür. Kaçan hedef, engel, hazırlık sırasında ölüm/geri çekilme ve varış anındaki dodge test edildi. Klipler bitmeden yeniden başlatılmaz; 20 Hz isabetler 10 Hz görüntü paketinde biriktirilir. Oklar tek instanced çizimde, yaylım başına en fazla üç temsili okla gösterilir; gerçek hasar her katılımcı asker için ayrı hesaplanır. Izgara yalnız dolu hücreleri temizler ve temas sorgusu dost hücreleri atlar.

İlk savaş paketinin oynanabilir yerel sürümü `start-combat.cmd` ile 8790 portundadır. 400/800 askerlik önce/sonra sunucu ölçümleri ve ilk tarayıcı profili: [COMBAT_VALIDATION.md](COMBAT_VALIDATION.md).

FPS paketi `start-performance.cmd` ile 8792 portundadır. Kamera dışı actor çizimi, uzak binek geometrisi, instance kapasitesi/renk tamponları, etiket layout'u ve hero HUD yenilemeleri iyileştirildi. Sabit hareket ve saldırı tekrarıyla A-B-B-A / B-A-A-B ölçümleri, GPU sorguları ve işlev testleri tamamlandı. Ortalama FPS yükseldi; 800 askerli hero kare p95 değeri yaklaşık 33 ms kaldı. Kullanıcının diğer uygulamaları kapatılmadığından cihaz/GPU tamamen izole değildi. [Ham örnekler ve sınırlar](RENDER_VALIDATION.md).

Dizilim tutarlılığı düzeltildi: Viking/Arab çemberleri bütün yönlerde sırasıyla %18/%14 savunma sağlar. Hero vuruşları da aynı dizilim ve zırh hesabından geçer; botlar oyuncularla aynı 1,4 saniyelik yeniden dizilme cezasını kullanır. 12 dizilimin üç yönü, hero çember teması ve bot geçişi test edildi; tüm Go testleri, vet ve frontend üretim derlemesi geçti.

Hero yürüyüş kamerası, karakterle aynı karede hesaplanan tek bir konumu takip eder. Konum/zıplama için kısa snapshot tamponu ve orta tuşla basılı sürükleme kontrolü eklendi. Tarayıcı ölçümü ve kontroller: [CAMERA_CONTROLS.md](CAMERA_CONTROLS.md).

Kalabalık geçişi tamamlandı: sabit asker kimlikleri, komşuluk ızgarasıyla dairesel ayrıştırma, hero için alt adımlı çarpışma, gerçek asker konumuna isabet, kamerayı kapatan gövdeleri soluklaştırma ve hero görünümünde detay/veri aktarımı optimizasyonu. Yerel 400 asker ölçümleri ve sınırlar: [CROWD_VALIDATION.md](CROWD_VALIDATION.md).

Hero kontrol geçişi tamamlandı: kamera yönüne göre A/D düzeltmesi, ok tuşları, geri/yan adımlar, yönünü koruyan kaçınma, 33 animasyon, temas zamanlaması, saldırı sırası ve sunucu onaylı isabet geri bildirimi. Turks kapüşonları da faction rengine boyanır. Ayrıntılar ve kontroller: [HERO_FEEL.md](HERO_FEEL.md).

| Sıra | Planlanan parça | Bitirme ölçütü | Önerilen commit kapsamı |
|---|---|---|---|
| 1 | CI etkinleştirme | Workflow yetkisi sağlanır; frontend build, Go race/vet ve dört istemci testi Linux'ta geçer | `ci: enable verified multiplayer checks` |
| 2 | Dört insanla bağlantı denemesi | Ayrı cihazlarda oda, dolu oda reddi, kopma, tekrar bağlanma ve maç sonu gözlemlenir; RTT ve hata kaydı tutulur | `test(net)` ve bulunan hatalara ayrı `fix(net)` |
| 3 | Ayrı cihazda uzun performans testi | Sabit 400/800 asker karşılaştırması tamamlandı; yalnız oyun açıkken uzun gerçek maçta kare süreleri ve ağ trafiği ölçülür | `perf(render)` veya `perf(server)`; ölçümle bulunan darboğaza göre |
| 4 | Denge denemeleri | Faction/harita/dizilim eşleşmeleri ve önden/yan/arka saldırılar tekrarlanır; katsayı değişikliği kanıtıyla açıklanır | `balance(rules)` ve ilgili kural testleri |
| 5 | Görsellerin sonraki geçişi | Faction başına ayrı model/siluetler, daha doğal binekler ve yakın savaş temasları; mevcut hareketlerin kullanıcı testiyle değerlendirilmesi | `assets(characters)` veya `feat(client)` |
| 6 | Canlı maç geri bildirimi | Vercel + Render yayını tamamlandı; dört farklı cihazda tam maç, kopma ve performans gözlemleri kaydedilir | Bulunan sorunlara ayrı düzeltmeler |

Bunlar henüz tamamlanmış özellikler değildir. Her parça ayrı uygulanır, doğrulanır ve commit edilir; sırf planı göstermek için boş commit atılmaz.

## Bilinen sınırlar ve kapsam

- Emir ve toplam can birlik seviyesindedir. Asker konumları artık ayrı hafif çarpışma daireleriyle ayrıştırılır; tam rigid-body, asker başına ayrı can veya kılıç kemiği hitbox sistemi değildir.
- İnternet gecikmesinde tahmin/rollback, kalıcı oturum, matchmaking, hesap ve maç geçmişi yoktur.
- PostgreSQL ancak hesap/geçmiş gibi kalıcılık ihtiyacı doğarsa değerlendirilir. Mevcut oyun için gerekmez.
- Kaynak/altın/tarım ve ekonomik ilerleme eklemek kapsam dışıdır.
- Canlı servis ücretsiz Render planındadır; boşta uyuyabilir, restart/deploy RAM'deki maçları siler. Kalıcı maç kaydı yoktur.
- Ayrıntılı kanıt ve sınırlar: [VALIDATION.md](VALIDATION.md). Çalıştırma: [README](../README.md). Commit düzeni: [CONTRIBUTING](../CONTRIBUTING.md).
