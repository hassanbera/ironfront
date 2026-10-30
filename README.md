# IRONFRONT — Dört Sancak

Ekonomisiz, dört oyunculu, 3D RTS / üçüncü şahıs savaş oyununun ilk oynanabilir sürümü. Frontend **TypeScript + Three.js**, sunucu **Go + WebSocket**. Harici oyun servisi veya veritabanı gerektirmez.

## Hemen oyna — Windows

Güncel hazır pakette `start-performance.cmd` dosyasına çift tıkla. Oyun `http://localhost:8792` adresinde açılır. Konsol açık kaldığı sürece sunucu çalışır; kapatmak maçı sonlandırır. Önceki savaş paketi `start-combat.cmd` ile 8790, ilk paket `start-game.cmd` ile 8787 portundadır.

GitHub reposu kaynak kod içerir; `.exe`, `node_modules` ve derlenmiş frontend dizinleri repoya eklenmez. Repoyu klonladıysan aşağıdaki kaynaktan çalıştırma adımlarını kullan. Önceki hazır Windows ZIP paketi bu güncellemeyi içermez; henüz GitHub Release yayımlanmadı.

- **Meydana çık:** 3 botla antrenman.
- **Birlik Talimi:** ayrı sekmede kılıç, mızrak, yay ve baltaları yakından incele; koşu, saldırı, blok, darbe, kaçınma ve düşme hareketlerini seç. 400 asker görünümü de vardır.
- **Oda oluştur:** oda kodunu arkadaşlarına gönder; her biri farklı faction seçip aynı sunucuda **Odaya katıl** üzerinden girer.
- Oda sahibi boş slotları botlarla doldurabilir veya 2–4 gerçek oyuncuyla başlayabilir.
- Aynı bilgisayarda ayrı tarayıcı sekmeleriyle dört oyuncu denenebilir. Aynı ağdaki arkadaşlar, sunucuyu çalıştıran bilgisayarın yerel IP adresi ve seçilen paketin portunu kullanır (`start-performance.cmd`: `8792`). İşletim sisteminin mevcut ağ izinleri geçerlidir; paket güvenlik duvarını değiştirmez.

Oyun klavye ve fare içindir. Dar ekran menüsü uyarlanır, dokunmatik savaş kontrolü yoktur.

### FPS ve çizim paketi

`start-performance.cmd` → **http://localhost:8792**. Kamera dışı asker çizimi, uzak binek geometrisi, dinamik renk tamponları, dünya etiketleri ve hero HUD güncellemeleri iyileştirildi. Yakındaki karakterler ve savaş kuralları korunur. Intel UHD'de son kontrollü tekrarın ortalama FPS değerleri: hero 400 asker 55,9→73,4; hero 800 asker 41,7→51,1; RTS 800 asker 47,8→55,9. Ağır hero sahnesinde kare p95 hâlâ yaklaşık 33 ms; sabit 60 FPS garantisi değildir. [Bütün örnekler, testler ve sınırlar](docs/RENDER_VALIDATION.md).

Kaynak koddan bu ayrı yerel paketi hazırlamak için:

```sh
cd frontend
npm ci
npm run build -- --outDir dist-performance
cd ../server
go build -o ../ironfront-server-performance.exe .
```

Ardından proje kökündeki `start-performance.cmd` çalıştırılır. Eski 8790 paketi karşılaştırma için korunur.

### Temas ve saldırı zamanlaması paketi

`start-combat.cmd` → **http://localhost:8790**. Saldıran ve vurulan asker gerçek konumundan seçilir; hazırlık, temas, ok uçuşu ve toparlanma sunucu zamanına bağlıdır. Çember savunmaları, hero zırh hesabı ve bot dizilim maliyetleri tutarlıdır. [Testler, önce/sonra performans ölçümleri ve sınırlar](docs/COMBAT_VALIDATION.md).

GitHub kaynağından bu başlatıcı için:

```sh
cd frontend
npm ci
npm run build -- --outDir dist-combat
cd ../server
go build -o ../ironfront-server-combat.exe .
```

Ardından proje kökündeki `start-combat.cmd` çalıştırılır. `dist-combat`, önceki paketin `dist` çıktısından ayrıdır.

### Önceki kalabalık ve hero çarpışma sürümü

