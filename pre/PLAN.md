# Gnothi — Implementation Plan

## Proje Özeti

Gnothi, gerçek dünya haber olayları üzerine kurulu bir tahmin piyasasıdır.
- **EVM (Base Sepolia):** Ticaret, likidite, kullanıcı etkileşimi
- **GenLayer (Bradbury Testnet):** 5 LLM ajanı internet'i tarayarak piyasa sonucunu belirler
- **LayerZero V2:** Base ↔ GenLayer arası köprü (pm-kit'te zaten mevcut)
- **SCEM:** Kesin uygun puanlama kuralı ile ödül dağıtımı
- **Next.js / TypeScript:** AI şeffaflık konsolu ile frontend

---

## Kritik Keşif

pm-kit içinde **çalışan bir LayerZero bridge altyapısı zaten mevcut:**
`BridgeForwarder.sol`, `BridgeReceiver.sol`, `EvmToGenLayer.ts`, `GenLayerToEvm.ts`

Sıfırdan köprü yazmak gerekmez — sadece routing ve konfigürasyon değişikliği yeterlidir.

---

## Repo Yapısı

```
gnothi/ (pm-kit fork)
├── contracts/
│   ├── contracts/
│   │   ├── BetCOFI.sol                  # MODİFİYE: SCEM payout ekle
│   │   ├── BetFactoryCOFI.sol           # MODİFİYE: NEWS tipi + ResolutionRequested + resolveWithResult
│   │   ├── SCEMScoring.sol              # YENİ: saf Solidity SCEM matematik kütüphanesi
│   │   └── interfaces/
│   │       ├── IBetFactoryCOFI.sol      # MODİFİYE: resolveWithResult() ekle
│   │       └── IGenLayerBridge.sol      # YENİ: bridge callback arayüzü
│   ├── scripts/
│   │   ├── deploy-factory.ts            # MODİFİYE: SCEM parametreleriyle deploy
│   │   └── create-bet.ts                # MODİFİYE: question + evidenceUrls alanları
│   └── test/
│       ├── BetFactory.test.ts           # MODİFİYE: NEWS market testleri
│       └── SCEMScoring.test.ts          # YENİ
│
├── bridge/
│   ├── intelligent-contracts/
│   │   ├── NewsOracle.py                # YENİ: Gnothi'nin kalbi (GenLayer akıllı sözleşme)
│   │   └── BridgeSender.py             # DEĞİŞMEZ
│   ├── smart-contracts/
│   │   └── contracts/
│   │       └── BridgeReceiver.sol       # MODİFİYE: resolveWithResult() çağrısı
│   └── service/
│       ├── src/
│       │   ├── relay/
│       │   │   └── EvmToGenLayer.ts     # MODİFİYE: NEWS event routing
│       │   ├── resolution/
│       │   │   └── AutoResolver.ts     # MODİFİYE: NewsOracle routing ekle
│       │   └── config.ts               # MODİFİYE: GenLayer endpoint, oracle adresi
│       └── intelligent-oracles/
│           └── news_pm.py               # YENİ: NewsOracle.py'nin servis kopyası
│
└── frontend/
    ├── src/app/
    │   ├── components/
    │   │   ├── AIConsole/               # YENİ: şeffaflık konsolu (jüri fark ettirici)
    │   │   │   ├── AIConsole.tsx
    │   │   │   └── AIConsole.module.css
    │   │   ├── CreateMarketModal/       # YENİ: question + evidenceUrls alanları
    │   │   │   └── CreateMarketModal.tsx
    │   │   ├── SCEMPayoutBar/           # YENİ: ödül dağılımı görseli
    │   │   │   └── SCEMPayoutBar.tsx
    │   │   └── MarketDetailPanel/       # MODİFİYE: AI Oracle sekmesi ekle
    │   ├── hooks/
    │   │   ├── useAIConsole.ts          # YENİ: GenLayer validator polling
    │   │   └── useSCEM.ts               # YENİ: client-side SCEM hesaplama
    │   └── lib/
    │       ├── scem.ts                  # YENİ: SCEM formülü (JS)
    │       └── genlayer.ts              # YENİ: GenLayer RPC client
    └── ...
```

---

## Geliştirme Fazları

### Faz 0 — Setup (≈ 2 saat)

- [ ] pm-kit'i fork et: `git clone https://github.com/courtofinternet/pm-kit`
- [ ] Tüm modüllerde `npm install`: `contracts/`, `bridge/smart-contracts/`, `bridge/service/`, `frontend/`
- [ ] Mevcut e2e testini geç: `bridge/service/scripts/test-e2e-flow.ts`
- [ ] `.env` dosyalarını doldur:
  - `PRIVATE_KEY`
  - `BASE_SEPOLIA_RPC_URL`
  - `GENLAYER_RPC_URL`
  - `LAYERZERO_ENDPOINT_BASE_SEPOLIA`
- [ ] GenLayer Studio erişimini doğrula (local veya Bradbury Testnet)

**Doğrulama:** `npx hardhat test` geçer, bridge service hatasız başlar.

---

### Faz 1 — NewsOracle.py — EN RİSKLİ ADIM (≈ 4-6 saat)

> ⚡ **Bu adımı önce yap.** Çalışırsa proje yapılabilir; çalışmazsa diğer her şey anlamsız.

**Dosya:** `bridge/intelligent-contracts/NewsOracle.py`

```
Yapılacaklar:
1. gl.nondet.web.render(url, mode="text")  → haber metnini çek
2. gl.exec_prompt(prompt)                  → LLM analizi → {"decision": "SIDE_A"}
3. is_acceptable()                         → strict_eq YERİNE semantik JSON karşılaştırma
4. BridgeSender.py ile sonucu Base'e gönder
```

**Neden `strict_eq` değil `is_acceptable`:**
Farklı LLM'ler aynı kararı farklı formatlarda döndürür (boşluk, satır sonu, markdown fens).
`is_acceptable` sadece JSON'daki `decision` alanını karşılaştırır.

**Prompt mühendisliği kritik:**
- Kullanıcı girdisini `<question>` tagı içine al (prompt injection koruması)
- Sadece JSON formatında dön talimatı ver, açıklama isteme
- Web metnini 3000 karakter ile sınırla

**Test:** GenLayer Studio'da `resolve()` çağır → `market_result` = `SIDE_A` / `SIDE_B` / `UNDECIDED` gelmeli.

---

### Faz 2 — EVM Sözleşmeleri (≈ 5-7 saat)

#### BetFactoryCOFI.sol
```solidity
// Eklenecekler:
enum MarketType { CRYPTO, STOCK, NEWS }

function createNewsBet(
    string memory question,
    string[] memory evidenceUrls,
    uint endDate
) external returns (address);

event ResolutionRequested(
    uint indexed marketId,
    string question,
    string evidenceUrls,
    MarketType marketType
);

function resolveWithResult(uint marketId, uint8 result) external;
// ^ BridgeReceiver.sol tarafından çağrılır
```

#### BetCOFI.sol — SCEM Payout
MVP için **quadratic scoring rule** (logaritma yok, Solidity'de güvenli):

```
S(r, q) = 2q·r - q²
```

- Her pozisyon için `TradeSnapshot { trader, predictedProbability, bondAmount }` kaydet
- Sonuç gelince `applyScemPayout(bool outcome)` çağır

#### SCEMScoring.sol
Pure Solidity kütüphanesi — `BetCOFI.sol` içine import edilir.

#### BridgeReceiver.sol
`_lzReceive` içinde `(marketId, result)` decode et → `resolveWithResult()` çağır.

**Test:** `npx hardhat test contracts/test/SCEMScoring.test.ts`

---

### Faz 3 — Bridge Service (≈ 2-3 saat)

Mevcut altyapı %90 çalışıyor, sadece routing değişikliği:

**EvmToGenLayer.ts:**
- `marketType == NEWS` kontrolü ekle
- NEWS ise `news_pm.py` deploy et, `(marketId, question, evidenceUrls)` ilet

**AutoResolver.ts:**
- `NEWS` tipini routing tablosuna ekle
- `intelligent-oracles/news_pm.py`'ye yönlendir

**config.ts:**
- `GENLAYER_NEWS_ORACLE_ADDRESS` ekle (pre-deploy stratejisi önerilir)
- `NEWS_MARKET_FACTORY_ADDRESS` ekle

**Test:** Değiştirilmiş `test-e2e-flow.ts` ile NEWS market oluştur, GenLayer oracle'ın tetiklendiğini ve sonucun Base'e döndüğünü doğrula.

---

### Faz 4 — Frontend AI Console (≈ 4-5 saat)

#### AIConsole.tsx — Jüriyi Etkileyen Asıl Özellik

```
[Agent 1]  Reuters  tarıyor...    → SIDE_A ✓
[Agent 2]  BBC      tarıyor...    → SIDE_A ✓
[Agent 3]  AP News  tarıyor...    → UNDECIDED ⚠
[Agent 4]  Reuters  tarıyor...    → SIDE_A ✓
[Agent 5]  BBC      tarıyor...    → SIDE_A ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Konsensüs]  4/5  →  SIDE_A  →  KESİNLEŞTİ ✅
```

**Uygulama:** GenLayer RPC'yi 2 sn'de bir poll et (WebSocket gereksiz kompleksilik).
`genlayer.getTransactionByHash(txHash)` → validator detaylarını çek → UI'a yansıt.

#### useAIConsole.ts
- Market `RESOLVING` durumundayken polling başlat
- `FINALIZED` gelince durdur
- Validator listesini agent card modeline dönüştür

#### CreateMarketModal.tsx
- `question` alanı (textarea, NEWS tipi için zorunlu)
- `evidenceUrls` alanı (dinamik URL listesi)
- `marketType` seçici (NEWS / CRYPTO / STOCK)
- NEWS seçilince `createNewsBet()` çağır

#### lib/scem.ts
- Client-side SCEM preview hesaplama
- Kullanıcı probability slider'ı hareket ettirirken anlık "beklenen kazanç" göster

#### MarketDetailPanel.tsx
- "Trade" / **"AI Oracle"** / "History" sekmeleri ekle
- AI Oracle sekmesi `<AIConsole marketId={id} />` render eder

---

### Faz 5 — Integration & Demo (≈ 4-6 saat)

- [ ] Base Sepolia'ya deploy: `contracts/scripts/deploy-factory.ts`
- [ ] Bridge sözleşmelerini deploy ve configure et
- [ ] `NewsOracle.py`'yi GenLayer Bradbury Testnet'e deploy et
- [ ] Bridge service'i deploy edilen adreslerle başlat
- [ ] Canlı demo marketi oluştur (gerçek soru + açık kaynak kanıt URL'leri)
- [ ] `endDate` geçince `resolve_market()` çağır
- [ ] AI Console'u canlı izle
- [ ] SCEM ödül dağıtımını doğrula

**Demo senaryosu (jüri için ~5 dk):**
1. Market oluştur: "X olayı gerçekleşti mi?" (30 sn)
2. İki çelişen tahmin gir (1 dk)
3. Çözüm tetikle
4. AI Console'da 5 validator'ın konsensüse varışını canlı izle (2-3 dk)
5. SCEM ödül dağıtımını göster

---

## Bağımlılık Sırası

```
Faz 0: Setup
    │
    ├──────────────────────────────┐
    ▼                              ▼
Faz 1: NewsOracle.py          Faz 2: BetCOFI.sol + SCEMScoring.sol
(bağımsız, önce başla)             │
    │                              ▼
    │                         BetFactoryCOFI.sol
    │                              │
    │                              ▼
    │                         BridgeReceiver.sol
    │                              │
    └──────────┬───────────────────┘
               ▼
          Faz 3: Bridge Service (iki bağımlılık tamamlandıktan sonra)
               │
               ▼
          Faz 4: Frontend (ABI artifact'ları + GenLayer RPC endpoint gerekli)
               │
               ▼
          Faz 5: Integration
```

---

## Kritik Riskler ve Çözümleri

| Risk | Neden Tehlikeli | Çözüm |
|------|----------------|-------|
| LLM output format tutarsızlığı | `strict_eq` sürekli fail eder | `is_acceptable` ile semantic JSON parse |
| Paywall / bot koruması | LLM'e boş/anlamsız içerik gider | Demo için Reuters, AP, BBC, Wikipedia kullan |
| SCEM log(0) overflow | Solidity'de sonsuz değer | Olasılığı `[0.01, 0.99]`'a sıkıştır |
| GenLayer testnet instability | Demo çöker | Local GenLayer Studio backup hazırla |
| Asenkron gecikme kullanıcı deneyimi | Kullanıcı bekliyor, UI donuk | "Sonuç Bekleniyor" animasyonu + polling |

---

## MVP vs Full Scope

### Hackathon MVP ✅
- `NewsOracle.py` — `is_acceptable` ile çalışan konsensüs
- NEWS market tipi + bridge callback (`resolveWithResult`)
- Basitleştirilmiş SCEM: quadratic scoring (`S(r,q) = 2q·r - q²`)
- Bridge service routing (minimal değişiklik)
- AI Console — canlı validator görünümü
- CreateMarketModal — question + evidenceUrls alanları

### Sonraya Bırak ❌
- ABDKMath64x64 ile tam logaritmik SCEM formülü
- Multi-URL paralel scraping
- XML tag tabanlı prompt injection koruması
- WebSocket real-time AI Console (polling yeterli)
- SCEM score history grafikleri
- Piyasa arama ve kategorileme

---

## Önemli Teknik Kararlar

**1. `is_acceptable` vs `strict_eq`**
`is_acceptable` kullan. `strict_eq` production'da whitespace farkı yüzünden sürekli fail eder.
Semantic JSON karşılaştırma, GenLayer'ın tasarım felsefesini doğru anladığını jüriye kanıtlar.

**2. Pre-deploy vs deploy-on-demand oracle**
Hackathon için tek bir `NewsOracle.py` adresi deploy et, her markete `(marketId, question, url)` gönder.
Market başına yeni sözleşme deploy etme — gas maliyeti ve gecikme artar.

**3. SCEM basitleştirme**
MVP'de quadratic scoring rule kullan: `S(r,q) = 2q·r - q²`
Strictly proper, Solidity integer aritmetiğiyle güvenli, logaritma gerektirmez.
README'de "simplified SCEM" olarak dokümante et.

**4. Frontend polling**
2 saniyelik HTTP polling yeterli. WebSocket için proxy sunucu gerekir — hackathon kapsamını aşar.

---

## Current Repo Reality

As of April 1, 2026, the repo has moved beyond the original plan in a few areas:

- NEWS market creation is implemented on the factory and frontend admin flow.
- SCEM payout is applied on-chain and the frontend now reads real claimable amounts instead of relying only on preview math.
- the bridge service stores GenLayer oracle deployment metadata for the AI console.
- the market detail panel and full-page market view both surface the AI console for NEWS markets.

Still environment-dependent or partially operational:

- live Base Sepolia + GenLayer + LayerZero deployment still depends on correct external configuration
- frontend production builds on Windows can still be affected by locked files from a running dev server
- the bridge service still uses the legacy two-string `resolutionData` model for NEWS payloads, even though it is now documented more clearly

Immediate next priorities:

1. verify one full live NEWS flow against deployed infrastructure
2. replace the legacy NEWS payload naming in relay/oracle code with explicit field names
3. tighten frontend polish around AI console and claim state refresh after transactions
