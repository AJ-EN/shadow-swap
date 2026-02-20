# Hackathon Submission Template

Use this template when submitting ShadowSwap to the Starknet Re{define} Hackathon.

## Project description (<= 500 words)

ShadowSwap is a privacy-preserving cross-chain settlement protocol for BTC/USDC swaps using Bitcoin HTLCs and Starknet coordination.

Most BTC DeFi flows rely on custodial wrappers or transparent order flow. ShadowSwap addresses both issues:
1. Atomic settlement via Bitcoin HTLCs avoids custody bridges.
2. Starknet-side workflow supports private order intent and ZK-verifiable commitments.

Flow:
1. Seller generates secret `S` and hash `H = SHA256(S)`.
2. Seller locks BTC in an HTLC on Bitcoin keyed to `H`.
3. Seller creates an order on Starknet using the same hash `H`.
4. Secret revelation finalizes claim path for the counterparty.
5. Refund path exists after timelock expiry for incomplete swaps.

The same secret hash binds both chains, which removes trusted intermediaries and enables trust-minimized settlement.

What we built:
- HTLC construction and spend/refund transaction module in TypeScript.
- Deterministic test suite for HTLC safety invariants and spend correctness.
- Starknet frontend with wallet connectivity and protocol visualization.
- Cairo dark pool contract scaffold for order lifecycle and event-based coordination.

Why Starknet:
- STARK-based proving stack aligns with privacy-first roadmap.
- Bitcoin narrative fit through native HTLC flows and trust-minimized BTC integration.
- Strong ecosystem support for ZK tooling and contract verification.

Current status:
- Local frontend and HTLC client checks pass.
- CI pipeline validates frontend + backend client on every push.
- Environment templates and setup docs included for fast reproducibility.

Next milestones:
- Deploy DarkPool + verifier contracts on Sepolia.
- Wire frontend order creation to on-chain contract calls.
- Publish live testnet demo and walkthrough video.

## Demo video outline (3 minutes)

1. Problem statement (15s)
2. Architecture diagram (30s)
3. Live frontend walkthrough (45s)
4. HTLC claim/refund demo (45s)
5. Security and privacy properties (30s)
6. Closing + roadmap (15s)
