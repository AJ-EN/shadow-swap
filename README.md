# 🌑 ShadowSwap: Privacy-Preserving Atomic Swaps

**ShadowSwap** is a non-custodial, privacy-first Dark Pool that enables Atomic Swaps between Bitcoin (L1) and Starknet (L2).

Built for the **DoraHacks Re{define} Hackathon** (Privacy & Bitcoin Tracks).

## 🏆 The Problem
- **Bitcoin DeFi is risky:** Bridges like WBTC are centralized custody risks.
- **DEXs trade transparency for privacy:** Your orders, amounts, and strategies are visible to MEV bots.

## 💡 The Solution
ShadowSwap uses **Noir ZK Circuits** to hide order details (Amount, Price) and **HTLCs (Hash Time Locked Contracts)** to settle trades natively on Bitcoin.
- **Zero Custody:** Funds never leave your wallet until the swap is atomic.
- **Zero Knowledge:** The blockchain verifies the trade without knowing the amount.

## 🏗 Architecture
- **Starknet:** Acts as the coordination layer and verifies ZK proofs.
- **Bitcoin:** Acts as the settlement layer (HTLC).
- **Noir:** Generates proofs of "Solvency and Intent" without revealing values.
- **Garaga:** Verifies Noir proofs efficiently on Starknet.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Scarb (Cairo Package Manager)
- Nargo (Noir Toolchain) v1.0.0-beta.18
- Bitcoin Core (or Mutinynet access)

### 1. Installation
```bash
git clone [https://github.com/YOUR_USERNAME/shadow_swap.git](https://github.com/YOUR_USERNAME/shadow_swap.git)
cd shadow_swap

# Install Dependencies
npm install
cd client && npm install