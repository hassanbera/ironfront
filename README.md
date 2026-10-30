# IRONFRONT — Dört Sancak

Ekonomisiz, dört oyunculu, 3D RTS / üçüncü şahıs savaş oyununun ilk oynanabilir sürümü. Frontend **TypeScript + Three.js**, sunucu **Go + WebSocket**. Harici oyun servisi veya veritabanı gerektirmez.

## Hemen oyna — Windows

Hazır pakette `start-game.cmd` dosyasına çift tıkla. Oyun `http://localhost:8787` adresinde açılır. Konsol açık kaldığı sürece sunucu çalışır; kapatmak maçı sonlandırır.

GitHub reposu kaynak kod içerir; `.exe`, `node_modules` ve `frontend/dist` repoya eklenmez. Repoyu klonladıysan aşağıdaki kaynaktan çalıştırma adımlarını kullan. Hazır Windows ZIP paketi ayrı bir yerel teslimdir; henüz GitHub Release yayımlanmadı.

- **Meydana çık:** 3 botla antrenman.
- **Oda oluştur:** oda kodunu arkadaşlarına gönder; her biri farklı faction seçip aynı sunucuda **Odaya katıl** üzerinden girer.
- Oda sahibi boş slotları botlarla doldurabilir veya 2–4 gerçek oyuncuyla başlayabilir.
- Aynı bilgisayarda ayrı tarayıcı sekmeleriyle dört oyuncu denenebilir. Aynı ağdaki arkadaşlar, sunucuyu çalıştıran bilgisayarın yerel IP adresi ve `8787` portunu kullanır. İşletim sisteminin mevcut ağ izinleri geçerlidir; paket güvenlik duvarını değiştirmez.

Oyun klavye ve fare içindir. Dar ekran menüsü uyarlanır, dokunmatik savaş kontrolü yoktur.

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

Kahraman: **WASD** hareket, **fare** bakış, **sol tık** saldırı, **sağ tık** önden blok, **Space** zıplama, **Shift** kaçınma, **Q** sınıf yeteneği. Esc fare kilidini bırakır; yeniden tıklamak yakalar. Fare kilidi desteklenmiyorsa sol tuşla sürüklemek bakış yönünü değiştirir. Kahraman kontrolündeyken birlikler emirlerini sürdürür.

## Yapı ve performans

- **Sunucu otoriter:** konum, hasar, cooldown, seçim sahipliği, kapasite ve zafer istemci tarafından belirlenemez.
- **20 Hz** sabit simülasyon, **10 Hz** durum yayını. Her oda en fazla dört oyuncu.
- Sunucu tek tek asker yerine 25 kişilik birlikleri simüle eder. Görsel askerler, kayıplar ve animasyonlar istemcide `InstancedMesh` ile çizilir. Bu ilk sürüm bağımsız 400 asker fiziği / çarpışması içermez.
- Grid A* ve yol sadeleştirme kayaları/üsleri dolaşır. Ağaç kümeleri örtü ve yavaşlatma bölgeleridir; her ağaç ayrı çarpışma nesnesi değildir.
- Konumlar istemcide yumuşatılır. Girdi tahmini / rollback uygulanmadı; gecikme göstergesi gerçek ping ölçer.
- Bağlantı başına 4 KB mesaj sınırı, komut hız sınırı, oda limiti, origin denetimi, yavaş istemcide eski snapshot düşürme ve boş odaların 2 dakika sonra temizlenmesi vardır.
- Oturum anahtarıyla kısa bağlantı kesilmesinden otomatik dönüş vardır. Sayfa yenileme/kapama sonrası kalıcı oturum yoktur. Bilerek ayrılan oyuncunun ordusu botlara geçer.
- Kalıcı hesap, eşleştirme, maç geçmişi veya kayıt yoktur. Bu yüzden PostgreSQL eklenmedi. Sunucu kapanırsa odalar kaybolur.
- Gölgesiz performans modu Ayarlar içindedir. Yaklaşık 315 KB CC0 çevre modelleri yerel olarak sunulur. Birlik modelleri prosedüreldir.

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
```

Ağ testi dört gerçek WebSocket bağlantısı açar: beşinci oyuncu reddi, oda sahibinin başlatması, 400 asker, emir sahipliği, hareket/dizilim/hero senkronizasyonu ve doğru/yanlış token ile yeniden bağlantıyı kontrol eder. Go testleri ana üs devri, ele geçirme, cooldown, kapasite, flank, fark etme, hero blok/kaçınma, tüm haritalarda yol bulma ve üç tam bot maçını kapsar.

## Vercel'e hazırlık

Henüz internete yayınlanmadı. `vercel.json` frontend için hazırdır. Kalıcı Go oyun süreci ayrı bir container/VPS servisinde çalışır; frontend `VITE_SERVER_URL=https://oyun-sunucusu.example` üzerinden bağlanır. Ayrıntılar: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Lisanslar

Çevre modelleri: Kenney Castle Kit / Nature Kit, **CC0**. Kaynaklar, özgün lisanslar ve envanter `frontend/public/assets/` altında. Three.js MIT, coder/websocket ISC. Barlow yazı tipi SIL Open Font License ile dağıtılır. [THIRD_PARTY.md](THIRD_PARTY.md) dosyasına bak.
