/**
 * ShadowSwap Bitcoin HTLC Module
 * 
 * Implements Hash Time Locked Contracts for atomic swaps.
 * - Path A (Happy): Buyer claims with preimage S where SHA256(S) = H
 * - Path B (Refund): Seller reclaims after timelock expires
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { randomBytes } from 'crypto';

// Initialize ECC library for bitcoinjs-lib
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// Network configuration (testnet for development)
const TESTNET = bitcoin.networks.testnet;
const MAX_TIMEOUT = 0xFFFFFF;
const HEX_RE = /^[0-9a-fA-F]+$/;

function toBuffer(input: string | Buffer, inputName: string): Buffer {
    if (Buffer.isBuffer(input)) {
        return input;
    }

    if (input.length === 0) {
        throw new Error(`${inputName} cannot be empty`);
    }
    if (input.length % 2 !== 0 || !HEX_RE.test(input)) {
        throw new Error(`${inputName} must be a valid even-length hex string`);
    }
    return Buffer.from(input, 'hex');
}

function assertBufferLength(buf: Buffer, expectedLength: number, inputName: string): void {
    if (buf.length !== expectedLength) {
        throw new Error(`Invalid ${inputName} length: expected ${expectedLength} bytes, got ${buf.length}`);
    }
}

function assertIntegerRange(value: number, inputName: string, min: number, max: number): void {
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`Invalid ${inputName}: expected integer in [${min}, ${max}], got ${value}`);
    }
}

function assertValidTxInput(prevTxId: string, prevIndex: number, amountSats: number, feeSats: number): void {
    if (!HEX_RE.test(prevTxId) || prevTxId.length !== 64) {
        throw new Error('Invalid prevTxId: expected a 32-byte hex string');
    }
    assertIntegerRange(prevIndex, 'prevIndex', 0, Number.MAX_SAFE_INTEGER);
    assertIntegerRange(amountSats, 'amountSats', 1, Number.MAX_SAFE_INTEGER);
    assertIntegerRange(feeSats, 'feeSats', 1, Number.MAX_SAFE_INTEGER);
    if (feeSats >= amountSats) {
        throw new Error(`feeSats (${feeSats}) must be lower than amountSats (${amountSats})`);
    }
}

function assertValidAddress(address: string, network: bitcoin.Network): void {
    try {
        bitcoin.address.toOutputScript(address, network);
    } catch {
        throw new Error(`Invalid destination address for selected network: ${address}`);
    }
}

function createKeyPair(privateKey: Buffer, network: bitcoin.Network) {
    assertBufferLength(privateKey, 32, 'private key');
    try {
        return ECPair.fromPrivateKey(privateKey, { network });
    } catch {
        throw new Error('Invalid private key');
    }
}

/**
 * Result of HTLC generation
 */
export interface HTLCResult {
    /** Human-readable ASM representation of the script */
    asm: string;
    /** P2WSH address (SegWit) for the HTLC */
    address: string;
    /** Hex-encoded redeem script */
    redeemScriptHex: string;
    /** Raw redeem script buffer */
    redeemScript: Buffer;
    /** Witness script hash */
    witnessScriptHash: Buffer;
}

/**
 * Generates a Hash Time Locked Contract (HTLC) for atomic swaps.
 * 
 * Script Logic:
 * ```
 * OP_IF
 *   OP_SHA256 <secretHash> OP_EQUALVERIFY <buyerPubKey> OP_CHECKSIG
 * OP_ELSE
 *   <timeout> OP_CHECKSEQUENCEVERIFY OP_DROP <sellerPubKey> OP_CHECKSIG
 * OP_ENDIF
 * ```
 * 
 * @param secretHash - SHA256 hash of the secret preimage (32 bytes hex)
 * @param buyerPubKey - Buyer's compressed public key (33 bytes hex)
 * @param sellerPubKey - Seller's compressed public key (33 bytes hex)
 * @param timeout - Relative timelock in blocks (e.g., 144 for ~1 day)
 * @param network - Bitcoin network (default: testnet)
 * @returns HTLC result with ASM, address, and redeem script
 */
