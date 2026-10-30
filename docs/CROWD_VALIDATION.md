# Kalabalık, kamera ve hedef teması — 30 Ekim 2026

## Değişen davranış

- Her asker kalıcı bir slot taşır. Ölümde kalan askerlerin kimlikleri kaymaz; takviye boş slotu doldurur.
- Sunucu 20 Hz'de hafif çarpışma dairelerini 3 m hücreli bir komşuluk ızgarasında ayırır. Piyade yarıçapı 0,54 m, binek 1,05 m; binek dizilim aralığı 1,9 katıdır. Hero yarıçapı 0,65 m'dir. Kahraman hareketi en fazla 0,25 m alt adımlarla çözülür; kaçınma asker hattını atlayamaz, çapraz hareket engel kenarında kayar. Geride kalan canlı asker uzak dizilim hedefine ışınlanmaz; hız sınırını koruyarak ilerler.
- Hero vuruşu artık birlik merkezini kullanmaz. Menzil/açı/engel denetiminden geçen askerler yakınlık ve bakış doğrultusuyla sıralanır; normal saldırı bir hedefe, saldırı yeteneği en fazla üç ayrı hedef/birliğe işler. Yakın dövüş menzili 3,4 m + hedef yarıçapıdır. Okçu menzili 32 m kalır. Ölümcül temas vurulan slotu çıkarır; sunucu hedef kimliği, konumu ve hasarını yayınlar.
- İstemci gerçek asker konumlarını snapshot aralığında yumuşatır. Yürüme fazı mesafeye bağlıdır. Darbe alan asker kısa parlar ve tepki verir; kendi hero vuruşunda üzerindeki hasar etiketi aynı kimliği izler. Uzun kare duraksamasından sonra görsel saat geride kalmaz.
- Görüş hattındaki askerler ve binekler ekran kapısına benzer noktalı solma kullanır. Kamerayı çevreleyen gövde tamamen gizlenir; hero tam görünürdür. Ayrı saydam nesne sıralaması veya ikinci görünürlük render geçişi eklenmez. Kamera engel yaklaşımında mesafesini sınırlar, zemin altına inmez; hedef etiketleri güncel kamera matrisiyle konumlanır.
- Hero görünümünde 12 m ve 30 m sonrası daha düşük geometri detayı kullanılır; hero yüksek detayda kalır. GPU'ya yalnız kullanılan instance aralıkları aktarılır. RTS detay eşikleri korunur.

## Yerel ölçüm

Windows, Intel Core i7-10750H, Chrome/ANGLE **Intel UHD Graphics / D3D11**, 1440×900, yüksek kalite, gölgeler açık. `/crowd-lab.html` aynı sabit kamera ve 400 askerle kullanıldı. Modeller yüklendikten sonra üçer 10 saniyelik örnek alındı; Go derleme/testi ölçüm sırasında çalıştırılmadı. Eski ve yeni sahne görüntüleri karşılaştırıldı. Bunlar bu bilgisayarda kısa yerel örneklerdir; farklı cihazlar veya internet maçları için FPS garantisi değildir.

| Ölçüm | Önce | Sonra |
|---|---|---|
| FPS, üç örnek | 19,4 / 19,7 / 18,1 | 29,9 / 30,9 / 25,0 |
| Kare süresi p95, ms | 75,0 / 74,9 / 83,3 | 49,9 / 49,9 / 58,4 |
| 50 ms üstü kare sayısı | 82 / 78 / 87 | 8 / 10 / 39 |
| Çizilen üçgen | 1,096–1,112 milyon | 0,644–0,648 milyon |
| Draw call | 39 | 38 |

400 asker ayrıştırma + konum paketleme mikro ölçümü: **1,35 / 1,43 / 1,45 ms**, **0 allocation/tick**. Dört oyunculu toplam tick ölçümü: **1,16 / 1,39 / 1,12 ms**. Tick bütçesi 50 ms'dir. Eski birlik simülasyonu yaklaşık 0,033–0,047 ms idi: çarpışma sunucuda ek iş yapar, bu ölçümde bütçenin küçük bir bölümünü kullanır. Üç tam bot maçı dahil Go testleri yaklaşık 101 saniyede tamamlandı.

