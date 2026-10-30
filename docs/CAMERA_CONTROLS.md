# Hero kamera takibi ve orta tuş — 30 Ekim 2026

Yürürken karakter önce bir konum filtresinden geçiyor, kamera önceki karenin karakter konumunu ayrı bir filtreyle takip ediyordu. İki farklı takip ve 10 Hz sunucu konumları karakterin ekranda ileri/geri oynamasına neden oluyordu. Zıplama yüksekliği de doğrudan son paketten alınıyordu.

## Düzeltme

- Hero konumu ve yüksekliği en fazla sekiz örnekli, 120 ms gecikmeli küçük bir snapshot tamponundan örneklenir. Kamera ve çizilen karakter aynı karenin aynı konumunu kullanır. Kamera dünya konumuna ikinci bir takip filtresi uygulanmaz.
- Sunucu konumunun ötesine tahmin yapılmaz; çarpışmada duruş aşılmaz. Uzun paket kaybında son konum tutulur. Yeniden doğma gibi 30 m üzeri konum değişimlerinde tampon sıfırlanır.
- Engel nedeniyle kamera mesafesi kısalabilir; engelden çıkışta yalnız bu mesafe yumuşak açılır. Küçük darbe tepkisi sınırlandırıldı ve her kareye eklenerek birikmesi kaldırıldı. Normal yürüyüşte kamera sallama efekti yoktur.
- **Orta fare tuşu / tekerleğe basılı tut + sürükle:** kamera ve karakter birlikte döner. Yeni yön mevcut 20 Hz girdi akışıyla sunucuya gider; her fare olayı için ek ağ mesajı gönderilmez.
- Tuşu bırakmak, Escape, pointer iptali veya pencerenin odağını kaybetmesi sürüklemeyi bitirir. Pointer capture sayesinde tuş bırakma canvas dışında da yakalanır. Tarayıcı orta tuş otomatik kaydırması engellenir.
- Hero modunda otomatik fare kilidi ve saldırı tuşuyla kamera sürükleme kaldırıldı. Sol tık saldırı, sağ tık blok olarak çalışır. RTS modunda orta tuşla harita kaydırma korunur. Oyun içi yardım ve ipucu güncellendi.

## Doğrulama

1280×720 Chromium'da aynı laboratuvar sahnesi, 6,5 m/s düz yürüyüş, 10 Hz konum güncellemesi ve sabit bakış yönü kullanıldı. İlk saniyeden sonraki dört saniye boyunca çizilen hero gövdesinin referans noktası ekrana yansıtıldı:

| Ekrandaki toplam sapma | Önce | Sonra |
|---|---:|---:|
| Yatay | 4,292 px | <0,001 px |
| Dikey | 14,657 px | <0,001 px |

Bu ölçüm açık zeminde takip kaynaklı oynamayı ölçer; animasyonun doğal eklem hareketini, çatışma efektlerini veya her harita/engel durumunu kapsayan bir garanti değildir.

Tekrarlamak için Playwright CLI ile çalışan oyunun `/crowd-lab.html` sayfasını aç, ardından `playwright-cli -s=<oturum> run-code --filename=scripts/hero-camera-browser.js` çalıştır. Kontrol 1 px üzerindeki takip sapmasında hata verir. Bu senaryo yalnız yerel laboratuvar durumunu değiştirir; çevrimiçi odaya bağlanmaz.

- `hero-track-test.mjs`: 30/60/144 FPS'te sabit görsel hız; paket geliş dalgalanması, çarpışma duruşu, paket kaybı, teleport, yön değişimi ve zıplama geçişi geçti.
- `hero-controls-test.mjs`: beş bakış açısında WASD/ok yönleri, çapraz hız, yan/geri adım ve kaçınma seçimi geçti.
- Üretim derlemesi ve TypeScript kontrolü geçti.
- Gerçek Go sunucusuna bağlı bot maçında dokuz tarayıcı kontrolü geçti: serbest fare hareketiyle dönmeme; orta tuşla kamera/hero ve sunucu yönünün eşleşmesi; bırakınca durma; W ile yeni yöne yürüme; Escape ve odak kaybında bırakma; sol saldırı; sağ blok/bırakma; RTS orta tuş kaydırma. Orta tuş saldırı başlatmadı, pointer lock gerekmedi. JavaScript/WebGL hatası görülmedi.

Tampon görsel konuma 120 ms yumuşatma gecikmesi getirir; girdi gönderimi veya sunucunun hareket/çarpışma kuralı geciktirilmez. İstemci tahmini/rollback eklenmedi. Bu değişiklik frontend kapsamındadır; Go kodu değişmedi ve Go testleri tekrar çalıştırılmadı. Eski maçlar korunarak ayrı 8791 test süreci kullanıldı; güncel frontend normal 8789 adresinden sunulur.
