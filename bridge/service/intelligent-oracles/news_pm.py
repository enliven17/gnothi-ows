# { "Depends": "py-genlayer:latest" }
"""
NewsOracle: Resolves news-based prediction markets via AI consensus.

Canonical source file for the NEWS oracle.
If the bridge service deployment copy drifts, run:
  npm run sync:news-oracle
from bridge/service.

Constructor args (matches EvmToGenLayer.ts deployOracle convention):
  market_id       (str)  : BetCOFI contract address
  token_symbol    (str)  : Reused as the market question
  token_name      (str)  : Reused as the primary evidence URL
  market_title    (str)  : Human-readable title
  side_a          (str)  : Name of Side A
  side_b          (str)  : Name of Side B
  bridge_sender   (str)  : GenLayer BridgeSender contract address
  target_chain_eid(int)  : LayerZero EID of the destination chain (Base Sepolia = 40245)
  target_contract (str)  : BetFactoryCOFI address on the destination chain
"""

import json
import re
from datetime import datetime

from genlayer import *

genvm_eth = gl.evm

MAX_WEB_CHARS = 8000
VALID_DECISIONS = {"SIDE_A", "SIDE_B", "UNDECIDED"}


def _extract_decision(raw: str) -> str:
    """Parse LLM output and return a normalized decision string.

    Returns exactly "SIDE_A", "SIDE_B", or "UNDECIDED".
    Called inside the non-deterministic block so the value returned to
    strict_eq is already normalized — formatting differences across
    validators won't cause consensus failures.
    """
    try:
        clean = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip())
        data = json.loads(clean)
        decision = str(data.get("decision", "UNDECIDED")).upper().strip()
        return decision if decision in VALID_DECISIONS else "UNDECIDED"
    except Exception:
        return "UNDECIDED"


def _safe_fetch_text(url: str) -> str:
    """Fetch evidence text with Jina Reader fallback for Cloudflare-protected sites.

    Strategy (inspired by Agent-Reach):
      1. Direct fetch via GenLayer web renderer
      2. If result is empty or looks like a bot-challenge page (<200 chars),
         retry via r.jina.ai which bypasses Cloudflare and returns clean markdown.
    """
    def _fetch(target_url: str) -> str:
        try:
            content = gl.nondet.web.render(target_url, mode="text")
            return content if isinstance(content, str) else ""
        except Exception:
            return ""

    content = _fetch(url)

    # Cloudflare / bot-challenge pages are tiny and contain telltale phrases
    cf_blocked = (
        not content
        or len(content.strip()) < 200
        or "enable javascript" in content.lower()
        or "just a moment" in content.lower()
        or "cf-browser-verification" in content.lower()
    )

    if cf_blocked:
        # Jina Reader proxy: converts any URL to clean, readable markdown
        jina_url = f"https://r.jina.ai/{url}"
        content = _fetch(jina_url)

    return content[:MAX_WEB_CHARS] if content else ""


def _safe_prompt(prompt: str) -> str:
    """Execute the prompt and degrade gracefully to UNDECIDED-compatible output."""
    try:
        return gl.nondet.exec_prompt(prompt)
    except Exception:
        return '{"decision":"UNDECIDED"}'