Önceki yerel sürüm `start-crowd.cmd` ile **http://localhost:8789** adresinde açılır. Repodan hazırlarken `npm run build`, ardından `server/` içinden `go build -o ../ironfront-server-crowd.exe .` çalıştır. İstemci ile Go sunucusu birlikte güncel olmalıdır. [Kalabalık, kamera ve performans doğrulaması](docs/CROWD_VALIDATION.md).

### Önceki hero sürümü

Yerel teslimde `start-hero.cmd`, yeni sunucuyu `http://localhost:8788` adresinde çalıştırır. Bu ayrı port, 8787'de açık kalan eski maçları korumak içindir. Repodan hazırlamak için frontend'i derle, ardından `server/` içinden `go build -o ../ironfront-server-hero.exe .` çalıştır. Normal kaynak kurulumu ve dağıtımda varsayılan 8787 kullanılabilir; yeni hero davranışları için sunucu ve istemci birlikte güncel olmalıdır. [Hero kontrol ve temas değişiklikleri](docs/HERO_FEEL.md).

## Kaynaktan çalıştır

Node.js 22.12+ ve Go 1.23+ gerekir. Bu paket Go 1.27.3 ile doğrulandı.

```sh
cd frontend
npm ci
npm run dev
```

Ayrı terminalde:

```sh
cd server
go run .
```

Geliştirme arayüzü: `http://localhost:5173`. Vite, `/ws` bağlantılarını `127.0.0.1:8787` adresindeki Go sunucusuna iletir.

Tek sunucu üzerinden üretim derlemesi:

```sh
cd frontend
npm ci
npm run build
cd ../server
go build -o ../ironfront-server.exe .
go run .
```

`server/` dizininden çalıştırıldığında Go, `../frontend/dist` içeriğini de sunar. Binary başka dizinden çalıştırılacaksa `STATIC_DIR` tanımla. Linux/macOS için `go build -o ../ironfront-server .` kullan.

## Kurallar

- Her faction başlangıçta **4 birlik × 25 asker = 100** asker alır. Birlik sınıfları tekrar seçilebilir; toplam slot sınırına tabidir.
- Dört faction: **Knights, Vikings, Arabs, Turks**. Her birinde 4 sınıf ve 3 özel dizilim bulunur.
- Haritalar: **Sınır Vadisi, Kızıl Geçit, Kuzey Surları**. Orman, tepe, kum, dar geçit ve bataklık hareketi veya savaşı değiştirir.
- Tarım, kaynak, altın, bina inşası veya ekonomik yükseltme yoktur.
- **Outpost:** çekişmesiz bölgede 9 saniye → +25 kapasite.
- **Düşman üssü:** önce 6000 canını tüket; ardından 14 saniye bölgede kalıp faaliyete geçir.
- En az bir faal üs varsa: `100 + 50 × (faal üs sayısı − 1) + 25 × outpost sayısı`.
- Ana üs düştüğünde eldeki başka faal üs ana üs olur. Örneğin Knights, Turks üssünü alırsa 150; sonra kendi üssünü Vikings'e kaybederse Turks'ten aldığı üs ana üs olur ve kapasitesi 100 kalır.
- Üs yoksa yalnızca outpost kapasitesi görünür; **hiçbir takviye veya yeni birlik doğmaz**. Hayattaki birlikler/hero üs geri alabilir.
- Kapasite düşünce mevcut askerler silinmez. Birlikler oluşturulma sırasıyla kapasiteyi kullanır; kapasite dışındaki birliklerin doğması ve yenilenmesi bekletilir.
- Her sınıfın farklı bekleme süresi vardır. Kayıplar, süreleri dolduktan sonra dost üsse 28 birim mesafede ve 3 saniye çatışma dışında yenilenir. Tamamen düşen birlik faal ana üste yeniden doğar.
- Ön/yan/arka yön hesabı, zırh, sınıf karşılıkları ve dizilim çarpanları sunucudadır. Yandan/arkadan darbe alan birlik, sınıfa özgü **fark etme süresi** boyunca dönememeye başlar. Aynı saldırgan bu süreyi sürekli sıfırlayamaz.
- Kahramanda 3 sınıf: **Muhafız, Düellocu, Akıncı**. Faction rengi/kimliği korunur. Kahraman 20 saniyede ana üste döner.
- Son kalan faction kazanır. 20 dakikada bitmezse `kapasite × 4 + düşürülen asker` puanı kazanır; eşitlik beraberliktir.

