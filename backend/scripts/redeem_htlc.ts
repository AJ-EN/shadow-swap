/**
 * ShadowSwap HTLC Redeem Script
 * 
 * This script redeems funds from a funded HTLC using the secret.
 * 
 * Usage: npx ts-node scripts/redeem_htlc.ts <TXID> <VOUT> <AMOUNT_SATS>
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import * as fs from 'fs';
import * as path from 'path';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const network = bitcoin.networks.testnet;
const DEFAULT_DATA_PATH = path.join(__dirname, '..', 'tmp', 'htlc_data.json');

function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
    let buffer = Buffer.allocUnsafe(0);

    function writeVarInt(n: number): Buffer {
        if (n < 0xfd) {
            return Buffer.from([n]);
        } else if (n <= 0xffff) {
            const buf = Buffer.allocUnsafe(3);
            buf.writeUInt8(0xfd, 0);
            buf.writeUInt16LE(n, 1);
            return buf;
        } else if (n <= 0xffffffff) {
            const buf = Buffer.allocUnsafe(5);
            buf.writeUInt8(0xfe, 0);
            buf.writeUInt32LE(n, 1);
            return buf;
        } else {
            const buf = Buffer.allocUnsafe(9);
            buf.writeUInt8(0xff, 0);
            buf.writeUInt32LE(n >>> 0, 1);
            buf.writeUInt32LE((n / 0x100000000) | 0, 5);
            return buf;
        }
    }

    function writeVarSlice(slice: Buffer): Buffer {
        return Buffer.concat([writeVarInt(slice.length), slice]);
    }

    buffer = Buffer.concat([buffer, writeVarInt(witness.length)]);
    for (const w of witness) {
        buffer = Buffer.concat([buffer, writeVarSlice(w)]);
    }

    return buffer;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.log("Usage: npx ts-node scripts/redeem_htlc.ts <TXID> <VOUT> <AMOUNT_SATS>");
        console.log("Example: npx ts-node scripts/redeem_htlc.ts abc123...def 0 10000");
        process.exit(1);
    }

    const [txid, voutStr, amountStr] = args;
    const vout = parseInt(voutStr, 10);
    const amount = parseInt(amountStr, 10);

    console.log("═".repeat(60));
    console.log("  🔓 SHADOWSWAP HTLC REDEEM 🔓");
    console.log("═".repeat(60));

    // Load HTLC data
    const dataPath = process.env.HTLC_DATA_PATH || DEFAULT_DATA_PATH;
    if (!fs.existsSync(dataPath)) {
        console.error(`❌ Error: HTLC data file not found at ${dataPath}. Run test_bitcoin_real.ts first.`);
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log("\n📂 Loaded HTLC data from:", dataPath);

    // Parse data
    const secret = Buffer.from(data.secret.preimage, 'hex');
    const redeemScript = Buffer.from(data.htlc.redeemScriptHex, 'hex');
    const bobKeyPair = ECPair.fromWIF(data.bob.privateKeyWIF, network);

    // Create P2WSH payment
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: redeemScript, network },
        network,
    });

    // Generate Bob's destination address (simple P2WPKH)
    const bobDestination = bitcoin.payments.p2wpkh({
        pubkey: bobKeyPair.publicKey,
        network,
    }).address!;

    console.log("\n📝 Transaction Details:");
    console.log(`  Input TXID: ${txid}`);
    console.log(`  Input Vout: ${vout}`);
    console.log(`  Input Amount: ${amount} sats`);
    console.log(`  Destination: ${bobDestination}`);

    // Calculate fee and output
    const fee = 500; // Conservative fee for testnet
    const outputAmount = amount - fee;

    if (outputAmount <= 0) {
        console.error(`❌ Error: Output amount (${outputAmount}) must be positive`);
        process.exit(1);
    }

    console.log(`  Fee: ${fee} sats`);
    console.log(`  Output Amount: ${outputAmount} sats`);

    // Build the transaction
    const psbt = new bitcoin.Psbt({ network });

    psbt.addInput({
        hash: txid,
        index: vout,
        witnessUtxo: {
            script: p2wsh.output!,
            value: amount,
        },
        witnessScript: redeemScript,
    });

    psbt.addOutput({
        address: bobDestination,
        value: outputAmount,
    });

    // Sign the input
    psbt.signInput(0, bobKeyPair);

    // Finalize with custom witness stack for OP_IF (claim) branch
    psbt.finalizeInput(0, (_inputIndex: number, input: { partialSig?: Array<{ signature: Buffer }> }) => {
        const partialSig = input.partialSig?.[0];
        if (!partialSig) {
            throw new Error('No signature found');
        }

        // Witness stack for claim: [signature, secret, TRUE, redeemScript]
        const witness = [
            partialSig.signature,
            secret,
            Buffer.from([0x01]), // TRUE for OP_IF branch
            redeemScript,
        ];

        return {
            finalScriptSig: Buffer.alloc(0),
            finalScriptWitness: witnessStackToScriptWitness(witness),
        };
    });

    // Extract the final transaction
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();

    console.log("\n" + "═".repeat(60));
    console.log("  ✅ TRANSACTION READY");
    console.log("═".repeat(60));
    console.log(`\nTxID: ${tx.getId()}`);
    console.log(`Size: ${txHex.length / 2} bytes`);

    console.log("\n📤 Raw Transaction Hex:");
    console.log(txHex);

    console.log("\n" + "═".repeat(60));
    console.log("  📡 BROADCAST TRANSACTION");
    console.log("═".repeat(60));
    console.log("\nOption 1: Use Mutinynet API");
    console.log(`  curl -X POST "https://mutinynet.com/api/tx" -d "${txHex}"`);

    console.log("\nOption 2: Use the web interface");
    console.log("  https://mutinynet.com/tx/push");
    console.log("  Paste the raw hex above and click 'Broadcast'");

    console.log("\n🎉 After broadcasting, check your transaction at:");
    console.log(`  https://mutinynet.com/tx/${tx.getId()}`);
    console.log("");
}

main().catch(console.error);