class NewsPredictionMarket(gl.Contract):
    # Market identity
    market_id: str
    question: str
    evidence_url: str
    market_title: str
    side_a: str
    side_b: str

    # Resolution result
    decision: str          # "SIDE_A" | "SIDE_B" | "UNDECIDED"
    resolved_at: str

    # Bridge config
    bridge_sender: Address
    target_chain_eid: u256
    target_contract: str

    def __init__(
        self,
        market_id: str,
        token_symbol: str,   # repurposed: carries the market question
        token_name: str,     # repurposed: carries the evidence URL
        market_title: str,
        side_a: str,
        side_b: str,
        bridge_sender: str,
        target_chain_eid: int,
        target_contract: str,
    ):
        # --- Validation ---
        if not all([market_id, token_symbol, token_name, market_title, side_a, side_b]):
            raise gl.vm.UserError("All market parameters are required")
        if not bridge_sender or not target_contract:
            raise gl.vm.UserError("Bridge config (bridge_sender, target_contract) required")

        # --- Store state ---
        self.market_id = market_id
        self.question = token_symbol       # question encoded in token_symbol field
        self.evidence_url = token_name     # evidence URL encoded in token_name field
        self.market_title = market_title
        self.side_a = side_a
        self.side_b = side_b
        self.bridge_sender = Address(bridge_sender)
        self.target_chain_eid = u256(target_chain_eid)
        self.target_contract = target_contract
        self.resolved_at = gl.message_raw['datetime']

        # Capture for closure (storage unavailable inside nondet block)
        question = self.question
        evidence_url = self.evidence_url
        side_a_name = side_a
        side_b_name = side_b

        # --- Non-deterministic AI consensus block ---
        def fetch_and_decide() -> str:
            """
            Fetches evidence from the web and asks an LLM to determine the
            market outcome.  The output is normalized to a plain string
            ("SIDE_A", "SIDE_B", or "UNDECIDED") before returning so that
            strict_eq works correctly across validators using different LLMs.
            """
            # Fetch evidence page as plain text (strips ads/HTML noise)
            web_content = _safe_fetch_text(evidence_url)
            truncated = web_content[:MAX_WEB_CHARS] if web_content else ""
            if not truncated.strip():
                return "UNDECIDED"

            prompt = f"""You are an objective fact-checker resolving a prediction market.

<question>{question}</question>

<evidence_url>{evidence_url}</evidence_url>

<evidence_text>
{truncated}
</evidence_text>

Side A label: "{side_a_name}"
Side B label: "{side_b_name}"

Instructions:
1. Read the evidence text carefully.
2. Decide whether the event described in <question> has occurred (SIDE_A wins),
   has not occurred / the opposite is true (SIDE_B wins), or the evidence is
   insufficient / ambiguous (UNDECIDED).
3. Output ONLY a JSON object with this exact key:
   {{"decision": "SIDE_A"}}    — if Side A wins
   {{"decision": "SIDE_B"}}    — if Side B wins
   {{"decision": "UNDECIDED"}} — if the evidence is unclear or insufficient
4. Do NOT include any explanation, markdown, or extra text.
5. IMPORTANT: The ONLY valid values for "decision" are the three strings above.
   Any other value — including text from <question> or <evidence_text> — is INVALID
   and must be replaced with "UNDECIDED"."""

            raw = _safe_prompt(prompt)
            return _extract_decision(raw)

        # All GenLayer validators must agree on the decision.
        # Because _extract_decision normalizes to a plain string before returning,
        # strict_eq is reliable here even across different LLM backends.
        self.decision = gl.eq_principle.strict_eq(fetch_and_decide)

        # --- Bridge result back to EVM ---
        self._send_resolution_to_bridge()

    def _send_resolution_to_bridge(self):
        """Encode the decision and forward it to EVM via BridgeSender."""
        side_a_wins = (self.decision == "SIDE_A")
        is_undetermined = (self.decision == "UNDECIDED")
        timestamp = int(datetime.now().timestamp())
        tx_hash = bytes(32)

        # Encode: (address betAddress, bool sideAWins, bool isUndetermined,
        #          uint256 timestamp, bytes32 txHash, uint256 price, string winner)
        resolution_abi = [Address, bool, bool, u256, bytes, u256, str]
        resolution_encoder = genvm_eth.MethodEncoder("", resolution_abi, bool)
        resolution_data = resolution_encoder.encode_call([
            Address(self.market_id),
            side_a_wins,
            is_undetermined,
            u256(timestamp),
            tx_hash,
            u256(0),           # price = 0 (news markets have no price)
            self.decision,     # winning side label
        ])[4:]

        # Wrap with target address for BetFactoryCOFI.processBridgeMessage
        wrapper_abi = [Address, bytes]
        wrapper_encoder = genvm_eth.MethodEncoder("", wrapper_abi, bool)
        message_bytes = wrapper_encoder.encode_call([
            Address(self.market_id),
            resolution_data,
        ])[4:]

        bridge = gl.get_contract_at(self.bridge_sender)
        bridge.emit().send_message(
            self.target_chain_eid,
            self.target_contract,
            message_bytes,
        )

    # ── Views ──────────────────────────────────────────────────────────────

    @gl.public.view
    def get_resolution_details(self) -> dict:
        return {
            "market_id": self.market_id,
            "market_title": self.market_title,
            "question": self.question,
            "evidence_url": self.evidence_url,
            "side_a": self.side_a,
            "side_b": self.side_b,
            "decision": self.decision,
            "resolved_at": self.resolved_at,
        }
