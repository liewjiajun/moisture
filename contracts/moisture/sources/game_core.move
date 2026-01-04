module moisture::game_core {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::event;
    use sui::ed25519;
    use sui::address as sui_address;

    // === Constants ===
    const ENTRY_FEE: u64 = 100_000_000; // 0.1 SUI (9 decimals)
    const INITIAL_POOL: u64 = 1_000_000_000; // 1 SUI
    const ROUND_DURATION: u64 = 3600_000; // 1 hour in milliseconds
    const GRACE_PERIOD: u64 = 300_000; // 5 minutes in milliseconds
    const ORACLE_KEY_LENGTH: u64 = 32; // Ed25519 public key length

    // === Errors ===
    const EInsufficientPayment: u64 = 0;
    const ERoundEnded: u64 = 1;
    const EInvalidSignature: u64 = 2;
    #[allow(unused_const)]
    const ENotAdmin: u64 = 3;
    #[allow(unused_const)]
    const EInvalidWinnersCount: u64 = 4;
    const ERoundInGrace: u64 = 5;
    const EInvalidOracleKey: u64 = 6;

    // === Structs ===

    /// Admin capability for privileged operations
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Oracle capability for score verification
    public struct OracleCap has key, store {
        id: UID,
        public_key: vector<u8>,
    }

    /// The main game pool - shared object
    public struct GamePool has key {
        id: UID,
        balance: Balance<SUI>,
        current_round: u64,
        end_timestamp: u64,
        participants: vector<address>,
        scores: vector<Score>,
    }

    /// Score entry for leaderboard
    public struct Score has store, copy, drop {
        player: address,
        survival_time: u64,
    }

    /// Player ticket - owned object, minted on entry
    public struct PlayerTicket has key, store {
        id: UID,
        character_seed: u64,
        round_id: u64,
        player: address,
    }

    // === Events ===

    public struct GameEntered has copy, drop {
        player: address,
        round_id: u64,
        character_seed: u64,
        pool_balance: u64,
    }

    public struct ScoreSubmitted has copy, drop {
        player: address,
        round_id: u64,
        survival_time: u64,
    }

    public struct RewardsDistributed has copy, drop {
        round_id: u64,
        first_place: address,
        first_reward: u64,
        second_place: address,
        second_reward: u64,
        third_place: address,
        third_reward: u64,
    }

    public struct RoundStarted has copy, drop {
        round_id: u64,
        end_timestamp: u64,
        initial_pool: u64,
    }

    // === Init ===

    fun init(ctx: &mut TxContext) {
        // Create and transfer admin cap to deployer
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };
        transfer::transfer(admin_cap, ctx.sender());
    }

    // === Public Functions ===

    /// Initialize the game pool with initial SUI (called by admin after init)
    #[allow(lint(public_entry))]
    public entry fun create_pool(
        _admin_cap: &AdminCap,
        initial_funds: Coin<SUI>,
        oracle_public_key: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Validate oracle public key length (Ed25519 = 32 bytes)
        assert!(vector::length(&oracle_public_key) == ORACLE_KEY_LENGTH, EInvalidOracleKey);

        let pool_balance = coin::into_balance(initial_funds);

        // Ensure at least 1 SUI for initial pool
        assert!(balance::value(&pool_balance) >= INITIAL_POOL, EInsufficientPayment);

        let current_time = clock.timestamp_ms();

        let pool = GamePool {
            id: object::new(ctx),
            balance: pool_balance,
            current_round: 1,
            end_timestamp: current_time + ROUND_DURATION,
            participants: vector::empty(),
            scores: vector::empty(),
        };

        let oracle_cap = OracleCap {
            id: object::new(ctx),
            public_key: oracle_public_key,
        };

        event::emit(RoundStarted {
            round_id: 1,
            end_timestamp: current_time + ROUND_DURATION,
            initial_pool: balance::value(&pool.balance),
        });

        transfer::share_object(pool);
        transfer::transfer(oracle_cap, ctx.sender());
    }

    /// Enter the game by paying 0.1 SUI
    #[allow(lint(public_entry))]
    public entry fun enter_game(
        pool: &mut GamePool,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify payment amount
        let payment_value = coin::value(&payment);
        assert!(payment_value >= ENTRY_FEE, EInsufficientPayment);

        // Verify round is still active
        let current_time = clock.timestamp_ms();
        assert!(current_time < pool.end_timestamp, ERoundEnded);

        // Verify not in grace period (last 5 minutes before round end)
        assert!(current_time < pool.end_timestamp - GRACE_PERIOD, ERoundInGrace);

        // Add payment to pool
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut pool.balance, payment_balance);

        // Generate character seed from transaction context
        let sender = ctx.sender();
        let character_seed = generate_seed(sender, pool.current_round, ctx);

        // Add participant
        vector::push_back(&mut pool.participants, sender);

        // Create and transfer player ticket
        let ticket = PlayerTicket {
            id: object::new(ctx),
            character_seed,
            round_id: pool.current_round,
            player: sender,
        };

        event::emit(GameEntered {
            player: sender,
            round_id: pool.current_round,
            character_seed,
            pool_balance: balance::value(&pool.balance),
        });

        transfer::transfer(ticket, sender);
    }

    /// Submit score with oracle signature verification
    #[allow(lint(public_entry))]
    public entry fun submit_score(
        pool: &mut GamePool,
        oracle_cap: &OracleCap,
        ticket: PlayerTicket,
        survival_time: u64,
        signature: vector<u8>,
        _ctx: &mut TxContext
    ) {
        let PlayerTicket { id, character_seed: _, round_id, player } = ticket;

        // Verify the ticket is for current round
        assert!(round_id == pool.current_round, ERoundEnded);

        // Verify signature from oracle
        let message = create_score_message(player, round_id, survival_time);
        let is_valid = ed25519::ed25519_verify(
            &signature,
            &oracle_cap.public_key,
            &message
        );
        assert!(is_valid, EInvalidSignature);

        // Record score
        let score = Score {
            player,
            survival_time,
        };

        // Insert score maintaining top 3 only
        insert_score(&mut pool.scores, score);

        event::emit(ScoreSubmitted {
            player,
            round_id,
            survival_time,
        });

        // Burn the ticket
        object::delete(id);
    }

    /// Distribute rewards to top 3 players (called by admin/oracle when round ends)
    #[allow(lint(public_entry))]
    public entry fun distribute_rewards(
        pool: &mut GamePool,
        _admin_cap: &AdminCap,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let current_time = clock.timestamp_ms();

        // Can only distribute after round ends
        assert!(current_time >= pool.end_timestamp, ERoundEnded);

        let scores = &pool.scores;
        let num_winners = vector::length(scores);

        if (num_winners > 0) {
            let total_pool = balance::value(&pool.balance);

            // Reserve 1 SUI for next round if possible
            let distributable = if (total_pool > INITIAL_POOL) {
                total_pool - INITIAL_POOL
            } else {
                total_pool
            };

            let mut first_reward: u64 = 0;
            let mut second_reward: u64 = 0;
            let mut third_reward: u64 = 0;
            let mut first_place = @0x0;
            let mut second_place = @0x0;
            let mut third_place = @0x0;

            // Calculate and distribute rewards
            if (num_winners >= 1) {
                first_place = vector::borrow(scores, 0).player;
                first_reward = if (num_winners == 1) {
                    distributable
                } else {
                    (distributable * 50) / 100
                };

                if (first_reward > 0) {
                    let reward_balance = balance::split(&mut pool.balance, first_reward);
                    let reward_coin = coin::from_balance(reward_balance, ctx);
                    transfer::public_transfer(reward_coin, first_place);
                };
            };

            if (num_winners >= 2) {
                second_place = vector::borrow(scores, 1).player;
                second_reward = if (num_winners == 2) {
                    distributable - first_reward
                } else {
                    (distributable * 30) / 100
                };

                if (second_reward > 0) {
                    let reward_balance = balance::split(&mut pool.balance, second_reward);
                    let reward_coin = coin::from_balance(reward_balance, ctx);
                    transfer::public_transfer(reward_coin, second_place);
                };
            };

            if (num_winners >= 3) {
                third_place = vector::borrow(scores, 2).player;
                third_reward = distributable - first_reward - second_reward;

                if (third_reward > 0) {
                    let reward_balance = balance::split(&mut pool.balance, third_reward);
                    let reward_coin = coin::from_balance(reward_balance, ctx);
                    transfer::public_transfer(reward_coin, third_place);
                };
            };

            event::emit(RewardsDistributed {
                round_id: pool.current_round,
                first_place,
                first_reward,
                second_place,
                second_reward,
                third_place,
                third_reward,
            });
        };

        // Reset for next round
        pool.current_round = pool.current_round + 1;
        pool.end_timestamp = current_time + ROUND_DURATION;
        pool.participants = vector::empty();
        pool.scores = vector::empty();

        event::emit(RoundStarted {
            round_id: pool.current_round,
            end_timestamp: pool.end_timestamp,
            initial_pool: balance::value(&pool.balance),
        });
    }

    /// Add more funds to the pool (anyone can donate)
    #[allow(lint(public_entry))]
    public entry fun add_to_pool(
        pool: &mut GamePool,
        funds: Coin<SUI>,
    ) {
        let funds_balance = coin::into_balance(funds);
        balance::join(&mut pool.balance, funds_balance);
    }

    // === View Functions ===

    public fun get_pool_balance(pool: &GamePool): u64 {
        balance::value(&pool.balance)
    }

    public fun get_current_round(pool: &GamePool): u64 {
        pool.current_round
    }

    public fun get_end_timestamp(pool: &GamePool): u64 {
        pool.end_timestamp
    }

    public fun get_participant_count(pool: &GamePool): u64 {
        vector::length(&pool.participants)
    }

    public fun get_ticket_seed(ticket: &PlayerTicket): u64 {
        ticket.character_seed
    }

    public fun get_ticket_round(ticket: &PlayerTicket): u64 {
        ticket.round_id
    }

    // === Internal Functions ===

    fun generate_seed(_player: address, round: u64, ctx: &mut TxContext): u64 {
        let uid = object::new(ctx);
        let bytes = object::uid_to_bytes(&uid);
        object::delete(uid);

        let mut seed: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8 && i < vector::length(&bytes)) {
            seed = (seed << 8) | (*vector::borrow(&bytes, i) as u64);
            i = i + 1;
        };

        // Mix with player address and round
        let addr_bytes = sui_address::to_bytes(_player);
        let mut j: u64 = 0;
        while (j < 8 && j < vector::length(&addr_bytes)) {
            let shift_amount = ((j * 8) as u8);
            seed = seed ^ ((*vector::borrow(&addr_bytes, j) as u64) << shift_amount);
            j = j + 1;
        };

        seed ^ round
    }

    fun create_score_message(player: address, round_id: u64, survival_time: u64): vector<u8> {
        let mut message = vector::empty<u8>();

        // Add player address bytes
        let addr_bytes = sui_address::to_bytes(player);
        let mut i: u64 = 0;
        while (i < vector::length(&addr_bytes)) {
            vector::push_back(&mut message, *vector::borrow(&addr_bytes, i));
            i = i + 1;
        };

        // Add round_id as bytes
        let mut round_bytes = round_id;
        let mut j: u64 = 0;
        while (j < 8) {
            vector::push_back(&mut message, ((round_bytes & 0xFF) as u8));
            round_bytes = round_bytes >> 8;
            j = j + 1;
        };

        // Add survival_time as bytes
        let mut time_bytes = survival_time;
        let mut k: u64 = 0;
        while (k < 8) {
            vector::push_back(&mut message, ((time_bytes & 0xFF) as u8));
            time_bytes = time_bytes >> 8;
            k = k + 1;
        };

        message
    }

    fun insert_score(scores: &mut vector<Score>, new_score: Score) {
        let len = vector::length(scores);
        let mut insert_idx = len;

        // Find insertion point (descending order by survival_time)
        let mut i = 0;
        while (i < len) {
            if (new_score.survival_time > vector::borrow(scores, i).survival_time) {
                insert_idx = i;
                break
            };
            i = i + 1;
        };

        // Only keep top 3
        if (insert_idx < 3) {
            // Insert at position
            vector::push_back(scores, new_score);
            let mut j = vector::length(scores) - 1;
            while (j > insert_idx) {
                vector::swap(scores, j, j - 1);
                j = j - 1;
            };

            // Trim to 3
            while (vector::length(scores) > 3) {
                vector::pop_back(scores);
            };
        };
    }

    // === Test Functions ===
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
