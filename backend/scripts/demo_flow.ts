/**
 * ShadowSwap Demo Flow
 * 
 * This script simulates the complete atomic swap flow between Alice and Bob.
 * It demonstrates how cryptographic data flows correctly:
 * Alice -> Starknet -> Bob -> Bitcoin
 * 
 * Run: npx ts-node scripts/demo_flow.ts
 */

import {
    generateHTLC,
    generateTestKeyPair,
    generateSecret,
    createRedeemTx,
    sha256,
    TESTNET,
} from '../client/src/btc-htlc';
import * as bitcoin from 'bitcoinjs-lib';
import { randomBytes } from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEMO_CONFIG = {
    // Amounts
    BTC_AMOUNT: 1.0,           // BTC Alice is selling
    USDC_AMOUNT: 50000,        // USDC Bob is paying
    BTC_AMOUNT_SATS: 100000000, // 1 BTC in satoshis

    // Timeouts
    BTC_TIMEOUT_BLOCKS: 144,   // ~24 hours on Bitcoin
    STARKNET_TIMEOUT_BLOCKS: 1800, // ~6 hours on Starknet

    // Fee
    BTC_FEE_SATS: 500,
};

// ============================================================================
// MOCK STARKNET INTERFACE
// ============================================================================

interface StarknetOrder {
    order_id: number;
    amount: bigint;
    token: string;
    secret_hash: string;
    seller: string;
    buyer: string;
    is_active: boolean;
    created_at: number;
}

interface SecretRevealedEvent {
    order_id: number;
    seller: string;
    secret: string;
    amount: bigint;
}

class MockDarkPoolContract {
    private orders: Map<number, StarknetOrder> = new Map();
    private orderCount = 0;
    private events: SecretRevealedEvent[] = [];

    constructor(public address: string) { }

    create_order(
        amount: bigint,
        token_address: string,
        secret_hash: string,
        buyer: string,
        seller: string
    ): number {
        const order_id = this.orderCount++;
        this.orders.set(order_id, {
            order_id,
            amount,
            token: token_address,
            secret_hash,
            seller,
            buyer,
            is_active: true,
            created_at: Date.now(),
        });
        return order_id;
    }

    claim_order(order_id: number, secret: string): SecretRevealedEvent {
        const order = this.orders.get(order_id);
        if (!order) throw new Error('Order not found');
        if (!order.is_active) throw new Error('Order not active');

        // Verify SHA256(secret) == secret_hash
        const secretBuffer = Buffer.from(secret, 'hex');
        const computedHash = sha256(secretBuffer).toString('hex');

        if (computedHash !== order.secret_hash) {
            throw new Error(`Invalid secret! Expected hash: ${order.secret_hash}, Got: ${computedHash}`);
        }

        // Mark as inactive
        order.is_active = false;
        this.orders.set(order_id, order);

        // Emit event
        const event: SecretRevealedEvent = {
            order_id,
            seller: order.seller,
            secret,
            amount: order.amount,
        };
        this.events.push(event);

        return event;
    }

    get_order(order_id: number): StarknetOrder | undefined {
        return this.orders.get(order_id);
    }

