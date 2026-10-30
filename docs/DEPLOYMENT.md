# Dağıtım

Bu proje bir Vercel frontend'i ve Render'da tek Go oyun sunucusu olarak hazırlanmıştır. 30 Ekim 2026: Docker üretim imajı yerelde dört WebSocket istemcisiyle doğrulandı; Vercel projesi oluşturuldu ve kaynak yükleme kontrolü geçti. Render hesap yetkilendirmesi bekleniyor; henüz doğrulanmış canlı oyun adresi yok. Ücretli plan seçilmedi.

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

Mevcut Vercel proje adı `ironfront`, scope `hassanberas-projects`. GitHub otomatik bağlantısı kurulamadı; bu, doğrulanan kaynak kodunun Vercel CLI ile yüklenmesine engel değildir. Proje sayfası: [Vercel IRONFRONT](https://vercel.com/hassanberas-projects/ironfront). GitHub'a push ile otomatik Vercel deploy yapıldığı varsayılmamalı.

Yayın kontrolü: üretim adresinde oturum açmadan ana ekran, `drill.html` ve assetler açılmalı; tarayıcıdan `wss://<render-host>/ws` bağlantısı izinli Vercel origin'i ile kurulmalı. Ardından `TEST_WS_URL=wss://<render-host>/ws node scripts/network-test.mjs` ve `combat-network-test.mjs` çalıştır. Bu otomatik testler dört ayrı cihazın yerini tutmaz.

`VITE_SERVER_URL` sonuna `/ws` ekleme; istemci ekler. Bu değer public sunucu adresidir, secret değildir. Preview deployment hostları da test edilecekse yalnızca ilgili hostları izin listesine ekle.

## Neden kalıcı Go süreci?

Vercel'in 22 Haziran 2026 tarihli resmi kılavuzu Functions üzerinde WebSocket desteğini açıklar, ancak bağlantının Function'ın azami süresine bağlı olduğunu ve sonraki bağlantıların aynı Function'a gitmesinin garanti edilmediğini de belirtir. Bu oyunun oda durumu ve 20 Hz simülasyonu tek süreçte yaşar; yatay paylaşım/Redis eklemek bu sürümün kapsamını büyütürdü. Bu nedenle frontend Vercel'e, stateful Go sunucusu kalıcı bir servise ayrılır.

Kaynak: [Vercel — Do Vercel Serverless Functions support WebSocket connections?](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

Render Docker servisi frontend'i de sunar; Render adresi aynı backend'e ulaşan ikinci giriş noktası olabilir. Özel alan adı veya ücretli servis bu sürüm için gerekli değildir.
