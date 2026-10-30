# Temas, saldırı zamanlaması ve dizilim doğrulaması

30 Ekim 2026. Yerel paket `start-combat.cmd` ile **http://localhost:8790** adresinde açılır. Kaynak kodu derleme adımları [README](../README.md) içindedir. Yeni istemci ve Go sunucusu birlikte kullanılmalıdır.

## Değişen davranış

- Birlik merkezleri yerine gerçek asker gövdeleri kullanılır. Menzil, ön açı ve engel kontrolünü geçen asker saldırır; arkada erişemeyen asker hasar üretmez veya saldırı animasyonu oynamaz. Hedef asker kimliği isabet işaretine ve kayıp animasyonuna taşınır. Yakın dövüş ilerlemesi gerçek temasta durur.
- Saldırı hazırlık, temas/bırakma ve toparlanma evrelerine ayrıldı. Hazırlık sırasında hasar verilmez. Yakın dövüşte temas anında menzil, açı, engel ve hedefin hâlâ hayatta olması tekrar kontrol edilir. Saldırganın ölmesi veya yürüme/geri çekilme emri hazırlığı iptal eder; hareketli atlı okçu istisnası korunur.
- Birliklerin ve Akıncı hero'nun atışları mesafeye göre uçar. Hasar varışta çözülür; o andaki hero blok/kaçınması ve engeller geçerlidir. Fırlatılmış ok, atıcısı öldüğünde kaybolmaz. Atıcının dizilim ve hareket bonusu atış anında sabitlenir; hedef savunması isabette hesaplanır.
- Aynı tick'e düşen birlik temasları birlikte seçilir. Saldırı klibi bitmeden yenisi başlamaz. 20 Hz isabetler, 10 Hz durum yayınına kadar biriktirilir; iki tick'te vurulan farklı askerlerin işaretleri korunur.
- Viking ve Arab çemberleri tüm yönlerde sırasıyla %18 ve %14 hasar azaltır; zırh ayrıca uygulanır. Hero da aynı savunma hesabını kullanır. Botların dizilim değiştirmesi, oyuncudaki 1,4 saniyelik yeniden dizilme maliyetine tabidir. Açıklamalar gerçek saldırı/yan/arka çarpanlarıyla eşleştirildi.

| Birlik saldırısı | Klip süresi | Nominal temas/bırakma | Yeniden saldırı |
|---|---:|---:|---:|
| Yakın dövüş | 0,82 sn | 0,369 sn | 0,9 sn |
| Menzilli | 1,05 sn | 0,63 sn + mesafeye bağlı uçuş | 1,2 sn |

Sunucu olayları sonraki 50 ms simülasyon adımında çözer. Hero mevcut sınıf sürelerini korur; Akıncı'nın 0,72 sn klibinde ok %42 aşamasında bırakılır. Ok hızı 35 oyun birimi/sn, minimum uçuş 0,08 sn. Katılan her asker için hasar, sınıfın saniyelik hasarı × saldırı aralığıdır; arkadaki erişemeyen askerlerin eski merkez tabanlı hasarı kaldırılmıştır. Bu nedenle cephe genişliği artık çatışma sonucunu daha fazla etkiler.

## Geçen kontroller

- `go test ./...` ve `go vet ./...`: temas, engel, üs yüzeyi, hero blok/kaçınma, gerçek hedef, hazırlık iptali, tek isabet, toparlanma, uçuş, atıcı ölümü, dizilim bonusunun atışta sabitlenmesi, snapshot'ta isabet biriktirme, ızgara sınırları ve boşalan hücreler. Mevcut kapasite, ana üs devri, takviye, notice time ve üç tam bot maçı da geçti.
- 12 dizilimin ön/yan/arka savunması, hero'nun çember/zırh hesabı ve botun yeniden dizilme maliyeti geçti.
- TypeScript kontrolü ve Vite üretim derlemesi geçti. Saldırı klibi/katılımcı maskesi, hero yön kontrolü, kamera takibi ve kalabalık görünürlüğü kontrolleri geçti.
- Dört gerçek WebSocket istemcisinde 400 asker, dolu oda reddi, host yetkisi, emir sahipliği, hareket/dizilim/hero senkronizasyonu ve token ile yeniden bağlantı geçti.
- İki hero istemcisiyle hazırlık/uçuş sırasında hasar olmaması, varışta doğru hedef kimliği ve varış anındaki dodge doğrulandı. Örnek uçuş: 0,54485 sn.
- Gerçek Chromium'da ön sıranın saldırıp erişemeyen arka sıranın beklemesi, doğru askerin isabet tepkisi, klibin %90 aşamasına ulaşması, ok bırakma/varış ve tekrarlanan snapshot'ın oku çoğaltmaması doğrulandı. 96 ok, **1 ek çizim çağrısı ve 0 ek geometri** kullandı.

