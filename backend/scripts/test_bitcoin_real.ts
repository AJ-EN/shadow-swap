/**
 * ShadowSwap Bitcoin Testnet Test
 * 
 * This script generates a real HTLC that can be funded on Mutinynet (Bitcoin Signet).
 * 
 * Run: npx ts-node scripts/test_bitcoin_real.ts
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as crypto from 'crypto';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Mutinynet uses testnet network params
const network = bitcoin.networks.testnet;

function main() {
    console.log("═".repeat(60));
    console.log("  🕵️‍♀️ SHADOWSWAP BITCOIN TESTNET TEST 🕵️‍♀️");
    console.log("═".repeat(60));

    // 1. Generate Keys for Alice (Seller) and Bob (Buyer)
    console.log("\n📝 Generating keypairs...\n");
    const alice = ECPair.makeRandom({ network });
    const bob = ECPair.makeRandom({ network });

    console.log("Alice (Seller - can refund after timeout):");
    console.log(`  Public Key: ${Buffer.from(alice.publicKey).toString('hex')}`);
    console.log(`  Private Key (WIF): ${alice.toWIF()}`);

    console.log("\nBob (Buyer - can claim with secret):");
    console.log(`  Public Key: ${Buffer.from(bob.publicKey).toString('hex')}`);
    console.log(`  Private Key (WIF): ${bob.toWIF()}`);

    // 2. Generate the Secret
    const secret = crypto.randomBytes(32);
    const secretHash = crypto.createHash('sha256').update(secret).digest();

    console.log("\n🔐 Secret Generation:");
    console.log(`  Secret (Hex):      ${secret.toString('hex')}`);
    console.log(`  Secret Hash (H):   ${secretHash.toString('hex')}`);

    // 3. Create HTLC Script (The "Vault")
    // Script Logic:
    // IF (SHA256(preimage) == hash) -> Bob can claim with signature
    // ELSE (after 10 blocks CSV timeout) -> Alice can refund with signature

    const timeout = 10; // 10 blocks CSV timeout
    const timeoutBuffer = bitcoin.script.number.encode(timeout);

    const lockingScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_IF,
        bitcoin.opcodes.OP_SHA256,
        secretHash,
        bitcoin.opcodes.OP_EQUALVERIFY,
        bob.publicKey,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_ELSE,
        timeoutBuffer,
        bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
        bitcoin.opcodes.OP_DROP,
        alice.publicKey,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_ENDIF,
    ]);

    // 4. Generate P2WSH Address
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: lockingScript, network },
        network,
    });

    console.log("\n📜 HTLC Script:");
    console.log(`  ASM: ${bitcoin.script.toASM(lockingScript)}`);
    console.log(`  Hex: ${Buffer.from(lockingScript).toString('hex')}`);

    console.log("\n" + "═".repeat(60));
    console.log("  💰 ACTION REQUIRED 💰");
    console.log("═".repeat(60));
    console.log("\n1. Go to: https://faucet.mutinynet.com/");
    console.log(`\n2. Send 10,000 sats to this address:\n   ${p2wsh.address}`);
    console.log("\n3. Wait for 1 confirmation.");
    console.log("\n4. Check the transaction on explorer:");
    console.log(`   https://mutinynet.com/address/${p2wsh.address}`);

    console.log("\n" + "═".repeat(60));
    console.log("  🛠 SAVE THIS DATA FOR REDEEM/REFUND 🛠");
    console.log("═".repeat(60));

    // Save all data needed for redemption
    const redeemData = {
        network: "mutinynet (signet/testnet params)",
        htlc: {
            address: p2wsh.address,
            redeemScriptHex: Buffer.from(lockingScript).toString('hex'),
            witnessScriptHash: p2wsh.hash ? Buffer.from(p2wsh.hash).toString('hex') : undefined,
        },
        secret: {
            preimage: secret.toString('hex'),
            hash: secretHash.toString('hex'),
        },
        alice: {
            publicKey: Buffer.from(alice.publicKey).toString('hex'),
            privateKeyWIF: alice.toWIF(),
        },
        bob: {
            publicKey: Buffer.from(bob.publicKey).toString('hex'),
            privateKeyWIF: bob.toWIF(),
        },
        timeout: {
            blocks: timeout,
            note: "Alice can refund after 10 blocks if Bob doesn't claim",
        },
    };

    console.log("\n" + JSON.stringify(redeemData, null, 2));

    // Save to file for later use
    const fs = require('fs');
    const dataPath = './htlc_data.json';
    fs.writeFileSync(dataPath, JSON.stringify(redeemData, null, 2));
    console.log(`\n✅ Data saved to: ${dataPath}`);

    console.log("\n" + "═".repeat(60));
    console.log("  📋 NEXT STEPS");
    console.log("═".repeat(60));
    console.log("\nAfter funding, run the redeem script:");
    console.log("  npx ts-node scripts/redeem_htlc.ts <TXID> <VOUT> <AMOUNT_SATS>");
    console.log("\nExample:");
    console.log("  npx ts-node scripts/redeem_htlc.ts abc123...def 0 10000");
    console.log("");
}

main();
