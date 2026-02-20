import test from 'node:test';
import assert from 'node:assert/strict';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

import {
    TESTNET,
    createRedeemTx,
    createRefundTx,
    generateHTLC,
    generateSecret,
    sha256,
} from './btc-htlc';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const BUYER_PRIVATE_KEY = Buffer.from('1'.repeat(64), 'hex');
const SELLER_PRIVATE_KEY = Buffer.from('2'.repeat(64), 'hex');
const MOCK_TXID = 'a'.repeat(64);
const MOCK_VOUT = 0;
const MOCK_AMOUNT_SATS = 100_000;
const MOCK_FEE_SATS = 500;

function createFixture() {
    const buyer = ECPair.fromPrivateKey(BUYER_PRIVATE_KEY, { network: TESTNET });
    const seller = ECPair.fromPrivateKey(SELLER_PRIVATE_KEY, { network: TESTNET });
    const secret = Buffer.alloc(32, 0x7);
    const secretHash = sha256(secret);

    const htlc = generateHTLC(
        secretHash,
        Buffer.from(buyer.publicKey),
        Buffer.from(seller.publicKey),
        144,
        TESTNET
    );

    const buyerDestination = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(buyer.publicKey),
        network: TESTNET,
    }).address;
    const sellerDestination = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(seller.publicKey),
        network: TESTNET,
    }).address;

    assert.ok(buyerDestination, 'buyer destination should be derivable');
    assert.ok(sellerDestination, 'seller destination should be derivable');

    return {
        buyer,
        seller,
        secret,
        secretHash,
        htlc,
        buyerDestination,
        sellerDestination,
    };
}

test('generateHTLC builds a valid P2WSH script and address', () => {
    const { htlc, secretHash } = createFixture();

    assert.equal(htlc.redeemScript.length > 0, true);
    assert.equal(htlc.redeemScriptHex.length > 0, true);
    assert.equal(htlc.witnessScriptHash.length, 32);
    assert.equal(htlc.address.startsWith('tb1'), true);
    assert.equal(htlc.asm.includes('OP_SHA256'), true);
    assert.equal(htlc.asm.includes(secretHash.toString('hex')), true);
});

test('createRedeemTx builds a claim transaction with the secret in witness', () => {
    const { buyer, htlc, secret, buyerDestination } = createFixture();

    const redeemTx = createRedeemTx(
        MOCK_TXID,
        MOCK_VOUT,
        MOCK_AMOUNT_SATS,
        Buffer.from(buyer.privateKey!),
        secret,
        htlc.redeemScript,
        buyerDestination,
        MOCK_FEE_SATS
    );

    const witness = redeemTx.tx.ins[0]?.witness;
    assert.ok(witness, 'redeem witness should exist');
    assert.equal(witness.length, 4);
    assert.deepEqual(witness[1], secret);
    assert.deepEqual(witness[2], Buffer.from([0x01]));
    assert.equal(redeemTx.txHex.length > 0, true);
    assert.equal(redeemTx.txId.length, 64);
});

test('createRefundTx builds a timeout refund transaction with empty branch selector', () => {
    const { seller, htlc, sellerDestination } = createFixture();

    const timeout = 144;
    const refundTx = createRefundTx(
        MOCK_TXID,
        MOCK_VOUT,
        MOCK_AMOUNT_SATS,
        Buffer.from(seller.privateKey!),
        htlc.redeemScript,
        sellerDestination,
        timeout,
        MOCK_FEE_SATS
    );

    const witness = refundTx.tx.ins[0]?.witness;
    assert.ok(witness, 'refund witness should exist');
    assert.equal(witness.length, 3);
    assert.deepEqual(witness[1], Buffer.alloc(0));
    assert.equal(refundTx.tx.ins[0]?.sequence, timeout);
    assert.equal(refundTx.txId.length, 64);
});

test('validation rejects malformed txid and invalid secret size', () => {
    const { buyer, htlc, secret, buyerDestination } = createFixture();

    assert.throws(
        () =>
            createRedeemTx(
                '1234',
                MOCK_VOUT,
                MOCK_AMOUNT_SATS,
                Buffer.from(buyer.privateKey!),
                secret,
                htlc.redeemScript,
                buyerDestination
            ),
        /Invalid prevTxId/
    );

    assert.throws(
        () =>
            createRedeemTx(
                MOCK_TXID,
                MOCK_VOUT,
                MOCK_AMOUNT_SATS,
                Buffer.from(buyer.privateKey!),
                Buffer.alloc(31, 1),
                htlc.redeemScript,
                buyerDestination
            ),
        /Invalid secret length/
    );
});

test('validation rejects invalid address and fee over amount', () => {
    const { seller, htlc, sellerDestination } = createFixture();

    assert.throws(
        () =>
            createRefundTx(
                MOCK_TXID,
                MOCK_VOUT,
                MOCK_AMOUNT_SATS,
                Buffer.from(seller.privateKey!),
                htlc.redeemScript,
                'not-an-address',
                144
            ),
        /Invalid destination address/
    );

    assert.throws(
        () =>
            createRefundTx(
                MOCK_TXID,
                MOCK_VOUT,
                300,
                Buffer.from(seller.privateKey!),
                htlc.redeemScript,
                sellerDestination,
                144,
                500
            ),
        /feeSats/
    );
});

test('generateSecret uses secure randomness and returns SHA256(secret)', () => {
    const a = generateSecret();
    const b = generateSecret();

    assert.equal(a.secret.length, 32);
    assert.equal(a.secretHash.length, 32);
    assert.deepEqual(sha256(a.secret), a.secretHash);
    assert.notDeepEqual(a.secret, b.secret);
});