CI hâlâ etkin değildir; bu sonuçlar yerel çalıştırmadır. Windows race testi ve dört ayrı cihazla internet maçı bu pakette doğrulanmadı.

## Sunucu performansı

Windows, Intel i7-10750H; Go 1.27.3. Paket öncesi `28a234a` ile yeni sürüme aynı `BenchmarkPopulatedBattle` uygulandı. Üç dönüşümlü eski/yeni çift, her örnekte sabit 2000 tick; kayıplar her tick'ten önce tamamlandı. Böylece daha hızlı asker ölümü ölçümü yapay biçimde iyileştirmedi. Ölçüm sırasında derleme ve kendi test tarayıcımızın çizimi durduruldu; kullanıcının açık sunucuları korunmuştur.

| Asker | Önce: üç örnek (ms/tick) | Sonra: üç örnek (ms/tick) | Medyan değişim |
|---|---|---|---|
| 400 | 0,476 / 0,540 / 0,516 | 0,492 / 0,491 / 0,534 | 0,516 → 0,492; −%4,7 |
| 800 | 1,030 / 1,086 / 1,171 | 1,143 / 1,146 / 1,213 | 1,086 → 1,146; +0,060 ms (+%5,5) |

800 askerlik medyan tick, 50 ms sunucu bütçesinin yaklaşık %2,3'üdür. Daha doğru temasın maliyeti bütçe içinde kaldı; her yükte hızlanma iddiası yoktur. Test simülasyonu kapsar, JSON/ağ gönderimini kapsamaz. Temas sorgusu ayrıca sıfır allocation ile doğrulandı; bütün maçın hiçbir zaman allocation üretmediği iddia edilmez.

Maliyeti sınırlayan değişiklikler: mevcut komşuluk ızgarasını kullanma, yalnız dolu hücreleri temizleme, dost hücreleri temas aramasında atlama, hedef yokken 0,25 sn sorgu aralığı, tekrar kullanılan temas/uçuş tamponları. Çarpışma çözüm adımları veya simülasyon frekansı azaltılmadı.

## Tarayıcı ölçümü

1440 × 900 Chromium, ANGLE / Intel UHD Graphics / Direct3D11; yüksek kalite, 400 asker, aynı hero kamerası ve `crowd-lab.html` sahnesi. Her sayfada asset yüklemesinden sonra 5 sn ısınma, 10 sn normal sahne ve 10 sn boyunca 750 ms'de bir 16 birliğe temsili yaylım uygulandı. Önceki renderer 8791, yeni renderer 8794 portunda üç kez dönüşümlü ölçüldü. Bu, sabit yerel render yüküdür; dört cihazlı gerçek maç FPS garantisi değildir.

| Durum | Önce FPS (üç örnek) | Sonra FPS (üç örnek) | Medyan çizim çağrısı |
|---|---|---|---|
| Normal sahne | 41,7 / 43,7 / 53,6 | 52,1 / 45,7 / 46,0 | 38 → 38 |
| Yaylım | 52,5 / 50,3 / 46,0 | 34,8 / 39,8 / 52,8 | 65–71 → 39 |

