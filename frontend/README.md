# ShadowSwap Frontend

Next.js interface for the ShadowSwap Starknet + Bitcoin atomic swap demo.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set:
- `NEXT_PUBLIC_DARKPOOL_ADDRESS`
- `NEXT_PUBLIC_VERIFIER_ADDRESS`

## Scripts

- `npm run dev`: local development server
- `npm run lint`: lint checks
- `npm run build:webpack`: production build using webpack (stable for sandboxed environments)
- `npm run check`: lint + webpack build
