use std::hash::pedersen_hash;

/// ShadowSwap Order Commitment Circuit
/// 
/// This circuit allows a user to commit to an order (amount, price) without
/// revealing the values publicly. The commitment uses a Pedersen hash with
/// a random salt for hiding.
/// 
/// Private Inputs:
///   - amount: The order amount (must be > 0)
///   - price: The order price per unit
///   - salt: Random value for hiding commitment
/// 
/// Public Inputs:
///   - commitment_hash: The expected Pedersen hash of (amount, price, salt)

fn main(
    // Private inputs (known only to the prover)
    amount: Field,
    price: Field,
    salt: Field,
    // Public input (visible to verifier)
    commitment_hash: pub Field
) {
    // 1. Compute the Pedersen hash of (amount, price, salt)
    let computed_hash = pedersen_hash([amount, price, salt]);
    
    // 2. Assert the computed hash matches the public commitment
    assert(computed_hash == commitment_hash, "Commitment hash mismatch");
    
    // 3. Assert amount > 0 (prevent zero-amount orders)
    assert(amount as u64 > 0, "Amount must be greater than zero");
}

#[test]
fn test_valid_commitment() {
    // Test values
    let amount: Field = 100;
    let price: Field = 50000;
    let salt: Field = 12345;
    
    // Compute the expected commitment hash
    let commitment = pedersen_hash([amount, price, salt]);
    
    // Print the commitment so we can use it in Prover.toml
    std::println(commitment);
    
    // This should pass
    main(amount, price, salt, commitment);
}

#[test(should_fail_with = "Amount must be greater than zero")]
fn test_zero_amount_fails() {
    let amount: Field = 0;
    let price: Field = 50000;
    let salt: Field = 12345;
    
    let commitment = pedersen_hash([amount, price, salt]);
    
    // This should fail due to zero amount
    main(amount, price, salt, commitment);
}

#[test(should_fail_with = "Commitment hash mismatch")]
fn test_invalid_commitment_fails() {
    let amount: Field = 100;
    let price: Field = 50000;
    let salt: Field = 12345;
    
    // Use a wrong commitment hash
    let wrong_commitment: Field = 999999;
    
    // This should fail due to hash mismatch
    main(amount, price, salt, wrong_commitment);
}
