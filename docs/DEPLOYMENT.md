# Dağıtım

Bu proje bir Vercel frontend'i ve tek kalıcı Go oyun sunucusu olarak hazırlanmıştır. Dağıtım yapılmamıştır; hesap veya ücretli servis oluşturulmamıştır.

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
2. Root Directory: proje kökü (`ironfront`); framework: Other. `vercel.json` build/output ayarlarını sağlar.
3. Environment variable: `VITE_SERVER_URL=https://go-sunucunun-gercek-adresi`.
4. Deploy et. Vite bu adresi build sırasında bundle'a gömer; değişirse yeniden deploy et.
5. Oluşan Vercel hostunu Go servisinin `ALLOWED_ORIGINS` değerine ekle ve Go servisini yeniden başlat. Restart aktif maçları bitirir.
6. Dört tarayıcı oturumunda aynı oda koduyla gir, birliğe komut ver ve tüm istemcilerde hareketi kontrol et.

`VITE_SERVER_URL` sonuna `/ws` ekleme; istemci ekler. Bu değer public sunucu adresidir, secret değildir. Preview deployment hostları da test edilecekse yalnızca ilgili hostları izin listesine ekle.

## Neden kalıcı Go süreci?

Vercel'in 22 Haziran 2026 tarihli resmi kılavuzu Functions üzerinde WebSocket desteğini açıklar, ancak bağlantının Function'ın azami süresine bağlı olduğunu ve sonraki bağlantıların aynı Function'a gitmesinin garanti edilmediğini de belirtir. Bu oyunun oda durumu ve 20 Hz simülasyonu tek süreçte yaşar; yatay paylaşım/Redis eklemek bu sürümün kapsamını büyütürdü. Bu nedenle frontend Vercel'e, stateful Go sunucusu kalıcı bir servise ayrılır.

Kaynak: [Vercel — Do Vercel Serverless Functions support WebSocket connections?](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections).

Tek VPS/container üzerinde frontend'i de Go ile sunmak alternatifidir; Vercel zorunlu değildir. Ücret, servis hesabı ve alan adı seçimi bu pakette yapılmamıştır.
