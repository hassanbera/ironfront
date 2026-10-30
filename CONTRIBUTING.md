# Geliştirme ve commit düzeni

Her commit tek bir tamamlanmış değişikliği anlatır. Sunucu kuralı, arayüz, test, asset, dağıtım ve dokümantasyon değişikliklerini anlamlı sınırlar üzerinden ayır. Birbirine bağlı kodu sırf commit sayısını artırmak için bölme. Henüz yazılmamış özellikler için boş commit oluşturma; planı `docs/ROADMAP.md` içinde tut.

## İş akışı

1. Küçük işin kapsamını ve doğrulama ölçütünü belirle; gerekirse yol haritasını güncelle.
2. Değişikliği uygula ve kapsamına uygun kontrolleri çalıştır.
3. `git diff --check`, `git diff` ve `git status --short` ile kapsamı incele. Asset lisanslarını, hassas dosyaları ve yanlışlıkla eklenen çıktıları kontrol et.
4. İlgili dosyaları açıkça stage et; tek amaçlı bir commit oluştur.
5. Commit/push talebi geçerliyse biten parçayı `origin` adresine gönder. Ana dal geçmişini yeniden yazma ve force-push kullanma.
6. Uzak commit kimliğini doğrula; tamamlanan iş, test sonucu ve kalan engeli kullanıcıya bildir.

Başlık biçimi: `type(scope): somut değişiklik`. `feat`, `fix`, `test`, `assets`, `build`, `ci`, `docs` kullanılabilir. Örnek: `fix(combat): preserve notice delay while cavalry is engaged`. Gerektiğinde gövdede sorun, sonuç ve doğrulama komutu yer alır. Commitler bugünkü aktarımı gösterir; geriye dönük geliştirme tarihi izlenimi yaratılmaz.

## Doğrulama

| Değişiklik | Gerekli kontrol |
|---|---|
| Frontend | `cd frontend && npm run build`; değişen akışı tarayıcıda dene |
| Go kuralları / sunucu | `cd server && go test ./...` ve `go vet ./...` |
| WebSocket / lobby / oturum | Sunucu açıkken `node scripts/network-test.mjs` |
| Ortak `server/rules.json` | Hem Go testleri hem frontend derlemesi |
| Yarış durumu riski | Desteklenen Linux / 64 bit C derleyicili ortamda `go test -race ./...` |
| Yalnızca belge | Bağlantıları ve komutları gözden geçir; DOCX değiştiyse tüm sayfaları render edip incele |

`node_modules`, `frontend/dist`, derlenmiş binary, `.env` ve erişim anahtarları Git'e girmez. Kullanıcının açık maçı veya çalışan yerel sunucusu doğrulama için kapatılmaz. Entegrasyon testinde gerekirse başka port kullanılır.

## GitHub Actions durumu

`docs/ci.yml.template` hazırdır, **aktif workflow değildir**. İlk gönderimde GitHub CLI OAuth oturumunun `workflow` kapsamı eksik olduğundan `.github/workflows/ci.yml` reddedildi. Diğer kaynak commitleri başarıyla gönderildi. Windows yerel race testi de 32 bit GCC nedeniyle tamamlanamadı; Linux CI sonucu henüz yoktur.

Workflow yetkili bir GitHub oturumu sağlandığında taslak `.github/workflows/ci.yml` konumuna taşınarak ayrı bir commit ile etkinleştirilebilir. Taslak Node 22, Go 1.27.3, frontend build, Go race/vet ve dört WebSocket istemcisi testini çalıştırır. İlk gerçek CI sonucu alınmadan başarılı CI iddiası yazılmaz.
