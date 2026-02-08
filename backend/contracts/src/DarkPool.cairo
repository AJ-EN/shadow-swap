/// ShadowSwap DarkPool Contract
/// 
/// A privacy-preserving dark pool for atomic swaps on Starknet.
/// This contract manages orders and releases USDC when the correct secret is revealed.
///
/// Flow:
/// 1. Seller creates an order by depositing USDC with a secret_hash
/// 2. Buyer reveals the secret (off-chain) to claim Bitcoin
/// 3. Seller calls claim_order with secret to claim USDC (emits SecretRevealed for Bob)

use starknet::ContractAddress;

/// Order struct representing a swap order in the dark pool
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct Order {
    /// Amount of tokens locked in the order
    pub amount: u256,
    /// Token contract address (e.g., USDC)
    pub token: ContractAddress,
    /// SHA256 hash of the secret (commitment) - stored as u256
    pub secret_hash: u256,
    /// Seller's address (who created the order and will receive tokens)
    pub seller: ContractAddress,
    /// Buyer's address (who will claim Bitcoin off-chain)
    pub buyer: ContractAddress,
    /// Whether the order is still active
    pub is_active: bool,
    /// Block number when order was created (for timeouts)
    pub created_at: u64,
}

/// Interface for external ERC20 token contracts
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, 
        sender: ContractAddress, 
        recipient: ContractAddress, 
        amount: u256
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

/// DarkPool contract interface
#[starknet::interface]
pub trait IDarkPool<TContractState> {
    /// Create a new order by depositing tokens
    fn create_order(
        ref self: TContractState,
        amount: u256,
        token_address: ContractAddress,
        secret_hash: u256,
        buyer: ContractAddress,
    ) -> u64;

    /// Claim an order by revealing the secret (for Seller/Alice)
    /// CRITICAL: Emits SecretRevealed event that Bob listens to for Bitcoin claim
    fn claim_order(ref self: TContractState, order_id: u64, secret: u256);

    /// Cancel an order (only seller, after timeout)
    fn cancel_order(ref self: TContractState, order_id: u64);

    /// Get order details
    fn get_order(self: @TContractState, order_id: u64) -> Order;

    /// Get total order count
    fn get_order_count(self: @TContractState) -> u64;

    /// Verify a secret against a hash (view function for testing)
    fn verify_secret(self: @TContractState, secret: u256, expected_hash: u256) -> bool;
}

#[starknet::contract]
pub mod DarkPool {
    use super::{Order, IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_number};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::sha256::compute_sha256_u32_array;
    use core::num::traits::Zero;

    /// Timeout period in blocks (~6 hours at 12s/block)
    const TIMEOUT_BLOCKS: u64 = 1800;

    #[storage]
    struct Storage {
        /// Mapping from order ID to Order struct
        orders: Map<u64, Order>,
        /// Total number of orders created
        order_count: u64,
        /// Contract owner (for emergency functions)
        owner: ContractAddress,
    }

    /// Events
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        OrderCreated: OrderCreated,
        SecretRevealed: SecretRevealed,
        OrderCancelled: OrderCancelled,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OrderCreated {
        #[key]
        pub order_id: u64,
        #[key]
        pub seller: ContractAddress,
        #[key]
        pub buyer: ContractAddress,
        pub amount: u256,
        pub token: ContractAddress,
        pub secret_hash: u256,
    }

    /// CRITICAL EVENT: Bob (buyer) listens to this to claim Bitcoin from HTLC
    #[derive(Drop, starknet::Event)]
    pub struct SecretRevealed {
        #[key]
        pub order_id: u64,
        #[key]
        pub seller: ContractAddress,
        /// The revealed secret - Bob uses this to claim from Bitcoin HTLC
        pub secret: u256,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OrderCancelled {
        #[key]
        pub order_id: u64,
        #[key]
        pub seller: ContractAddress,
        pub amount: u256,
    }

