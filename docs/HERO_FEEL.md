# Hero hareket ve temas geçişi — 30 Ekim 2026

## Davranış

- A/D'nin kamera sağ vektöründeki işaret hatası düzeltildi. WASD ve ok tuşları eşdeğerdir; çapraz hareket hızı artmaz. Tuş bırakma, odak kaybı ve blok değişimi hemen girdi gönderir; periyodik 20 Hz gönderim sürer.
- W ileri koşu, S geri adım, A/D yan adım oynatır. Hareket fazı alınan mesafeye bağlıdır. Kalkanla yürürken üst gövde blok pozunda, bacaklar hareket halindedir. Pelerinler adımları kapatmayacak şekilde kısaltıldı.
- Shift basıldığı anda yön sunucuda sabitlenir; tuş bırakmak veya sonradan ters tuşa basmak devam eden kaçınmayı çeviremez. Yönsüz Shift geri adımdır. Stamina, çarpışma ve 1,1 saniyelik bekleme sunucuda kalır.
- Yakın dövüşte savurma → çapraz kesiş → saplama sırası vardır. 1,2 saniyeden uzun ara sıfırlar. Toplam süre Muhafız 0,62; Düellocu 0,55; Akıncı 0,72 saniyedir. Temas toplam sürenin %42'sinde çözülür. Bu değerler başlangıç ayarıdır; rekabetçi denge kanıtı değildir.
- Henüz temas etmemiş saldırıyı blok veya kaçınma iptal eder; ölüm de bekleyen vuruşu siler. Hazırlıkta hareket %65'e iner. Bekleme süresi iptal edilerek yeni saldırı spam'i yapılamaz.
- Sunucu gerçek isabetin konumunu, hasarını ve kalkan temasını bildirir. İsabet işareti, kısa kıvılcım, hafif kamera tepkisi ve ayrı sesler bu olaydan doğar. Boşa savuruşta isabet bildirimi yoktur. Adım/savuruş sesleri ses düğmesiyle açılır; bu sesler prosedürel Web Audio sentezidir.
- Turks kapüşonları ve kıyafet kumaşı kırmızıdır. Kapüşon ile yüz aynı kaynak mesh'te olduğundan yeşil kumaş texelleri seçilerek renklendirilir; kaynak PNG değiştirilmez. Aynı düzeltme diğer faction renkleri için de geçerlidir.
- Talim sayfasında yeni yönlü hareketler ayrıca seçilebilir. Karakter başına 33 klip, üç LOD vardır; karakter verisi yaklaşık 5,8 MB'dir.

## Referans yaklaşımı

TaleWorlds'ün [Weapon Physics – Part 1](https://www.taleworlds.com/en/News/194) açıklamasındaki yönlü saldırı/blok ve ayak hareketi vurgusu; Torn Banner'ın [Reinforced Update](https://chivalry2.com/2022/10/04/reinforced-update-patch-notes/) notlarındaki hazırlık süresi, kaçınma sırasında saldırıya bağlılık ve temas geri bildirimi incelendi. Buradaki zamanlamalar ve kontroller IRONFRONT için seçildi; bu oyunların fizik/hasar sistemi kopyalanmadı. TaleWorlds sayfası doğrudan erişimde 403 döndü; resmi arama özeti kullanıldı.

## Doğrulama

- Kamera vektör testi: beş yaw açısında sekiz tuş yönü, eşdeğer ok/WASD, çift alias, zıt tuşların birbirini iptali, çapraz hız ve yönlü animasyon seçimi.
- Yeni Go testleri: hazırlıktan önce hasar olmaması, temasın yalnız bir kez çözülmesi, ıskada yanlış bildirim olmaması; kaçınma boyunca yönün korunması, sonrasında normal girdiye dönüş, yönsüz geri kaçınma; blok/kaçınma/ölüm ile saldırı iptali ve kalkan bildirimi.
- Üç modelin 33 klibi için poz/geometri bütünlüğü; TypeScript ve üretim derlemesi.
- Yeni sunucuda dört WebSocket istemcisi: oda sahipliği, 400 asker, hareket/dizilim/hero yayını, dolu oda reddi ve token ile yeniden bağlantı.
- 1440×900 Chromium bot maçında W/S/A/D ve dört ok tuşu ayrı ayrı uygulandı; gelen sunucu konumunun kamera eksenindeki işareti doğrulandı. Doğru run/back/strafeLeft/strafeRight klipleri, kalkanla yürüyüş ve slash/backslash/stab sırası görüldü. Turks kapüşon ve kıyafetleri yakın talim görünümünde incelendi.
- Aynı gerçek bot maçında düşmana yönelip saldırıldığında sunucu `impactDamage: 42` bildirdi; arayüzde `İSABET · 42` görüldü. Iska durumunda arayüzde isabet bildirimi çıkmadı.

## Kapsam sınırı

İstemci konum tahmini/rollback, kılıç kemiği üzerinden fiziksel hitbox, yönlü parry veya hedef kilitleme eklenmedi. Saldırı hâlâ sunucu menzil/açı/engel kontrolüyle çözülür; birlik hasarı birlik düzeyindedir. Kısa tarayıcı testi farklı donanımlarda FPS veya internet gecikmesinde aynı hissiyat garantisi vermez. Ses üretim yolu uygulandı; işitsel kalite ölçümü yapılmadı.

Yerel yeni sunucu 8788'de çalıştırılır; 8787'deki açık eski maç kapatılmaz. Yeni kaynak kurulumlarında istemci ve Go sunucusu birlikte derlenmelidir. CI yetkisi ve Windows race derleyicisi engelleri [VALIDATION.md](VALIDATION.md) içinde geçerliliğini korur.
