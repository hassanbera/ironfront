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

## Sıradaki işler

| Sıra | Planlanan parça | Bitirme ölçütü | Önerilen commit kapsamı |
|---|---|---|---|
| 1 | CI etkinleştirme | Workflow yetkisi sağlanır; frontend build, Go race/vet ve dört istemci testi Linux'ta geçer | `ci: enable verified multiplayer checks` |
| 2 | Dört insanla bağlantı denemesi | Ayrı cihazlarda oda, dolu oda reddi, kopma, tekrar bağlanma ve maç sonu gözlemlenir; RTT ve hata kaydı tutulur | `test(net)` ve bulunan hatalara ayrı `fix(net)` |
| 3 | Performans ölçümü | 400 asker ve ele geçirme sonrası daha yüksek kapasitede kare süresi, tick süresi ve ağ trafiği ölçülür; donanım kaydedilir | `perf(render)` veya `perf(server)`; önce/sonra ölçümü |
| 4 | Denge denemeleri | Faction/harita/dizilim eşleşmeleri ve önden/yan/arka saldırılar tekrarlanır; katsayı değişikliği kanıtıyla açıklanır | `balance(rules)` ve ilgili kural testleri |
| 5 | Hero ve görsel iyileştirme | Pointer lock, kamera ve girişler masaüstü tarayıcılarda doğrulanır; animasyon/geri bildirim kullanıcı testiyle değerlendirilir | `fix(hero)` veya `feat(client)` |
| 6 | İnternete dağıtım | Kalıcı Go servisi HTTPS/WSS ile açılır; Vercel frontend bağlanır; dört ayrı cihazın aynı maçı oynadığı doğrulanır | `deploy` ayarları ve doğrulama kaydı |

Bunlar henüz tamamlanmış özellikler değildir. Her parça ayrı uygulanır, doğrulanır ve commit edilir; sırf planı göstermek için boş commit atılmaz.

## Bilinen sınırlar ve kapsam

- Hasar ve hareket simülasyonu birlik seviyesindedir. Ekrandaki askerler bağımsız 400 fizik nesnesi değildir.
- İnternet gecikmesinde tahmin/rollback, kalıcı oturum, matchmaking, hesap ve maç geçmişi yoktur.
- PostgreSQL ancak hesap/geçmiş gibi kalıcılık ihtiyacı doğarsa değerlendirilir. Mevcut oyun için gerekmez.
- Kaynak/altın/tarım ve ekonomik ilerleme eklemek kapsam dışıdır.
- Docker ve Vercel dosyalarının bulunması canlı dağıtımın yapıldığı anlamına gelmez.
- Ayrıntılı kanıt ve sınırlar: [VALIDATION.md](VALIDATION.md). Çalıştırma: [README](../README.md). Commit düzeni: [CONTRIBUTING](../CONTRIBUTING.md).