    /// Errors
    pub mod Errors {
        pub const ZERO_AMOUNT: felt252 = 'Amount must be greater than 0';
        pub const ZERO_ADDRESS: felt252 = 'Invalid zero address';
        pub const ORDER_NOT_FOUND: felt252 = 'Order not found';
        pub const ORDER_NOT_ACTIVE: felt252 = 'Order is not active';
        pub const INVALID_SECRET: felt252 = 'Invalid secret provided';
        pub const TRANSFER_FAILED: felt252 = 'Token transfer failed';
        pub const NOT_SELLER: felt252 = 'Only seller can cancel';
        pub const TIMEOUT_NOT_REACHED: felt252 = 'Timeout not reached';
        pub const INVALID_BUYER: felt252 = 'Invalid buyer address';
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
        self.order_count.write(0);
    }

    #[abi(embed_v0)]
    impl DarkPoolImpl of super::IDarkPool<ContractState> {
        /// Create a new order by depositing tokens
        /// 
        /// # Arguments
        /// * `amount` - Amount of tokens to lock
        /// * `token_address` - ERC20 token contract address
        /// * `secret_hash` - SHA256 hash of the secret (from Bitcoin HTLC)
        /// * `buyer` - Address that will receive Bitcoin (for record keeping)
        /// 
        /// # Returns
        /// * `order_id` - Unique identifier for this order
        fn create_order(
            ref self: ContractState,
            amount: u256,
            token_address: ContractAddress,
            secret_hash: u256,
            buyer: ContractAddress,
        ) -> u64 {
            // Validate inputs
            assert(amount > 0, Errors::ZERO_AMOUNT);
            assert(token_address.is_non_zero(), Errors::ZERO_ADDRESS);
            assert(buyer.is_non_zero(), Errors::INVALID_BUYER);

            let caller = get_caller_address();
            let contract = get_contract_address();
            let block_number = get_block_number();

            // Transfer tokens from seller to contract
            let token = IERC20Dispatcher { contract_address: token_address };
            let success = token.transfer_from(caller, contract, amount);
            assert(success, Errors::TRANSFER_FAILED);

            // Create new order
            let order_id = self.order_count.read();
            let order = Order {
                amount,
                token: token_address,
                secret_hash,
                seller: caller,
                buyer,
                is_active: true,
                created_at: block_number,
            };

            // Store order and increment counter
            self.orders.write(order_id, order);
            self.order_count.write(order_id + 1);

            // Emit event
            self.emit(OrderCreated {
                order_id,
                seller: caller,
                buyer,
                amount,
                token: token_address,
                secret_hash,
            });

            order_id
        }

        /// Claim an order by revealing the secret
        /// 
        /// This function is called by Alice (seller) to claim her USDC.
        /// It verifies SHA256(secret) == order.secret_hash and if valid:
        /// - Transfers USDC to seller
        /// - Emits SecretRevealed event (CRITICAL: Bob listens to this!)
        /// 
        /// # Arguments
        /// * `order_id` - ID of the order to claim
        /// * `secret` - The 32-byte preimage (as u256) that hashes to secret_hash
        fn claim_order(ref self: ContractState, order_id: u64, secret: u256) {
            // 1. Fetch the Order
            let order = self.orders.read(order_id);
            
            // 2. Check is_active is true
            assert(order.is_active, Errors::ORDER_NOT_ACTIVE);

            // 3. Verify: SHA256(secret) == order.secret_hash
            let computed_hash = compute_sha256_from_u256(secret);
            assert(computed_hash == order.secret_hash, Errors::INVALID_SECRET);

            // 4. If valid:
            // 4a. Mark order as inactive
            let updated_order = Order { is_active: false, ..order };
            self.orders.write(order_id, updated_order);

            // 4b. Transfer USDC to seller
            let token = IERC20Dispatcher { contract_address: order.token };
            let success = token.transfer(order.seller, order.amount);
            assert(success, Errors::TRANSFER_FAILED);

            // 4c. EMIT EVENT: SecretRevealed - CRITICAL for Bob to claim Bitcoin!
            self.emit(SecretRevealed {
                order_id,
                seller: order.seller,
                secret,  // <-- Bob uses this to claim from Bitcoin HTLC
                amount: order.amount,
            });
        }

