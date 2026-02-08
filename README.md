# ShadowSwap

A privacy-preserving Bitcoin Dark Pool on Starknet.

## Overview

ShadowSwap enables private, trustless Bitcoin trading using zero-knowledge proofs. The system leverages:

- **Noir** for ZK circuit development
- **Barretenberg** for proof generation
- **Starknet (Cairo)** for on-chain settlement and order matching
- **Bitcoin** for final asset settlement

## Project Structure

```
shadow_swap/
├── circuits/       # Noir ZK circuits (Nargo project)
├── contracts/      # Starknet smart contracts (Scarb/Cairo)
├── client/         # Node.js/Next.js client for Bitcoin logic
└── scripts/        # Utility scripts
```

## Required Versions

> ⚠️ **IMPORTANT**: Ensure you have the exact versions below to avoid compatibility issues.

| Tool           | Version           | Installation                                      |
|----------------|-------------------|---------------------------------------------------|
| **Noir**       | `1.0.0-beta.18`   | `noirup -v 1.0.0-beta.18`                         |
| **Barretenberg (bb)** | `0.67.0`   | `bbup -v 0.67.0`                                  |
| **Scarb**      | Latest stable     | [Installation Guide](https://docs.swmansion.com/scarb/download) |
| **Node.js**    | `>=18.0.0`        | [nodejs.org](https://nodejs.org)                  |

## Quick Start

### 1. Install Noir & Barretenberg

```bash
# Install noirup (Noir version manager)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup -v 1.0.0-beta.18

# Install bbup (Barretenberg version manager)
curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/master/barretenberg/bbup/install | bash
bbup -v 0.67.0
```

### 2. Build Circuits

```bash
cd circuits
nargo build
```

### 3. Generate Proofs

```bash
cd circuits
bb prove -b ./target/shadow_circuit.json -w ./target/shadow_circuit.gz -o ./target/proof
```

## License

MIT
