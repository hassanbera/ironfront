# Dağıtım

30 Ekim 2026: Vercel frontend ve Render Frankfurt Go servisi canlıya alındı. Ücretli Render planı seçilmedi; ücretsiz tek instance kullanılıyor.

| Kaynak | Adres / kimlik |
|---|---|
| Oyuncu giriş adresi | [ironfront-ebon.vercel.app](https://ironfront-ebon.vercel.app) |
| Go servisi / alternatif giriş | [ironfront-game.onrender.com](https://ironfront-game.onrender.com) |
| Sağlık kontrolü | [/health](https://ironfront-game.onrender.com/health) |
| Canlı kaynak commit'i | `28bb6788a094bbcb523fc1c76231fa14a24de5b4` |
| Render servisi | `srv-dbiebcon74is739dncq0` |
| Render canlı deploy | `dep-dbiee8mc6qcc73a9bu9g` |
| Vercel canlı deploy | `dpl_52NPSDkCG6CMKNq9zSzGnNw629rj` |

Vercel üretim ortamında `VITE_SERVER_URL=https://ironfront-game.onrender.com`; Render'da `ALLOWED_ORIGINS=ironfront-ebon.vercel.app`. Vercel oturumu gerekmiyor. Private GitHub kaynak deposu private kaldı. Vercel'in benzersiz deploy/preview URL'leri origin listesinde yoktur; oyun için yukarıdaki sabit üretim adresini kullan.

## Geçen canlı kontroller

- Ana oyun, `drill.html`, `crowd-lab.html`: HTTPS 200 ve doğru ayrı sayfa başlıkları. Assetler yüklendi; tarayıcı konsolunda hata/uyarı yok.
- Render `/health`: `ok:true`, `tickRate:20`; son deploy durumu `live`, Vercel durumu `READY`.
- `network-test.mjs`: internet üzerinden dört gerçek WSS bağlantısı, 400 asker / 16 birlik, beşinci oyuncu reddi, host yetkisi, emir sahipliği, asker hareketi, dizilim, hero senkronizasyonu, doğru token ile dönüş ve yanlış token reddi.
- `combat-network-test.mjs`: iki hero, hazırlık/uçuş sırasında hasar olmaması, doğru hedefe varış isabeti ve varışta dodge. Ölçülen ok uçuşu 0,545 saniye.
- Vercel origin'inden `join-rejection-browser.js`: üç test WebSocket'i + gerçek oyun arayüzüyle dördüncü bağlantı; dolu faction reddinden sonra başka faction ile hemen katılım; dört bağlı oyuncu, 400 asker, hero'ya geçiş ve W tuşuyla hareketin diğer istemciye ulaşması.
- `hud-browser.js`: canlı bağlantıda hero/RTS dönüşü, birlik seçimi, dizilim, yeni maç ve değişmeyen panellerde sıfır gereksiz DOM yenilemesi.
- İzin verilmeyen `https://untrusted.invalid` Origin'i ile WebSocket Upgrade isteği HTTP 403 aldı. Vercel origin'iyle gerçek bağlantılar kabul edildi.

İlk canlı test, beşinci oyuncunun açık ret yanıtı gelmesine rağmen proxy üzerinden close olayı geciktiği için zaman aşımına uğradı. `28bb678` ile ilk katılım hatasında istemci hemen bağlantıyı bırakıp bekleyen arayüzü açar; ağ testi de reddi uygulamanın hata yanıtından değerlendirir. Son canlı sürümde ret/tekrar katılım ve hero hareketi kontrolü de geçti. Sunucunun savaş kuralları değişmedi.

Bunlar aynı test makinesinden açılan bağımsız bağlantılardır; dört farklı fiziksel cihaz veya uzun süreli gerçek oyuncu maçı doğrulaması değildir. FPS karşılaştırmasının koşulları ve sınırları [RENDER_VALIDATION.md](RENDER_VALIDATION.md) içindedir.

## Render kurulumu

Blueprint dosyası: [`deploy/render.yaml`](../deploy/render.yaml). Render'da Blueprint Path olarak bu yolu seç; repo kökü Docker build context olarak kalır. Dosya kökte tutulmaz: güncel Vercel CLI kökteki `render.yaml` dosyasını kendi servis yapılandırmasına otomatik dönüştürmeye çalışır.

Hazır ayarlar: `ironfront-game`, Docker, Frankfurt, free plan, tek instance, `/health`. Otomatik deploy kapalıdır; her kaynak commit'i çalışan maçları yeniden başlatmaz. Servisi `main` dalına bağla ve test edilmiş commit'i maçlar arasında elle dağıt. Özel GitHub deposuna erişim için Render GitHub bağlantısının bu repoyu görmesi gerekir.

Ücretsiz Render web servisi, 15 dakika gelen HTTP/WebSocket mesajı olmadığında uyur; sonraki açılış yaklaşık bir dakika sürebilir. Arkadaşlarını çağırmadan önce servis adresini açıp `/health` yanıtını bekle. Aktif istemciler uygulama ping'i gönderir. Uyuma, restart veya yeni deploy RAM'deki odaları korumaz. Kaynak: [Render Free](https://render.com/docs/free).

## 1. Go sunucusu

Herhangi bir Docker destekleyen servis veya VPS uygundur. Tek replica kullan: odalar RAM'de tutulur. Birden fazla bağımsız replica aynı oda durumunu paylaşmaz.

```sh
docker build -t ironfront .
docker run --rm -p 8787:8787 -e ALLOWED_ORIGINS=oyunun.vercel.app ironfront
```

Üretimde servis sağlayıcının TLS adresini veya HTTPS reverse proxy kullan. İnternetten erişilen HTTPS frontend'i güvenli WebSocket (`wss://`) ister. Sağlayıcının `PORT` değeri otomatik okunur; container varsayılanı 8787'dir. Reverse proxy WebSocket Upgrade desteklemeli ve boş bağlantı süresi en az 60 saniye olmalıdır. İstemci 2 saniyede bir uygulama ping'i gönderir.

| Değişken | Değer |
|---|---|
| `PORT` | Varsayılan `8787` |
| `STATIC_DIR` | Docker'da `/web`; geliştirmede `../frontend/dist` |
| `ALLOWED_ORIGINS` | Virgülle ayrılmış izinli hostlar; ör. `oyunun.vercel.app,oyun.example.com` |

Origin listesini tüm internete açmak gerekmez. Aynı host üzerinden sunulan arayüz bağlantıları da kabul edilir. Kontrol: `GET /health` → `{"ok":true,"rooms":0,"tickRate":20}`.

## 2. Vercel frontend

1. Kaynağı kendi Git reposuna ekle ve Vercel'e import et.
2. Root Directory: proje kökü (`ironfront`); framework: Vite; Node.js 22.x. `vercel.json` install/build/output ayarlarını sağlar. Docker/Container preset seçme; Docker yalnız Render içindir. `.vercelignore` binary, yerel build, ortam dosyaları ve Render tanımını yükleme dışında tutar.
3. Environment variable: `VITE_SERVER_URL=https://go-sunucunun-gercek-adresi`.
4. Deploy et. Vite bu adresi build sırasında bundle'a gömer; değişirse yeniden deploy et.
5. Oluşan Vercel hostunu Go servisinin `ALLOWED_ORIGINS` değerine ekle ve Go servisini yeniden başlat. Restart aktif maçları bitirir.
6. Dört tarayıcı oturumunda aynı oda koduyla gir, birliğe komut ver ve tüm istemcilerde hareketi kontrol et.

Mevcut Vercel proje adı `ironfront`, scope `hassanberas-projects`. GitHub otomatik bağlantısı kurulmadı; kaynak kod Vercel CLI ile yüklendi. Proje sayfası: [Vercel IRONFRONT](https://vercel.com/hassanberas-projects/ironfront). GitHub'a push otomatik Vercel deploy yapmaz. Render GitHub erişimi bağlandı, ancak `autoDeployTrigger: off` nedeniyle o da elle dağıtılır.

Sonraki yayında önce ilgili testleri çalıştır ve kaynak commit'ini push et. Render CLI ile `render deploys create srv-dbiebcon74is739dncq0 --commit <SHA> --wait --confirm`, Vercel proje kökünde `vercel deploy --prod --yes` kullan. Render yeniden başladığında aktif odalar sona erer; bunu maçlar arasında yap. Yalnız belge commit'i için oyun servislerini yeniden başlatmak gerekmez.

Yayın kontrolü: üretim adresinde oturum açmadan ana ekran, `drill.html` ve assetler açılmalı; tarayıcıdan `wss://<render-host>/ws` bağlantısı izinli Vercel origin'i ile kurulmalı. Ardından `TEST_WS_URL=wss://<render-host>/ws node scripts/network-test.mjs` ve `combat-network-test.mjs` çalıştır. Bu otomatik testler dört ayrı cihazın yerini tutmaz.

`VITE_SERVER_URL` sonuna `/ws` ekleme; istemci ekler. Bu değer public sunucu adresidir, secret değildir. Preview deployment hostları da test edilecekse yalnızca ilgili hostları izin listesine ekle.

## Neden kalıcı Go süreci?

Vercel'in 22 Haziran 2026 tarihli resmi kılavuzu Functions üzerinde WebSocket desteğini açıklar, ancak bağlantının Function'ın azami süresine bağlı olduğunu ve sonraki bağlantıların aynı Function'a gitmesinin garanti edilmediğini de belirtir. Bu oyunun oda durumu ve 20 Hz simülasyonu tek süreçte yaşar; yatay paylaşım/Redis eklemek bu sürümün kapsamını büyütürdü. Bu nedenle frontend Vercel'e, stateful Go sunucusu kalıcı bir servise ayrılır.

Kaynak: [Vercel — Do Vercel Serverless Functions support WebSocket connections?](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

Render Docker servisi frontend'i de sunar; Render adresi aynı backend'e ulaşan ikinci giriş noktası olabilir. Özel alan adı veya ücretli servis bu sürüm için gerekli değildir.