export function generateHTLC(
    secretHash: string | Buffer,
    buyerPubKey: string | Buffer,
    sellerPubKey: string | Buffer,
    timeout: number,
    network: bitcoin.Network = TESTNET
): HTLCResult {
    // Convert inputs to Buffers
    const secretHashBuf = toBuffer(secretHash, 'secretHash');
    const buyerPubKeyBuf = toBuffer(buyerPubKey, 'buyerPubKey');
    const sellerPubKeyBuf = toBuffer(sellerPubKey, 'sellerPubKey');

    // Validate inputs
    assertBufferLength(secretHashBuf, 32, 'secret hash');
    assertBufferLength(buyerPubKeyBuf, 33, 'buyer public key');
    assertBufferLength(sellerPubKeyBuf, 33, 'seller public key');
    if (!ecc.isPoint(buyerPubKeyBuf)) {
        throw new Error('Invalid buyer public key: not a valid secp256k1 point');
    }
    if (!ecc.isPoint(sellerPubKeyBuf)) {
        throw new Error('Invalid seller public key: not a valid secp256k1 point');
    }
    assertIntegerRange(timeout, 'timeout', 1, MAX_TIMEOUT);

    // Encode timeout as a minimal script number
    const timeoutBuffer = encodeScriptNumber(timeout);

    // Build the HTLC redeem script
    // OP_IF
    //   OP_SHA256 <secretHash> OP_EQUALVERIFY <buyerPubKey> OP_CHECKSIG
    // OP_ELSE
    //   <timeout> OP_CHECKSEQUENCEVERIFY OP_DROP <sellerPubKey> OP_CHECKSIG
    // OP_ENDIF
    const redeemScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_IF,
        bitcoin.opcodes.OP_SHA256,
        secretHashBuf,
        bitcoin.opcodes.OP_EQUALVERIFY,
        buyerPubKeyBuf,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_ELSE,
        timeoutBuffer,
        bitcoin.opcodes.OP_CHECKSEQUENCEVERIFY,
        bitcoin.opcodes.OP_DROP,
        sellerPubKeyBuf,
        bitcoin.opcodes.OP_CHECKSIG,
        bitcoin.opcodes.OP_ENDIF,
    ]);

    // Create P2WSH (Pay-to-Witness-Script-Hash) output
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: redeemScript, network },
        network,
    });

    if (!p2wsh.address || !p2wsh.hash) {
        throw new Error('Failed to generate P2WSH address');
    }

    // Generate human-readable ASM
    const asm = bitcoin.script.toASM(redeemScript);

    return {
        asm,
        address: p2wsh.address,
        redeemScriptHex: redeemScript.toString('hex'),
        redeemScript,
        witnessScriptHash: p2wsh.hash,
    };
}

/**
 * Result of a redeem/refund transaction
 */
export interface RedeemTxResult {
    /** Raw transaction hex for broadcasting */
    txHex: string;
    /** Transaction ID (txid) */
    txId: string;
    /** Transaction object for inspection */
    tx: bitcoin.Transaction;
}

/**
 * Creates a transaction to REDEEM (claim) funds from an HTLC.
 * This is used by the BUYER (Bob) to claim funds by revealing the secret.
 * 
 * Witness Stack for P2WSH OP_IF branch:
 * [ <BobSignature>, <Secret>, <TRUE/0x01>, <RedeemScript> ]
 * 
 * @param prevTxId - Transaction ID where funds are locked
 * @param prevIndex - Output index (vout) of the locked funds
 * @param amountSats - Amount locked in satoshis
 * @param privateKey - Buyer's private key (hex or Buffer)
 * @param secret - The preimage that solves the hash lock (hex or Buffer)
 * @param redeemScript - The HTLC redeem script (hex or Buffer)
 * @param destinationAddress - Where to send the claimed funds
 * @param feeSats - Transaction fee in satoshis (default: 500)
 * @param network - Bitcoin network (default: testnet)
 * @returns Transaction ready for broadcast
 */
