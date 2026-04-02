# Gnothi NEWS Resolution TODO

Bu dosya, NEWS tabanli GenLayer resolution akisinin gercekten calisir hale gelmesi icin gereken kritik isleri oncelik sirasi ile toplar.

## Faz 1 - Kritik Blokajlar

- [x] `BetCOFI.resolve()` yetki modelini netlestir.
- [x] `creator` disinda bridge service wallet'inin resolve cagirabilmesi gerekip gerekmedigine karar ver.
- [x] Eger otomatik resolution korunacaksa `creator || approved resolver` modeli ekle.
- [x] Eger manuel model secilecekse frontend'deki otomatik schedule akislarini kaldir veya pasiflestir. (N/A — otomatik model secildi: creator || approved resolver)

- [x] Eski ABI kullanan helper scriptleri guncelle.
- [x] [contracts/scripts/place-bet.ts](/c:/Users/enliven/Documents/GitHub/gnothi/contracts/scripts/place-bet.ts) icin `placeBet(address,bool,uint256,uint8 probability)` imzasina gec.
- [x] [bridge/service/scripts/test-e2e-flow.ts](/c:/Users/enliven/Documents/GitHub/gnothi/bridge/service/scripts/test-e2e-flow.ts) icin yeni `placeBet` imzasini kullan.

- [x] NEWS market olusturma standardini teke indir.
- [x] NEWS icin sadece `createNewsBet(question, evidenceUrl, ...)` kullan.
- [x] [contracts/scripts/create-bet.ts](/c:/Users/enliven/Documents/GitHub/gnothi/contracts/scripts/create-bet.ts) icindeki NEWS path'ini `createNewsBet` ile uyumlu hale getir.

- [x] `news.py` / `news_pm.py` isim karmasasini bitir.
- [x] Repoda tek bir canonical isim belirle.
- [x] Gerekirse `bridge/intelligent-contracts` ve `bridge/service/intelligent-oracles` altindaki iki kopyayi tek source of truth mantigina indir.

## Faz 2 - NEWS Oracle Saglamlastirma

- [ ] NEWS input modelini acik hale getir.
- [ ] `question` ve `evidenceUrl` icin relay tarafinda acik isimler kullan.
- [ ] `tokenSymbol/tokenName` repurpose mantigini en azindan yorumlarla netlestir veya ayri NEWS deploy fonksiyonuna tas.

- [ ] `news_pm.py` icin guvenli fallback davranislari ekle.
- [x] URL fetch basarisizsa `UNDECIDED` don.
- [x] Bos veya anlamsiz icerik durumunu ele al.
- [x] Parse edilemeyen LLM cevabini `UNDECIDED` olarak normalize et.

- [ ] Prompt enjeksiyonu riskini azalt.
- [ ] Kullanici girdisini net delimiter/tag icine al.
- [ ] Promptta sadece izinli cikti formatini kabul et.
- [ ] `SIDE_A | SIDE_B | UNDECIDED` disindaki her seyi gecersiz say.

- [ ] Kullanilacak kaynak politikasini belgeye bagla.
- [ ] MVP icin open-access haber kaynaklari listesi belirle.
- [ ] Paywall/CAPTCHA kaynaklari icin uyarili veya yasakli model sec.

## Faz 3 - Bridge ve Service Calisma Plani

- [ ] EVM -> GenLayer -> EVM akisi icin gerekli env listesini tek yerde belgeye bagla.
- [ ] `PRIVATE_KEY`
- [ ] `BASE_SEPOLIA_RPC_URL`
- [ ] `BET_FACTORY_ADDRESS`
- [ ] `GENLAYER_RPC_URL`
- [ ] `BRIDGE_SENDER_ADDRESS`
- [ ] `BRIDGE_FORWARDER_ADDRESS`
- [ ] `FORWARDER_NETWORK_RPC_URL`

- [ ] Local ve persistent calisma modlarini ayir.
- [ ] Local dev icin memory fallback destekle.
- [ ] Demo/prod icin Supabase zorunlulugunu netlestir.

