Gnothi: AI-Oracle Destekli Tahmin Piyasası
1. Proje Özeti
Gnothi, kripto veya hisse senedi gibi deterministik verilere dayanmayan, gerçek dünya olayları (haberler, politik sonuçlar, sosyal gelişmeler) üzerine kurulan bir tahmin piyasasıdır. Açık kaynaklı pm-kit (Court of Internet) altyapısı üzerine inşa edilen Gnothi, geleneksel tahmin piyasalarındaki "Oracle Problemini" GenLayer ağı üzerindeki yapay zeka ajanlarının konsensüsü ile çözer.

Sistem, kullanıcıların olasılık tahminleri yaptığı bir ticaret evresi ile GenLayer'ın internete bağlanarak mutlak gerçeği doğruladığı çözüm evresini SCEM (Strictly Proper Scoring Rules) mekanizmasıyla birleştirir.

2. Problem ve Çözüm
Problem: Haber veya olay tabanlı tahmin piyasalarında sonucun doğruluğunu on-chain'e taşımak zordur. Merkezi oracle'lar güven gerektirir, merkeziyetsiz oylama sistemleri ise yavaş ve manipülasyona açıktır.

Çözüm: Gnothi, piyasa sonuçlandırma işlemini GenLayer'a devreder. Piyasa süresi dolduğunda, GenLayer üzerindeki birden fazla LLM ajanı bağımsız olarak internette araştırma yapar, kanıtları inceler ve kendi aralarında tartışarak strict_eq prensibiyle kesin bir sonuca varır. Bu sonuç, LayerZero (veya benzeri bir köprü) aracılığıyla EVM ağına (Base) iletilir.

3. Sistem Mimarisi ve İş Akışı
Gnothi'nin işleyişi beş temel aşamadan oluşur:

Aşama 1: Piyasa Oluşturma (Market Creation)
Kullanıcı (Creator), BetFactoryCOFI.sol üzerinden yeni bir piyasa (Market) oluşturur.

Girdiler: Soru (örn: "X şirketi bu ay iflas açıklayacak mı?"), Kanıt URL'leri (opsiyonel başlangıç kaynakları), Bitiş Tarihi (endDate).

Çıktı: Piyasaya özel bir akıllı sözleşme deploy edilir. Haber tipi (NEWS) piyasa olduğu sisteme kaydedilir.

Aşama 2: Tahmin ve Ticaret (Prediction & Trading)
Kullanıcılar veya botlar (Ajanlar), sonucun ne olacağına dair tahminlerde bulunur.

Kullanıcılar 0-100% arası bir olasılık belirler ve bu tahmini desteklemek için bir teminat (bond) yatırır.

Her yeni tahmin, piyasanın anlık fiyatını (olasılığını) günceller.

Aşama 3: Kapanış ve Tetikleme (Market Close & Trigger)
Piyasanın endDate süresi dolduğunda ticaret durur.

Creator veya herhangi bir kullanıcı resolve_market() fonksiyonunu çağırır.

BetFactoryCOFI sözleşmesi, ResolutionRequested (type=NEWS) event'ini yayınlar.

Bir relayer (EvmToGenLayer.ts) bu event'i dinler ve GenLayer ağında önceden deploy edilmiş olan NewsOracle sözleşmesini tetikler.

Aşama 4: AI Konsensüsü (GenLayer Resolution)
Sistemin çekirdek doğrulama süreci GenLayer üzerinde Python (news_pm.py) ile gerçekleşir.

Veri Toplama: gl.nondet.web.get kullanılarak ilgili haber sitelerinden ve kanıt URL'lerinden güncel veriler çekilir.

Ajan Tartışması: 5 farklı LLM perspektifi oluşturulur. Modeller, toplanan verileri analiz eder (gl.nondet.exec_prompt).

Konsensüs: Ajanlar "SIDE_A", "SIDE_B" veya "UNDECIDED" seçeneklerinden birinde anlaşmaya varır (gl.eq_principle.strict_eq). Eğer kesin bir kanıt yoksa veya durum belirsizse sistem güvenli çıkış olarak "UNDECIDED" döner.

İletim: Çıkan sonuç, BridgeSender aracılığıyla Base ağına geri gönderilir.

Aşama 5: Puanlama ve Ödeme (Scoring & Payout)
Base ağındaki sözleşme GenLayer'dan gelen mutlak sonucu alır.

Sistem, sonucun gerçeğini (1 veya 0) baz alarak, ticaret evresinde yapılan tahminleri SCEM formülü ile puanlar.

Gerçeğe en yakın ve erken tahminde bulunan kullanıcılar havuzdan en büyük payı alırken, yanılanların teminatları kesilir (slash).

"UNDECIDED" sonucu gelirse, tüm teminatlar kesintisiz iade edilir.

4. Kullanılacak Teknolojiler (Tech Stack)
Akıllı Sözleşmeler (EVM): Solidity (Base ağı için optimizasyon). pm-kit çatallanarak GenLayer event'leri eklenecek.

Yapay Zeka Oracle: GenLayer, Python (Web erişimi ve LLM routing için gl kütüphanesi).

Köprüleme (Bridge): LayerZero veya benzeri bir cross-chain mesajlaşma protokolü (EVM <-> GenLayer arası iletişim için).

Frontend & UX: Next.js ve TypeScript. Arayüzde sadece piyasa olasılıkları değil, GenLayer'daki AI ajanlarının karar verme süreçleri (hangi kaynaklara baktıkları, nasıl tartıştıkları) şeffaf bir log ekranı olarak kullanıcılara gösterilecek.

5. Hackathon İçin Kritik Geliştirme Adımları
Projenin jüriye hazır hale gelmesi için şu sırayla ilerlenmesi önerilir:

GenLayer Scriptinin Yazılması: İnternetten veri çekip 5 LLM'i aynı kararda buluşturan news_pm.py kodunun stabil çalışır hale getirilmesi. (En riskli ve yenilikçi kısım burası).

pm-kit Modifikasyonu: Mevcut kitin içine SCEM puanlama mantığının ve ResolutionRequested event'lerinin eklenmesi.

Relayer / Bridge Kurulumu: Base'deki event'i alıp GenLayer'ı tetikleyecek, sonra sonucu geri döndürecek basit bir Node.js veya TS relayer yazılması.

Arayüz Entegrasyonu: Kullanıcıların bahis yapabileceği ve AI karar sürecini okuyabileceği temiz bir frontend.

Bu doküman projenin genel çatısını net bir şekilde kuruyor.