## Kontroller

| RTS | İşlem |
|---|---|
| Sol tık / kutu sürükleme | Birlik seç |
| Shift + seçim | Seçime ekle |
| Sağ tık | Yürü / hedef düşmana saldır |
| F, ardından sol tık | Saldırarak ilerle |
| WASD / yön tuşları | Kamera |
| Q / E | Kamerayı döndür |
| Fare tekerleği | Yakınlaş / uzaklaş |
| 1–9 | Birlik veya kayıtlı kontrol grubu |
| Ctrl + 1–9 | Kontrol grubu kaydet |
| Ctrl + A | Tüm birlikleri seç |
| Z / X / C | Faction dizilimleri |
| H / R | Mevziyi koru / ana üsse dön |
| Minimap sol / sağ tık | Kamerayı taşı / saldırarak ilerle |
| Tab | Kahramana / RTS'ye geç |

Kahraman: **WASD / ok tuşları** kameraya göre hareket, **orta fare tuşu basılı + sürükle** kamera ve karakter dönüşü, **sol tık** saldırı, **sağ tık** önden blok, **Space** zıplama, **Shift + yön** o yöne kaçınma, yalnız **Shift** geri kaçınma, **Q** sınıf yeteneği. Arka arkaya tıklamalar kılıç savurma, çapraz kesiş ve saplama sırasını kullanır; 1,2 saniye ara verince sıra sıfırlanır. Hazırlık sırasında blok/kaçınma saldırıyı iptal eder. İsabet ve blok yazısı yalnızca sunucu teması doğruladığında çıkar. Ses düğmesi adım, savuruş, temas ve kalkan seslerini açar.

Esc orta tuş sürüklemesini bırakır; dönmek için orta tuşa yeniden basılı tut. Kahraman kontrolündeyken birlikler emirlerini sürdürür.

## Yapı ve performans

- **Sunucu otoriter:** konum, hasar, cooldown, seçim sahipliği, kapasite ve zafer istemci tarafından belirlenemez.
- **20 Hz** sabit simülasyon, **10 Hz** durum yayını. Her oda en fazla dört oyuncu.
- Emirler ve toplam can 25 kişilik birlik düzeyindedir. Her canlı asker ayrıca sabit kimlikli, hafif bir çarpışma dairesine sahiptir; 3 m komşuluk ızgarası askerleri ve hero'yu ayırır. Bineklerin gövdesi ve dizilim aralığı daha geniştir. Tam rigid-body fizik veya asker başına ayrı can sistemi yoktur.
- Hero teması gerçek asker konumundan seçilir. Vurulan asker parlar, darbe tepkisi verir ve üzerinde hasar etiketi görünür; ölümcül vuruş aynı askeri düşürür. Kameranın önünü kapatan asker/binekler soluklaşır, kamerayı çevreleyen gövdeler gizlenir. Hero tam görünür kalır.
- Birlik saldırıları da gerçek asker temasından seçilir. Hasar hazırlık sonrası, oklarda ise uçuş sonunda uygulanır. Oklar tek instanced çizimde gösterilir; yaylım başına üç temsili görsel, sunucuda tüm katılımcı askerlerin ayrı hasar hesabı vardır.
- Grid A* ve yol sadeleştirme kayaları/üsleri dolaşır. Ağaç kümeleri örtü ve yavaşlatma bölgeleridir; her ağaç ayrı çarpışma nesnesi değildir.
- Konumlar istemcide yumuşatılır. Girdi tahmini / rollback uygulanmadı; gecikme göstergesi gerçek ping ölçer.
- Bağlantı başına 4 KB mesaj sınırı, komut hız sınırı, oda limiti, origin denetimi, yavaş istemcide eski snapshot düşürme ve boş odaların 2 dakika sonra temizlenmesi vardır.
- Oturum anahtarıyla kısa bağlantı kesilmesinden otomatik dönüş vardır. Sayfa yenileme/kapama sonrası kalıcı oturum yoktur. Bilerek ayrılan oyuncunun ordusu botlara geçer.
- Kalıcı hesap, eşleştirme, maç geçmişi veya kayıt yoktur. Bu yüzden PostgreSQL eklenmedi. Sunucu kapanırsa odalar kaybolur.
- Gölgesiz performans modu Ayarlar içindedir. CC0 çevre modelleri ve yaklaşık 5,8 MB animasyonlu karakter verisi yerel olarak sunulur.
- KayKit tabanlı üç gövde modeli, kapüşon dahil faction kumaş renkleri ve sınıfa uygun silahlarla kullanılır. 33 hareket/poz klibi GPU üzerinde instancing ile oynatılır; her asker için ayrı CPU iskeleti güncellenmez. Üç geometri detay seviyesi kamera uzaklığına göre seçilir.
- Hareketler sunucunun saldırı, hasar, kayıp ve hero durumundan tetiklenir. Geçişler yumuşatılır; yay kirişi gerilir, kalkan kalkar, ölen asker kısa süre yerde kalır. At/deve gövdeleri ve yürüyüşleri prosedüreldir. Karakterler stilizedir; fizik tabanlı ragdoll veya her faction için ayrı tarihsel model seti yoktur.