400 askerlik ilk tam JSON snapshot **15.517 byte**. Konumlar `[squadID*32+slot, xSantimetre, zSantimetre]` üçlüleridir. 10 Hz'de bu başlangıç sahnesi istemci başına yaklaşık 155 KB/s uygulama verisidir; savaş olaylarıyla boyut değişir. İstemciden sunucuya 4 KB komut sınırı değişmedi.

## Kontroller

- `go test ./...`, `go vet ./...`: geçti; üç haritada tam bot maçları dahil.
- İki üst üste piyade diziliminin ayrılması ve dururken titrememesi; karşılıklı hareket ve hero alanından uzak kalma; dodge ile asker/engel atlanmaması; çapraz kayma; ölen gövdenin yolu kapatmaması: geçti.
- Birlik merkezi uzakta olsa da görünen askerin vurulması, doğru slotun ölmesi, sağ kalanın kimliğinin korunması, takviye ve ıskada eski hedefin tekrarlanmaması: geçti.
- Dört gerçek WebSocket istemcisinde 400 benzersiz asker kimliği, santimetre konumlarının yayını, emir sahipliği, dizilim, hero, dolu oda reddi ve token ile yeniden bağlantı: geçti.
- TypeScript / üretim derlemesi; görünürlük kapsülü, kamera içindeki binek, yan/arka asker ve solma sınırı testleri: geçti.
- Tarayıcıdaki bot maçında WASD ve dört ok tuşu ayrı ayrı uygulandı; sunucu hareket yönleri ve run/back/strafe klipleri eşleşti. WebGL/JavaScript hatası görülmedi.
- İki gerçek istemcili kontrollü odada hero teması `id:2, slot:11, damage:42` olarak geldi. İstemcideki son hedef anahtarı `75` (`2*32+11`) ve `Kalkancı −42` etiketi aynı askeri gösterdi. Etiketin görünür anına ait ekran görüntüsü bu kontrolde yakalanmadı; sunucu olayı ile DOM hedef kimliği karşılaştırıldı.
- 401 karakterli yakın görüş senaryosunda kamera önündeki 3 asker soldu; 398 gövde ve hero görünür kaldı. Kamera yatay uzaklığı 8,28 m, tüm konumlar sonluydu; WebGL/JavaScript hatası görülmedi. Canlı askerin uzak hedefe ışınlanmasını engelleyen son test eklendikten sonra tüm Go testleri (112,5 saniye), vet, üretim derlemesi ve dört istemci ağ testi tekrar geçti.

## Tekrarlama ve sınırlar

`start-crowd.cmd` → `http://localhost:8789`. Kaynak kurulumunda frontend ve Go sunucusunu birlikte derle. `/crowd-lab.html` çevrimiçi maç açmadan render ölçümü ve yakın görüş denemesi sunar; bir fizik simülasyonu değildir. `go test -run '^$' -bench 'BenchmarkFourPlayerTick|BenchmarkCrowd400' -benchmem -benchtime=2s -count=3` sunucu maliyetini ölçer.

Emir, otomatik birlik savaşı ve toplam can hâlâ birlik düzeyindedir. Bu değişiklik tam rigid-body, ragdoll, asker başına can, kılıç kemiği hitbox, istemci tahmini veya rollback eklemez. Çok yoğun temasta daire ayrıştırma yaklaşımı küçük geçici örtüşmelere izin verebilir; silah/pelerin geometrisi fizik gövdesi değildir. Dört ayrı cihazla WAN testi ve uzun süreli yüksek kapasite testi yapılmadı. Önceki CI yetkisi ve Windows race derleyicisi engelleri geçerlidir; yerel test başarısı CI/race sonucu değildir.