export function createRedeemTx(
    prevTxId: string,
    prevIndex: number,
    amountSats: number,
    privateKey: string | Buffer,
    secret: string | Buffer,
    redeemScript: string | Buffer,
    destinationAddress: string,
    feeSats: number = 500,
    network: bitcoin.Network = TESTNET
): RedeemTxResult {
    // Convert inputs to proper formats
    const privateKeyBuf = toBuffer(privateKey, 'privateKey');
    const secretBuf = toBuffer(secret, 'secret');
    const redeemScriptBuf = toBuffer(redeemScript, 'redeemScript');

    // Create keypair from private key
    const keyPair = createKeyPair(privateKeyBuf, network);

    // Validate secret length (should be 32 bytes for SHA256 preimage)
    assertBufferLength(secretBuf, 32, 'secret');
    if (redeemScriptBuf.length === 0) {
        throw new Error('redeemScript cannot be empty');
    }
    assertValidTxInput(prevTxId, prevIndex, amountSats, feeSats);
    assertValidAddress(destinationAddress, network);

    // Calculate output amount (input - fee)
    const outputAmount = amountSats - feeSats;

    // Create the P2WSH payment to get the witness script hash
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: redeemScriptBuf, network },
        network,
    });
    if (!p2wsh.output) {
        throw new Error('Failed to derive P2WSH output script');
    }

    // Build the transaction
    const psbt = new bitcoin.Psbt({ network });

    // Add input (the HTLC output we're spending)
    psbt.addInput({
        hash: prevTxId,
        index: prevIndex,
        witnessUtxo: {
            script: p2wsh.output!,
            value: amountSats,
        },
        witnessScript: redeemScriptBuf,
    });

    // Add output (destination for claimed funds)
    psbt.addOutput({
        address: destinationAddress,
        value: outputAmount,
    });

    // Sign the input
    // For custom scripts, we need to use signInput with custom sighash
    psbt.signInput(0, keyPair);

    // Finalize with custom witness stack
    psbt.finalizeInput(0, (_inputIndex: number, input: { partialSig?: Array<{ signature: Buffer }> }) => {
        // Get the signature from the partial signatures
        const partialSig = input.partialSig?.[0];
        if (!partialSig) {
            throw new Error('No signature found');
        }

        // Construct the witness stack for OP_IF (claim) branch:
        // [ <signature>, <secret>, <TRUE>, <redeemScript> ]
        const witness = [
            partialSig.signature,      // Bob's signature
            secretBuf,                  // The secret preimage
            Buffer.from([0x01]),        // TRUE (for OP_IF branch)
            redeemScriptBuf,            // The redeem script
        ];

        return {
            finalScriptSig: Buffer.alloc(0), // Empty for P2WSH
            finalScriptWitness: witnessStackToScriptWitness(witness),
        };
    });

    // Extract the final transaction
    const tx = psbt.extractTransaction();

    return {
        txHex: tx.toHex(),
        txId: tx.getId(),
        tx,
    };
}

/**
 * Creates a transaction to REFUND funds from an HTLC.
 * This is used by the SELLER (Alice) to reclaim funds after timeout.
 * 
 * Witness Stack for P2WSH OP_ELSE branch:
 * [ <AliceSignature>, <FALSE/empty>, <RedeemScript> ]
 * 
 * @param prevTxId - Transaction ID where funds are locked
 * @param prevIndex - Output index (vout) of the locked funds
 * @param amountSats - Amount locked in satoshis
 * @param privateKey - Seller's private key (hex or Buffer)
 * @param redeemScript - The HTLC redeem script (hex or Buffer)
 * @param destinationAddress - Where to send the refunded funds
 * @param timeout - The CSV timeout (must match the HTLC)
 * @param feeSats - Transaction fee in satoshis (default: 500)
 * @param network - Bitcoin network (default: testnet)
 * @returns Transaction ready for broadcast (after timeout)
 */