- [ ] Supabase migration akisini dogrula.
- [ ] `oracle_deployments` tablosu
- [ ] `resolution_jobs` tablosu

- [ ] Oracle deployment kaydinin frontend AI Console ile uyumlu aktigini dogrula.
- [ ] `ResolutionRequested`
- [ ] oracle deploy
- [ ] `recordOracle()`
- [ ] frontend `getGenLayerTxHash()`

## Faz 4 - Test Plani

- [x] Unit test ekle veya genislet.
- [x] `createNewsBet()` icin basarili olusturma testi yaz.
- [x] NEWS `resolutionData` encode/decode testi yaz.
- [x] resolver yetki modeli testi yaz.
- [x] `UNDECIDED` refund testi yaz.
- [x] winner side bos oldugunda refund edge case testi yaz.

- [x] NEWS icin ayri integration/e2e test yaz.
- [ ] market olustur
- [ ] her iki tarafa bet koy
- [ ] endDate gecsin
- [ ] resolution tetikle
- [ ] oracle deploy edilsin
- [ ] bridge callback gelsin
- [ ] market `RESOLVED` veya `UNDETERMINED` olsun

- [ ] `news_pm.py` icin smoke test senaryolari tanimla.
- [ ] gecerli acik URL
- [ ] bozuk URL
- [ ] bos icerik
- [ ] belirsiz haber
- [ ] acik karar veren haber

## Faz 5 - Frontend ve Demo

- [ ] Admin panel NEWS form validasyonlarini guclendir.
- [ ] `question` zorunlu olsun.
- [ ] `evidenceUrl` zorunlu olsun.
- [ ] `endDate` future olmak zorunda olsun.
- [ ] side isimleri bos gecilemesin.

- [ ] AI Console'u NEWS akisi icin polish et.
- [ ] source URL veya evidence bilgisi goster.
- [ ] raw tx status daha acik sunulsun.
- [ ] fetch/tx hatalari daha anlasilir metinlerle gosterilsin.

- [ ] Frontend production build sorununu ayikla.
- [ ] Windows SWC/DLL problemi
- [ ] `.next/trace` EPERM problemi
- [ ] gerekirse temiz build veya farkli environment dene

## Faz 6 - Dokumantasyon

- [ ] [README.md](/c:/Users/enliven/Documents/GitHub/gnothi/README.md) icinde NEWS akisinin gercek halini belgeye bagla.
- [ ] Gerekli env'leri yaz.
- [ ] Calistirma sirasini yaz.
- [ ] Manual resolve vs auto resolve kararini acikla.

- [ ] [PLAN.md](/c:/Users/enliven/Documents/GitHub/gnothi/PLAN.md) ile repo gercekligini hizala.
- [ ] Tamamlananlar
- [ ] Kismen yapilanlar
- [ ] Hala eksik kalanlar

## Onerilen Uygulama Sirasi

1. Resolver yetki modelini coz.
2. Scriptleri yeni ABI ile duzelt.
3. NEWS create/deploy akislarini tek standarda indir.
4. NEWS e2e testini yaz.
5. Bridge env ve persistence kurulumunu netlestir.
6. Frontend validasyon ve AI Console polish islemlerini yap.
7. README ve PLAN guncellemelerini tamamla.

## Basari Kriteri

- [ ] NEWS market admin panelden olusturulabiliyor.
- [ ] Bet koyma yeni ABI ile sorunsuz calisiyor.
- [ ] End date sonrasi resolution tetiklenebiliyor.
- [ ] Relay `news_pm.py` deploy ediyor.
- [ ] Oracle GenLayer'da karar uretiyor.
- [ ] Sonuc bridge ile Base'e geri donuyor.
- [ ] Bet `RESOLVED` veya `UNDETERMINED` durumuna geciyor.
- [ ] AI Console tx hash ve validator durumunu gosterebiliyor.
- [ ] Uctan uca test en az bir NEWS senaryosunda geciyor.