        /// Cancel an order (only seller, after timeout)
        /// 
        /// # Arguments
        /// * `order_id` - ID of the order to cancel
        fn cancel_order(ref self: ContractState, order_id: u64) {
            let caller = get_caller_address();
            let block_number = get_block_number();

            // Get and validate order
            let order = self.orders.read(order_id);
            assert(order.is_active, Errors::ORDER_NOT_ACTIVE);
            assert(caller == order.seller, Errors::NOT_SELLER);

            // Check timeout has passed
            let elapsed = block_number - order.created_at;
            assert(elapsed >= TIMEOUT_BLOCKS, Errors::TIMEOUT_NOT_REACHED);

            // Mark order as inactive
            let updated_order = Order { is_active: false, ..order };
            self.orders.write(order_id, updated_order);

            // Refund tokens to seller
            let token = IERC20Dispatcher { contract_address: order.token };
            let success = token.transfer(order.seller, order.amount);
            assert(success, Errors::TRANSFER_FAILED);

            // Emit event
            self.emit(OrderCancelled {
                order_id,
                seller: order.seller,
                amount: order.amount,
            });
        }

        /// Get order details
        fn get_order(self: @ContractState, order_id: u64) -> Order {
            self.orders.read(order_id)
        }

        /// Get total order count
        fn get_order_count(self: @ContractState) -> u64 {
            self.order_count.read()
        }

        /// Verify a secret against a hash (view function for testing)
        fn verify_secret(self: @ContractState, secret: u256, expected_hash: u256) -> bool {
            let computed_hash = compute_sha256_from_u256(secret);
            computed_hash == expected_hash
        }
    }

    /// Compute SHA256 hash from a u256 value
    /// Converts u256 to 8 x u32 words and computes SHA256
    fn compute_sha256_from_u256(value: u256) -> u256 {
        // Convert u256 (low: u128, high: u128) to 8 x u32 array (big-endian)
        // u256 = high (128 bits) || low (128 bits)
        // Each u128 = 4 x u32
        
        let mut input: Array<u32> = array![];
        
        // High part (first 4 words) - big endian order
        let high = value.high;
        input.append(((high / 0x1000000000000000000000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append(((high / 0x10000000000000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append(((high / 0x100000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append((high & 0xFFFFFFFF_u128).try_into().unwrap());
        
        // Low part (next 4 words) - big endian order
        let low = value.low;
        input.append(((low / 0x1000000000000000000000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append(((low / 0x10000000000000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append(((low / 0x100000000_u128) & 0xFFFFFFFF_u128).try_into().unwrap());
        input.append((low & 0xFFFFFFFF_u128).try_into().unwrap());

        // Compute SHA256 (input is 32 bytes = 256 bits, last_input_num_bytes = 0 for aligned)
        let hash_result: [u32; 8] = compute_sha256_u32_array(input, 0, 32);

        // Convert [u32; 8] back to u256 using destructuring
        // Result is 8 x u32 in big-endian order
        let [h0, h1, h2, h3, h4, h5, h6, h7] = hash_result;

        let h0_128: u128 = h0.into();
        let h1_128: u128 = h1.into();
        let h2_128: u128 = h2.into();
        let h3_128: u128 = h3.into();
        let h4_128: u128 = h4.into();
        let h5_128: u128 = h5.into();
        let h6_128: u128 = h6.into();
        let h7_128: u128 = h7.into();

        let high_part: u128 = h0_128 * 0x1000000000000000000000000_u128 
            + h1_128 * 0x10000000000000000_u128 
            + h2_128 * 0x100000000_u128 
            + h3_128;
        
        let low_part: u128 = h4_128 * 0x1000000000000000000000000_u128 
            + h5_128 * 0x10000000000000000_u128 
            + h6_128 * 0x100000000_u128 
            + h7_128;

        u256 { low: low_part, high: high_part }
    }
}