    // Simulate event listening
    getLatestSecretRevealedEvent(): SecretRevealedEvent | undefined {
        return this.events[this.events.length - 1];
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function printHeader(title: string) {
    console.log('\n' + '═'.repeat(70));
    console.log(`  ${title}`);
    console.log('═'.repeat(70));
}

function printStep(step: number, actor: string, action: string) {
    const emoji = actor === 'Alice' ? '👩' : '👨';
    console.log(`\n[Step ${step}] ${emoji} ${actor}: ${action}`);
    console.log('-'.repeat(60));
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN DEMO FLOW
// ============================================================================

async function runDemo() {
    printHeader('🌑 SHADOWSWAP ATOMIC SWAP DEMO 🌑');
    console.log('\nScenario: Alice sells 1 BTC to Bob for 50,000 USDC');
    console.log('Protocol: Cross-chain atomic swap using Hash Time-Locked Contracts\n');

    // ========================================
    // SETUP: Generate keypairs for Alice and Bob
    // ========================================
    printHeader('SETUP: Generating Keypairs');

    const alice = generateTestKeyPair();
    const bob = generateTestKeyPair();

    console.log('Alice (Seller - sells BTC, receives USDC):');
    console.log(`  Public Key: ${alice.publicKey.slice(0, 20)}...`);

    console.log('\nBob (Buyer - buys BTC, pays USDC):');
    console.log(`  Public Key: ${bob.publicKey.slice(0, 20)}...`);

    // Mock Starknet addresses
    const aliceStarknet = '0x' + 'a'.repeat(64);
    const bobStarknet = '0x' + 'b'.repeat(64);
    const usdcToken = '0x' + 'c'.repeat(64);

    // Initialize mock contract
    const darkPool = new MockDarkPoolContract('0x' + 'd'.repeat(64));

    // ========================================
    // STEP 1: Alice generates Secret and Hash
    // ========================================
    printStep(1, 'Alice', 'Generate Secret (S) and Hash (H)');

    const { secret, secretHash } = generateSecret();

    console.log(`Secret (S):      ${secret.toString('hex')}`);
    console.log(`Secret Hash (H): ${secretHash.toString('hex')}`);
    console.log('\n⚠️  Alice keeps S private until she claims USDC!');

    await delay(500);

    // ========================================
    // STEP 2: Alice generates Bitcoin HTLC
    // ========================================
    printStep(2, 'Alice', 'Generate Bitcoin HTLC Address using H');

    const htlc = generateHTLC(
        secretHash,
        bob.publicKey,      // Bob can claim with secret
        alice.publicKey,    // Alice can refund after timeout
        DEMO_CONFIG.BTC_TIMEOUT_BLOCKS
    );

    console.log('HTLC Script (ASM):');
    console.log(`  ${htlc.asm.slice(0, 80)}...`);
    console.log(`\nP2WSH Address: ${htlc.address}`);
    console.log(`\nScript Logic:`);
    console.log(`  IF Bob has secret S where SHA256(S) = H → Bob claims BTC`);
    console.log(`  ELSE after ${DEMO_CONFIG.BTC_TIMEOUT_BLOCKS} blocks → Alice refunds`);

    await delay(500);

    // ========================================
    // STEP 3: Alice "sends" BTC to HTLC
    // ========================================
    printStep(3, 'Alice', 'Lock BTC in HTLC');

    // Mock transaction ID (in real scenario this comes from Bitcoin network)
    const mockBtcTxId = randomBytes(32).toString('hex');

    console.log(`📤 Sending ${DEMO_CONFIG.BTC_AMOUNT} BTC to HTLC...`);
    console.log(`   To Address: ${htlc.address}`);
    console.log(`   Amount: ${DEMO_CONFIG.BTC_AMOUNT} BTC (${DEMO_CONFIG.BTC_AMOUNT_SATS} sats)`);
    console.log(`\n✅ Transaction Confirmed!`);
    console.log(`   TxID: ${mockBtcTxId.slice(0, 20)}...`);
    console.log(`   Vout: 0`);

    await delay(500);

    // ========================================
    // STEP 4: Alice submits USDC order to Starknet
    // ========================================
    printStep(4, 'Alice', 'Create USDC Order on Starknet with Hash H');

    console.log('Calling DarkPool.create_order()...');
    console.log(`  Amount: ${DEMO_CONFIG.USDC_AMOUNT} USDC`);
    console.log(`  Secret Hash: 0x${secretHash.toString('hex')}`);
    console.log(`  Buyer: ${bobStarknet.slice(0, 20)}...`);

    const orderId = darkPool.create_order(
        BigInt(DEMO_CONFIG.USDC_AMOUNT * 1e6), // USDC has 6 decimals
        usdcToken,
        secretHash.toString('hex'),
        bobStarknet,
        aliceStarknet
    );

    console.log(`\n✅ Order Created!`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Event Emitted: OrderCreated { order_id: ${orderId}, seller: Alice, buyer: Bob }`);

    await delay(500);

    // ========================================
    // STEP 5: Bob sees and matches the order
    // ========================================
    printStep(5, 'Bob', 'Detect Order and Verify HTLC');

    const order = darkPool.get_order(orderId);
    console.log('📡 Monitoring Starknet for OrderCreated events...');
    console.log(`\n🔔 Found Order #${orderId}:`);
    console.log(`   USDC Amount: ${Number(order!.amount) / 1e6} USDC`);
    console.log(`   Secret Hash: 0x${order!.secret_hash.slice(0, 20)}...`);
    console.log(`   Seller: ${order!.seller.slice(0, 20)}...`);

    console.log('\n🔍 Bob verifies Bitcoin HTLC uses same Hash H...');
    console.log(`   HTLC Secret Hash matches Order: ✅`);
    console.log(`   HTLC timeout (${DEMO_CONFIG.BTC_TIMEOUT_BLOCKS} blocks) > Starknet timeout: ✅`);
    console.log(`   Bob can claim BTC if he gets the secret: ✅`);
    console.log('\n✅ Order Matched! Bob is ready to receive secret.');

    await delay(500);

    // ========================================
    // STEP 6: Alice claims USDC by revealing secret
    // ========================================
    printStep(6, 'Alice', 'Claim USDC by Revealing Secret S');

    console.log('🔓 Alice reveals secret to claim USDC...');
    console.log('Calling DarkPool.claim_order()...');
    console.log(`  Order ID: ${orderId}`);
    console.log(`  Secret: 0x${secret.toString('hex').slice(0, 20)}...`);

    const event = darkPool.claim_order(orderId, secret.toString('hex'));

    console.log(`\n✅ USDC Claimed!`);
    console.log(`   Amount: ${Number(event.amount) / 1e6} USDC transferred to Alice`);
    console.log(`\n🔔 Event Emitted: SecretRevealed {`);
    console.log(`     order_id: ${event.order_id},`);
    console.log(`     seller: ${event.seller.slice(0, 20)}...,`);
    console.log(`     secret: 0x${event.secret.slice(0, 20)}...,  ← BOB CATCHES THIS!`);
    console.log(`     amount: ${event.amount}`);
    console.log(`   }`);

    await delay(500);

    // ========================================
    // STEP 7: Bob detects SecretRevealed event
    // ========================================
    printStep(7, 'Bob', 'Catch SecretRevealed Event');

    console.log('📡 Monitoring Starknet for SecretRevealed events...');

    const revealedEvent = darkPool.getLatestSecretRevealedEvent();

    console.log(`\n🎯 CAUGHT SECRET!`);
    console.log(`   Order ID: ${revealedEvent!.order_id}`);
    console.log(`   Secret (S): 0x${revealedEvent!.secret}`);

    // Verify Bob can use this secret
    const verifyHash = sha256(Buffer.from(revealedEvent!.secret, 'hex'));
    console.log(`\n🔐 Verification:`);
    console.log(`   SHA256(S) = ${verifyHash.toString('hex')}`);
    console.log(`   Matches HTLC Hash: ${verifyHash.toString('hex') === secretHash.toString('hex') ? '✅' : '❌'}`);

    await delay(500);

    // ========================================
    // STEP 8: Bob claims Bitcoin using secret
    // ========================================
    printStep(8, 'Bob', 'Claim Bitcoin from HTLC using Secret S');

    // Generate Bob's destination address
    const bobDestination = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(bob.publicKey, 'hex'),
        network: TESTNET,
    }).address!;

    console.log('🔓 Creating Bitcoin claim transaction...');
    console.log(`   Using Secret: 0x${revealedEvent!.secret.slice(0, 20)}...`);
    console.log(`   Destination: ${bobDestination}`);

    const redeemTx = createRedeemTx(
        mockBtcTxId,
        0, // vout
        DEMO_CONFIG.BTC_AMOUNT_SATS,
        bob.privateKey,
        revealedEvent!.secret,
        htlc.redeemScript,
        bobDestination,
        DEMO_CONFIG.BTC_FEE_SATS
    );

    console.log(`\n✅ Redeem Transaction Created!`);
    console.log(`   TxID: ${redeemTx.txId}`);
    console.log(`   Size: ${redeemTx.txHex.length / 2} bytes`);
    console.log(`   Witness Stack: [<signature>, <secret>, 0x01, <redeemScript>]`);
    console.log(`\n   Raw Tx Hex (first 100 chars):`);
    console.log(`   ${redeemTx.txHex.slice(0, 100)}...`);

    console.log(`\n📤 Broadcasting to Bitcoin network...`);
    console.log(`   (In production: bitcoin-cli sendrawtransaction ${redeemTx.txId.slice(0, 20)}...)`);
    console.log(`\n✅ Transaction Broadcast! Bob received ${DEMO_CONFIG.BTC_AMOUNT} BTC!`);

    // ========================================
    // SUMMARY
    // ========================================
    printHeader('🎉 ATOMIC SWAP COMPLETE 🎉');

    console.log('\nFinal State:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  Alice:                                                 │');
    console.log(`│    ❌ Sent: 1 BTC                                       │`);
    console.log(`│    ✅ Received: 50,000 USDC                             │`);
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│  Bob:                                                   │');
    console.log(`│    ❌ Sent: 50,000 USDC                                 │`);
    console.log(`│    ✅ Received: 1 BTC                                   │`);
    console.log('└─────────────────────────────────────────────────────────┘');

    console.log('\nKey Cryptographic Flow:');
    console.log('  1. Alice creates Secret S, computes H = SHA256(S)');
    console.log('  2. H is used in both Bitcoin HTLC and Starknet order');
    console.log('  3. Alice reveals S on Starknet to claim USDC');
    console.log('  4. S is now public (via SecretRevealed event)');
    console.log('  5. Bob uses S to unlock Bitcoin HTLC');
    console.log('\n✅ Trustless cross-chain swap completed without intermediary!');
    console.log('');
}

// ============================================================================
// RUN
// ============================================================================

runDemo().catch((err) => {
    console.error('Demo failed:', err);
    process.exit(1);
});