Yaylım sırasında p95 kare süresi önce 33,2 / 33,2 / 41,6 ms, sonra 66,6 / 58,3 / 25,1 ms çıktı. Örnekler belirgin dalgalandığından bu tablo tek başına FPS'nin korunduğunu veya yükseldiğini kanıtlamaz. Tek instanced ok grubu, çizim çağrısını ve ok başına geometri/material oluşturmayı ortadan kaldırır; aşağıdaki profil ölçümü ayrıca değerlendirilmiştir.

`scripts/combat-render-profile.js` ile aynı yeni sayfada dört ardışık 10 sn bölüm ölçüldü:

| Bölüm | FPS | `renderer.render` medyan / p95 | Ok güncelleme p95 |
|---|---:|---:|---:|
| Ok yok | 59,4 | 1,6 / 2,4 ms | 0 ms |
| Oklar görünür | 56,4 | 1,6 / 2,5 ms | 0,1 ms |
| Oklar hesaplanıyor, çizilmiyor | 49,7 | 1,8 / 3,1 ms | 0,1 ms |
| Oklar tekrar görünür | 47,2 | 1,9 / 3,2 ms | 0,2 ms |

Eski renderer'ın ayrı profilinde normal sahne 37,8 FPS / 2,2 ms çizim medyanı; yaylım 45,8 FPS / 2,1 ms çıktı. Oklar gizliyken de FPS'nin düşmesi ve eski sahnenin yaylımla hızlanması, ortamın sabit olmadığını gösteriyor. Bu ölçümler belirgin ok güncelleme maliyeti göstermedi, fakat FPS regresyonunu kesin dışlamak için yeterli değil. `renderer.render` süreleri JavaScript çağrı süresidir; ayrı GPU zaman sorgusu değildir. Kullanıcının diğer oyun pencereleri kapatılmadı. Daha kontrollü, yalnız oyun açıkken yapılacak ölçüm hâlâ gereklidir; burada 60 FPS veya tüm cihazlarda performans garantisi verilmez.

## Tekrar çalıştırma

```sh
cd server
go test ./...
go vet ./...
go test -run '^$' -bench BenchmarkPopulatedBattle -benchtime=2000x -count=3 -benchmem
cd ../frontend
npm run build
cd ..
node --experimental-strip-types scripts/attack-motion-test.mjs
node --experimental-strip-types scripts/hero-controls-test.mjs
node --experimental-strip-types scripts/hero-track-test.mjs
node --experimental-strip-types scripts/crowd-visibility-test.mjs
```

Windows PowerShell'de çalışan yeni sunucuya karşı:

```powershell
$env:TEST_WS_URL='ws://127.0.0.1:8790/ws'
node scripts/network-test.mjs
node scripts/combat-network-test.mjs
```

Playwright CLI'da `/crowd-lab.html` açıldıktan sonra `run-code --filename=scripts/contact-browser.js`, `scripts/attack-timing-browser.js`, `scripts/combat-perf-browser.js` ve `scripts/combat-render-profile.js` ayrı, yeniden açılmış sayfalarda çalıştırılır. Tarayıcı testleri yalnız bu yerel tanılama sayfasındaki `crowdLab` nesnesini kullanır. Profil betiği yeni renderer'da sırasıyla normal, görünür oklar, gizli oklar ve tekrar görünür okları ölçer; eski renderer'da ilk iki bölümü ölçer. Tarayıcı otomasyonu için Playwright CLI ayrıca kurulu/erişilebilir olmalıdır.

## Kapsam sınırı

Askerler ayrı hafif çarpışma gövdelerine sahip, toplam can ve emirler hâlâ birlik düzeyindedir. Kılıç kemiği hitbox'ı, ragdoll veya tam balistik fizik eklenmedi. Oklar seçilen hedefi izleyen, varış zamanı sunucuda hesaplanan atışlardır; her birliğin yaylımında en fazla üç temsili ok çizilir, tüm katılımcıların hasarı sunucuda çözülür. Üssün otomatik garnizon savunması ayrı alan kuralını korur. Gecikme tahmini/rollback ve kapsamlı faction denge çalışması bu paketin parçası değildir.
