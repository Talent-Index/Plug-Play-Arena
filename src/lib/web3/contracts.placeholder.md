# AvalancheArena Smart Contracts (Future)

These contracts are NOT deployed yet. The frontend uses `mockContracts.ts` and `arenaRewards.ts`
as drop-in replacements. To go live on Avalanche Fuji / C-Chain, deploy these and swap the imports.

| Contract | Responsibility | Mock file |
|---|---|---|
| `GameToken.sol` | ERC-20 ARENA, mint/burn rewards | `mockContracts.ts` (balance) + `arenaRewards.ts` (mint) |
| `WarriorNFT.sol` | ERC-721 warriors with on-chain stats | `mockContracts.ts` (`mintWarrior`, `mintStarterWarriors`) |
| `ChainNFT.sol` | ERC-721 deeds for L1 territory | not yet wired |
| `RewardDistributor.sol` | Oracle-fed match settlement | `arenaRewards.ts::settleMatchOnChain` |
| `GameRegistry.sol` | Match results registry | `arena_match_results` table |

Stack: Wagmi + Viem + Avalanche Fuji testnet (chainId `0xa869`).
EIP-1193 connect lives in `src/lib/wallet.ts`.