# Karakter ve animasyon doğrulaması — 30 Ekim 2026

Bu geçiş, askerlerin yaptığı hareketleri yakın kamera ve RTS görünümünde okunur hale getirir. Go kuralları ve ağ protokolü değişmedi. Stil hâlâ düşük poligonlu/stilizedir; fotogerçekçi karakter üretimi değildir.

## Uygulanan değişiklik

- KayKit'in CC0 Knight, Barbarian ve Rogue_Hooded modellerinden türetilmiş üç gövde; faction kumaş renkleri ve kılıç/kalkan, mızrak, yay, balta, çift balta, cirit ekipmanı.
- Yirmi klip/poz: hazır, yürü, koş, kılıç, balta, mızrak, çift balta, yay, fırlatma, blok, blok darbesi, darbe, iki düşme, kaçınma, zıplama, oturan binici ve üç süvari saldırısı.
- Kaynak animasyonlar 24 örnek/saniye matris atlasına dönüştürülür. GPU kareler arasında enterpolasyon yapar; hareket geçişi 120 ms içinde yumuşar. Bireysel asker fazları eşzamanlı robot yürüyüşünü azaltır.
- Yay kol pozu ve gerilen kiriş; küçük hamle hareketi, darbe tepkisi ve sunucu kaybıyla oluşan düşme. En fazla 96 geçici düşen beden 4,5 saniye tutulur.
- Oturan süvari pozu, yeniden şekillendirilmiş prosedürel at/deve, dört bacak yürüyüşü ve faction eyer örtüsü.
- Kamera uzaklığına göre üç gövde seviyesi: yakın 4.005–4.777, orta 1.120–1.337, uzak 399–477 üçgen. Silahlar ayrıca çizilir. Karakter verisi toplam yaklaşık 4,7 MB'dir.
- Hero kamerası omuza kaydırıldı; can/stamina paneli sol alta taşındı. Talim sayfası ana menüden yeni sekmede açılır ve açık maçı sonlandırmaz.

Kaynak commit, lisans, dosya hash'leri ve üretim komutu: [asset kaynakları](../frontend/public/assets/characters/SOURCES.md).

## Geçen kontroller

- `node scripts/validate-character-assets.mjs`: üç modelin klip süreleri, atlas sınırları, sonlu half-float matrisleri, geometri indeksleri, normalize kemik ağırlıkları, farklı hareket pozları ve azalan LOD üçgen sayıları geçti. Kaynak oturma pozunun sıfır süreli olduğu bu kontrolle bulundu; poz 1/24 saniyelik sabit klip olarak düzeltildi.
- `npm run build`: TypeScript kontrolü ve Vite üretim derlemesi; ana oyun ve `drill.html` çıktıları. Three.js chunk boyutu uyarısı engelleyici değildir.
- Üretim çıktısı mevcut Go sunucusunda `http://127.0.0.1:8787/drill.html` üzerinden açıldı; üç gövde ve silahlar yüklendi, beş karakter görünümü doğrulandı.
- Yerel Chromium, 1440×900: beş karakterin saldırı, yay çekme ve yere düşme pozları görsel olarak incelendi. Saldırı türleri doğru silahlarla gösterildi; 400 kişilik görünümde gövdelerin tamamı görüldü.
- Ayrı bot maçında süvari, hero koşu, blok, kaçınma, kılıç saldırısı ve zıplama denendi. Can paneli karakterin ayaklarını kapatmadı. Maçta yerde kalan askerler ve savaşan ordular gözlendi.
- Son maçın tarayıcı konsolunda hata veya uyarı yoktu. Kullanıcının açık maçına ve Go sürecine dokunulmadı.

## Yerel performans örneği

Talim sahnesi, gölgeler açık, 1440×900 tarayıcı viewport'u, cihaz piksel oranı en fazla 1,5. Sayaç gerçek geçen süreyi kullanır; dört örnek yaklaşık 800 ms aralıkla alınmıştır.

| Görünüm | Gözlenen FPS | Çizim çağrısı | Üçgen |
|---|---:|---:|---:|
| Yakında 5 karakter, saldırı pozu | 120 | 10 | Ölçüm kaydedilmedi |
| 400 karakter, koşu; dört faction | 64, 49, 61, 53 | 17 | 409.323 |

Bu kısa örnek donanımlar arası benchmark veya ağ yük testi değildir. Aynı makinedeki diğer açık oyun sekmeleri ölçümü etkileyebilir. FPS sınırı, uzun maç p95 kare süresi, yüksek kapasite ve ayrı cihaz testi için genellenemez. Önceki ara sürümlerdeki ölçümler farklı model dağılımına sahip olduğundan doğrudan önce/sonra karşılaştırması verilmez.

## Kalan görsel sınırlar

- Üç kaynak gövde paylaşılır; Arabs ve Turks için ayrı tarihsel kıyafet/siluet setleri henüz yoktur. Faction rengi, silah ve birlik düzeni ayrım sağlar.
- Binekler prosedüreldir; lisanslı iskeletli at/deve paketi, ragdoll ve ayakların zemine IK ile oturması yoktur.
- Saldırı/kayıp olayları birlik düzeyinden türetilir; her kılıç darbesi tek bir karşı askerle fiziksel temas çözümü yapmaz. Yakın çatışmada askerler üst üste gelebilir.
- Q yeteneği için ayrı sinematik animasyon/effect seti eklenmedi. Mevcut oyun etkisi korunur.
- Bu geçişte farklı GPU/tarayıcılar ve dört fiziksel cihazla çevrimiçi maç yeniden test edilmedi. CI ve dağıtım durumu [VALIDATION.md](VALIDATION.md) içindedir.
