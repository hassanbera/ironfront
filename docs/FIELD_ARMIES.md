# Birlik görünümleri, harita ve savaşa katılım

Birlik Talimi'nde faction seçildiğinde o ordunun dört sınıfı gösterilir. Vikinglerin mavi yün kıyafeti, burun korumalı miğferi ve post omuzluğu, Arapların sarığı, omuz örtüsü, süvari yüz örtüsü ve cirit takımı ortak iskeletlere oturur. Dört ordunun okçuları sadak, ok ve taşıma kayışı taşır. Talimde biniciler kıyafet incelemesi için yerde gösterilir. Maçta mevcut bineklerini kullanırlar. Hareket atlaslarının üçü de önceki sürümle bayt düzeyinde aynıdır.

## Yakın dövüş

İlk temas eski sürümde birlik merkezini durduruyor, arkadaki askerleri yürüyüş diziliminde tutuyordu. Saldır ve saldırarak ilerle emirlerinde askerler artık hedefin çevresindeki erişilebilir temas noktalarına ilerler. Dış sıralar yanlara açılır. Atlılar dar bir piyade cephesinde yer değiştirir. Yerinde bekleyen savunma birliği çizgisini korur. Her temas anında asker mesafesi, görüş hattı ve vuruş açısı yeniden sınanır. Yan ve arka saldırı çarpanları, fark etme gecikmesi ve dizilim bonusları uygulanır.

Total War Academy emirlerin birlik düzeyinde verildiğini ve süvariyle yan saldırının konumsal avantaj sağladığını açıklar. ROME II kılavuzundaki *Formation Attack*, yakın dövüşte düzeni korumaya çalışan bir birlik özelliğidir. Buradaki asker başına temas noktaları bu oyuna özgü bir uygulamadır. [Total War Academy](https://academy.totalwar.com/battle-deployment-and-battle-terrain/) · [ROME II birlik özellikleri](https://r2enc.totalwar.com/en/manual/single-player/0086_enc_page_battle_play_phase_conflict_attributes/).

| Deneme | Önce | Sonra |
|---|---|---|
| Açık arazide 25 saldırgan, 25 savunmacı, 25 saniye, dört faction ve 12 dizilim | Dizilime göre 1–5 farklı asker temas etti | Her dizilimde 25 farklı asker hasar verdi |
| Piyadeye karşı Arap hafif süvarisi | 3 dizilimde de tek atlı vurdu | Her dizilimde 25 farklı atlı vurdu, bir vuruş anındaki en yüksek sayı 17 |
| Türk atlı okçuları, hilal ve dağınık düzen | 15/25 ve 20/25 atış yaptı | Her ikisinde de 25/25 atış yaptı |

İlk test hedefin canını her vuruş öncesinde yeniler. Böylece her dizilim aynı sayıda savunmacıyla sınanır. Ayrı bir normal kayıplı 25’e 25 denemesinde 30 saniyede 25 Knights ve 21 Viking askeri geçerli temasa katıldı. Savunma emrine dönme, merkezlerin arasındaki kayalığın yanından temas, altı menzilli sınıfın üçer dizilimi ve 4 WebSocket istemcisi de test edildi. [Katılım testleri](../server/engagement_test.go).

## Harita ve tempo

Üç haritanın kenarı 180’den 252’ye çıktı. Üsler, karakollar, arazi bölgeleri, engeller, yol bulma, çarpışma alanı ve minimap yeni boyuta göre yerleştirildi. Testte aynı Knights ağır piyade birliği, aynı dizilim ve hızla doğuş noktasından kendi karakolunun merkezine yürütüldü. İşgal sayacı yürüyüş süresine dahil edilmedi.

| Harita | Önce | Sonra |
|---|---:|---:|
| Sınır Vadisi | 11,50 sn | 19,15 sn |
| Kızıl Geçit | 11,50 sn | 19,15 sn |
| Kuzey Surları | 12,35 sn | 20,40 sn |

Üç haritada da her üs yönünden dört karakola yol bulunması kontrol edildi. Kamera ve minimap üzerinden yeni harita sınırlarına gidildi. [Yürüyüş denemesi](../server/march_test.go).

## Yerel çizim ölçümü

Intel UHD Graphics üzerinde 1440 × 900, yüksek kalite. Aynı sabit asker konumları ve kamera tekrarında eski–yeni–yeni–eski sırası kullanıldı. Her sürüm için iki koşunun ortalaması gösterilir. Koşu başına 180 ısınma karesi ve 419 ölçülen kare aralığı vardır.

| Sahne | FPS eski → yeni | Kare p95 eski → yeni | Medyan çizim çağrısı |
|---|---:|---:|---:|
| Hero, 400 asker | 34,85 → 36,70 | 45,80 → 41,65 ms | 44 → 54 |
| RTS, 800 asker | 33,70 → 32,80 | 41,70 → 41,70 ms | 54 → 59 |

Bu karşılaştırma istemcinin çizimini ölçer. İki insanın oynadığı uzun bir internet maçı ayrı bir denemedir. [Sekiz koşunun ham ölçümleri](field-armies-replay.json).
