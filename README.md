# ShadowSwap

Privacy-preserving BTC/USDC atomic swaps across Bitcoin and Starknet.

ShadowSwap targets the Starknet Re{define} Hackathon narratives:
- `Privacy`: zero-knowledge commitments + dark-pool style order flow
- `Bitcoin`: native HTLC settlement for trust-minimized BTC execution

## What the project does

ShadowSwap coordinates a cross-chain atomic swap:
1. Seller (Alice) generates a secret `S` and hash `H = SHA256(S)`.
2. Alice locks BTC into a Bitcoin HTLC keyed by `H`.
3. Alice creates a Starknet order locking USDC-side settlement terms.
4. When `S` is revealed on Starknet, Bob can claim BTC on Bitcoin.
5. If swap conditions fail, HTLC timeout path enables refund.

This design keeps custody with users while linking chain state through the same cryptographic secret.

## Repository layout

```text
frontend/                Next.js UI + Starknet wallet integration
backend/client/          TypeScript HTLC library + deterministic tests
backend/scripts/         Demo and manual BTC testnet helper scripts
backend/contracts/       Cairo DarkPool contract
backend/circuits/        Noir/Garaga proof components
```

## Prerequisites

- Node.js `>=20`
- npm `>=10`
- (Optional) `scarb` for Cairo compile/test
- (Optional) `nargo` for Noir circuits

## Quick start

### 1) Install dependencies

```bash
cd backend && npm install
cd client && npm install
cd ../../frontend && npm install
```

### 2) Configure environment

```bash
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Set deployed Starknet contract addresses in `frontend/.env.local`:
- `NEXT_PUBLIC_DARKPOOL_ADDRESS`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`

### 3) Run checks

```bash
cd backend/client && npm run check
cd ../../frontend && npm run check
```

### 4) Run local demo flows

```bash
cd backend/client && npm run demo
cd ../ && npm run demo
cd ../../frontend && npm run dev
```

## Security and engineering practices applied

- Strict runtime validation in HTLC client (txid, amounts, keys, address, timeout).
- Secure randomness for secret generation (`crypto.randomBytes`).
- Deterministic assertion-based tests using `node:test`.
- CI pipeline for backend client and frontend checks:
  - `.github/workflows/ci.yml`
- Environment templates for reproducible setup:
  - `frontend/.env.example`
  - `backend/.env.example`

## Hackathon submission checklist

- [ ] Working demo deployed on Starknet (testnet/mainnet)
- [x] Public GitHub repository
- [ ] Project description (<= 500 words)
- [ ] 3-minute demo video
- [ ] Starknet wallet address for prize distribution

## Notes

- `frontend` currently simulates order book/demo progression for presentation.
- `backend/client` is the most production-hardened module in this repo and should be used as the reference integration layer.
- Cairo/Noir toolchains are optional locally; if missing, frontend + TypeScript checks still run.