Kural değerlerinin tek kaynağı: `server/rules.json`; Go bunu embed eder, Vite aynı dosyayı bundle'a alır. Denge değişikliklerinden sonra **iki tarafı da yeniden derle**. İlk değerler tarafların güçlü/zayıf yönlerini yaratır; rekabetçi denge ve meta garantisi değildir.

## Doğrulama

```sh
cd server
go test ./...
go vet ./...
go test -run '^$' -bench BenchmarkFourPlayerTick -benchmem
```

Sunucu açıkken, proje kökünden:

```sh
node scripts/network-test.mjs
node scripts/validate-character-assets.mjs
node --experimental-strip-types scripts/hero-controls-test.mjs
node --experimental-strip-types scripts/hero-track-test.mjs
node --experimental-strip-types scripts/crowd-visibility-test.mjs
```

Ağ testi dört gerçek WebSocket bağlantısı açar: beşinci oyuncu reddi, oda sahibinin başlatması, 400 asker, emir sahipliği, hareket/dizilim/hero senkronizasyonu ve doğru/yanlış token ile yeniden bağlantıyı kontrol eder. Go testleri ana üs devri, ele geçirme, cooldown, kapasite, flank, fark etme, hero blok/kaçınma, tüm haritalarda yol bulma ve üç tam bot maçını kapsar.

Karakter kontrolü klip sürelerini, sonlu poz matrislerini, kemik ağırlıklarını, indeksleri ve detay seviyelerini doğrular; sunucu gerektirmez. İlk görsel geçiş: [VISUAL_UPGRADE.md](docs/VISUAL_UPGRADE.md). Güncel çarpışma/kamera testleri, ölçüm koşulları ve tekrar edilebilir `/crowd-lab.html` sayfası: [CROWD_VALIDATION.md](docs/CROWD_VALIDATION.md).

Kamera takibi ve orta fare tuşu değişikliğinin ölçümü: [CAMERA_CONTROLS.md](docs/CAMERA_CONTROLS.md).

## Vercel'e hazırlık

Henüz internete yayınlanmadı. `vercel.json` frontend için hazırdır. Kalıcı Go oyun süreci ayrı bir container/VPS servisinde çalışır; frontend `VITE_SERVER_URL=https://oyun-sunucusu.example` üzerinden bağlanır. Ayrıntılar: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Lisanslar

Çevre modelleri: Kenney Castle Kit / Nature Kit, **CC0**. Karakterler ve kaynak animasyonlar: KayKit Character Pack Adventurers, **CC0**. Kaynaklar, özgün lisanslar ve envanter `frontend/public/assets/` altında. Three.js ve geliştirme aracı meshoptimizer MIT, coder/websocket ISC. Barlow yazı tipi SIL Open Font License ile dağıtılır. [THIRD_PARTY.md](THIRD_PARTY.md) dosyasına bak.

## Geliştirme takibi

[Yol haritası](docs/ROADMAP.md) tamamlanan ve planlanan işleri, [CONTRIBUTING.md](CONTRIBUTING.md) küçük ve doğrulanmış commit düzenini açıklar. [Tasarım raporu](docs/IRONFRONT-Tasarim-Raporu.docx), seçilen Design Report şablonuyla hazırlanan ilk sürüm kaydıdır; sonraki görsel geliştirmeler bu README ve doğrulama belgelerinde izlenir. CI taslağı `docs/ci.yml.template` içindedir; mevcut GitHub oturumunun `workflow` yetkisi eksik olduğundan henüz etkin değildir.