export function createRefundTx(
    prevTxId: string,
    prevIndex: number,
    amountSats: number,
    privateKey: string | Buffer,
    redeemScript: string | Buffer,
    destinationAddress: string,
    timeout: number,
    feeSats: number = 500,
    network: bitcoin.Network = TESTNET
): RedeemTxResult {
    // Convert inputs to proper formats
    const privateKeyBuf = toBuffer(privateKey, 'privateKey');
    const redeemScriptBuf = toBuffer(redeemScript, 'redeemScript');

    // Create keypair from private key
    const keyPair = createKeyPair(privateKeyBuf, network);
    if (redeemScriptBuf.length === 0) {
        throw new Error('redeemScript cannot be empty');
    }
    assertIntegerRange(timeout, 'timeout', 1, MAX_TIMEOUT);
    assertValidTxInput(prevTxId, prevIndex, amountSats, feeSats);
    assertValidAddress(destinationAddress, network);

    // Calculate output amount (input - fee)
    const outputAmount = amountSats - feeSats;

    // Create the P2WSH payment
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: { output: redeemScriptBuf, network },
        network,
    });
    if (!p2wsh.output) {
        throw new Error('Failed to derive P2WSH output script');
    }

    // Build the transaction
    const psbt = new bitcoin.Psbt({ network });

    // Add input with sequence number for CSV timelock
    psbt.addInput({
        hash: prevTxId,
        index: prevIndex,
        sequence: timeout, // Required for OP_CHECKSEQUENCEVERIFY
        witnessUtxo: {
            script: p2wsh.output!,
            value: amountSats,
        },
        witnessScript: redeemScriptBuf,
    });

    // Add output
    psbt.addOutput({
        address: destinationAddress,
        value: outputAmount,
    });

    // Sign the input
    psbt.signInput(0, keyPair);

    // Finalize with custom witness stack for OP_ELSE branch
    psbt.finalizeInput(0, (_inputIndex: number, input: { partialSig?: Array<{ signature: Buffer }> }) => {
        const partialSig = input.partialSig?.[0];
        if (!partialSig) {
            throw new Error('No signature found');
        }

        // Construct the witness stack for OP_ELSE (refund) branch:
        // [ <signature>, <FALSE/empty>, <redeemScript> ]
        const witness = [
            partialSig.signature,       // Alice's signature
            Buffer.alloc(0),            // Empty/FALSE (for OP_ELSE branch)
            redeemScriptBuf,            // The redeem script
        ];

        return {
            finalScriptSig: Buffer.alloc(0),
            finalScriptWitness: witnessStackToScriptWitness(witness),
        };
    });

    // Extract the final transaction
    const tx = psbt.extractTransaction();

    return {
        txHex: tx.toHex(),
        txId: tx.getId(),
        tx,
    };
}

/**
 * Converts a witness stack array to the serialized witness format.
 */
function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
    let buffer = Buffer.alloc(0);

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

/**
 * Encodes a number as a minimal Bitcoin script number.
 * Bitcoin script numbers are encoded in little-endian with a sign bit.
 */
function encodeScriptNumber(num: number): Buffer {
    if (num === 0) return Buffer.alloc(0);

    const negative = num < 0;
    let absValue = Math.abs(num);
    const result: number[] = [];

    while (absValue > 0) {
        result.push(absValue & 0xff);
        absValue >>= 8;
    }

    // If the high bit is set, we need an extra byte for the sign
    if (result[result.length - 1] & 0x80) {
        result.push(negative ? 0x80 : 0x00);
    } else if (negative) {
        result[result.length - 1] |= 0x80;
    }

    return Buffer.from(result);
}

/**
 * Helper to generate a random keypair for testing
 */
export function generateTestKeyPair(network: bitcoin.Network = TESTNET) {
    const keyPair = ECPair.makeRandom({ network });
    return {
        privateKey: keyPair.privateKey!.toString('hex'),
        publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
        keyPair,
    };
}

/**
 * Helper to compute SHA256 hash of a preimage
 */
export function sha256(preimage: string | Buffer): Buffer {
    const data = toBuffer(preimage, 'preimage');
    return bitcoin.crypto.sha256(data);
}

/**
 * Generates a random secret and its hash for HTLC
 */
export function generateSecret(): { secret: Buffer; secretHash: Buffer } {
    const secret = randomBytes(32);
    const secretHash = sha256(secret);
    return { secret, secretHash };
}

// Export network configurations
export { TESTNET };
export const MAINNET = bitcoin.networks.bitcoin;
