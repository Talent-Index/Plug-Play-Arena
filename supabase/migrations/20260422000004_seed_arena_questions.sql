-- =====================================================
-- SEED: ARENA QUIZ QUESTIONS (25 questions)
-- Topics: Avalanche basics, stablecoins, DeFi, subnets
-- =====================================================
INSERT INTO public.arena_questions (topic, question_text, options, correct_answer, difficulty) VALUES

-- ── Avalanche Basics ───────────────────────────────────────────────
('avalanche_basics',
 'What consensus mechanism does Avalanche use?',
 '{"A":"Proof of Work","B":"Delegated Proof of Stake","C":"Snowman (Avalanche consensus)","D":"Byzantine Fault Tolerance"}',
 'C', 'easy'),

('avalanche_basics',
 'What is the native token of the Avalanche network?',
 '{"A":"ETH","B":"AVAX","C":"AVA","D":"ALC"}',
 'B', 'easy'),

('avalanche_basics',
 'Which chain handles smart contract execution on Avalanche mainnet?',
 '{"A":"X-Chain","B":"P-Chain","C":"C-Chain","D":"D-Chain"}',
 'C', 'easy'),

('avalanche_basics',
 'What does the P-Chain on Avalanche primarily manage?',
 '{"A":"Token transfers","B":"Smart contracts","C":"Validators and subnets","D":"Cross-chain bridges"}',
 'C', 'medium'),

('avalanche_basics',
 'Approximately how many transactions per second can Avalanche finalize?',
 '{"A":"7 TPS","B":"15 TPS","C":"4,500 TPS","D":"1,000,000 TPS"}',
 'C', 'medium'),

('avalanche_basics',
 'What is the finality time of Avalanche transactions?',
 '{"A":"~60 seconds","B":"~1 second","C":"~10 minutes","D":"~5 minutes"}',
 'B', 'easy'),

('avalanche_basics',
 'What is the Fuji testnet used for?',
 '{"A":"Running production DeFi protocols","B":"Mining AVAX","C":"Testing and development before mainnet deployment","D":"Storing P-Chain validator records"}',
 'C', 'easy'),

('avalanche_basics',
 'What is an Avalanche L1 (formerly Subnet)?',
 '{"A":"A layer-1 competing chain","B":"A sovereign blockchain with its own rules and validators","C":"A sidechain that mirrors Ethereum","D":"A validator pool on the C-Chain"}',
 'B', 'medium'),

-- ── Stablecoins & DeFi ─────────────────────────────────────────────
('stablecoins',
 'What is a stablecoin?',
 '{"A":"A coin with very low price volatility targeting a fixed value","B":"A coin that earns staking rewards","C":"A governance token for DeFi protocols","D":"A token that tracks the price of gold"}',
 'A', 'easy'),

('stablecoins',
 'What does "collateral ratio" mean in a stablecoin system?',
 '{"A":"The ratio of stablecoin holders to borrowers","B":"The value of collateral backing each unit of stablecoin issued","C":"The percentage of rewards paid to validators","D":"The inflation rate of the stablecoin"}',
 'B', 'medium'),

('stablecoins',
 'What happens during a liquidation in a collateralized stablecoin?',
 '{"A":"The user gets extra stablecoins","B":"Under-collateralized positions are closed to protect the peg","C":"Validators receive extra rewards","D":"The stablecoin supply is increased"}',
 'B', 'medium'),

('stablecoins',
 'If AVAX drops 30% and your collateral ratio falls below the minimum, what should you do to avoid liquidation?',
 '{"A":"Wait for the price to recover","B":"Add more collateral or repay some stablecoin debt","C":"Withdraw all collateral immediately","D":"Mint more stablecoins"}',
 'B', 'hard'),

('stablecoins',
 'What is the peg of USDC?',
 '{"A":"1 BTC","B":"1 ETH","C":"1 USD","D":"1 AVAX"}',
 'C', 'easy'),

('stablecoins',
 'Which mechanism helps a savings rate RAISE demand for a stablecoin?',
 '{"A":"Inflating supply","B":"Reducing interest rates","C":"Offering yield to holders, incentivising holding over selling","D":"Burning the treasury"}',
 'C', 'hard'),

('stablecoins',
 'In a decentralized stablecoin, who sets the stability parameters?',
 '{"A":"A single company CEO","B":"Only miners","C":"Governance token holders via on-chain votes","D":"Government regulators"}',
 'C', 'medium'),

-- ── DeFi Concepts ──────────────────────────────────────────────────
('defi',
 'What does TVL stand for in DeFi?',
 '{"A":"Total Value Locked","B":"Token Velocity Limit","C":"Trusted Validator Layer","D":"Transaction Verification Ledger"}',
 'A', 'easy'),

('defi',
 'What is an AMM (Automated Market Maker)?',
 '{"A":"A bot that mines tokens","B":"A protocol that prices assets using a mathematical formula instead of an order book","C":"An exchange run by a company","D":"A staking validator node"}',
 'B', 'medium'),

('defi',
 'What is impermanent loss in a liquidity pool?',
 '{"A":"Transaction fees paid to validators","B":"The loss from a smart contract hack","C":"The opportunity cost vs. holding assets outside the pool due to price divergence","D":"Gas costs for swapping tokens"}',
 'C', 'hard'),

('defi',
 'What does "yield farming" refer to?',
 '{"A":"Growing tokens in a virtual farm game","B":"Moving assets across protocols to maximise returns","C":"Validating blocks for block rewards","D":"Creating new DeFi protocols"}',
 'B', 'medium'),

-- ── Subnets & Architecture ─────────────────────────────────────────
('subnets',
 'Which of these is a real Avalanche L1 in production?',
 '{"A":"Solana Subnet","B":"Dexalot","C":"Ethereum Subnet","D":"Polygon L2"}',
 'B', 'hard'),

('subnets',
 'What is the key advantage of an Avalanche L1 over deploying on the C-Chain?',
 '{"A":"Cheaper AVAX staking","B":"Sovereign gas token, custom rules, and dedicated validators","C":"Faster finality than C-Chain","D":"No smart contract support needed"}',
 'B', 'medium'),

('subnets',
 'What tool does Avalanche provide for launching a new L1 from the command line?',
 '{"A":"eth-cli","B":"hardhat","C":"avalanche-cli","D":"subnet-forge"}',
 'C', 'medium'),

-- ── NFTs & Tokens ──────────────────────────────────────────────────
('nfts',
 'What does ERC-721 define?',
 '{"A":"A fungible token standard","B":"A non-fungible token standard with unique IDs","C":"A governance protocol","D":"A cross-chain bridge standard"}',
 'B', 'easy'),

('nfts',
 'What is a tokenURI in an ERC-721 contract?',
 '{"A":"The wallet address of the token owner","B":"A link to the token''s metadata (image, attributes, description)","C":"The gas price for minting","D":"The contract owner''s private key"}',
 'B', 'medium'),

('nfts',
 'On Avalanche Fuji testnet, what is the chain ID?',
 '{"A":"1","B":"137","C":"43114","D":"43113"}',
 'D', 'medium')

ON CONFLICT DO NOTHING;
