## README

Solana Anchor program which allows users to stake an xToken (SPL token) and
receive 1:1 amount of sToken (newly created token) in return.

- **initialize** (once per xToken).

  - xToken (existing): mint address of an existing token to stake.
  - pool (new, PDA): token associated account used to store staked xTokens and an authority to mint sTokens.
  - sToken (new, PDA): mint address of the new token (proof of staked xToken).
  - payer (signer): funds rent-exempt pool, sToken account creation.

- **stake** (sTokenBump, poolBump, amount)

  - sToken (existing, PDA): mint address of sToken.
  - xTokenAta (existing): user's ATA to debit "amount" of xToken.
  - sTokenAta (existing): user's ATA to credit "amount" of newly minted sToken.
  - pool (existing, PDA): program's xToken ATA and sToken mint authority.
  - owner (signer): user performing the stake operation.

- **unstake** (sTokenBump, poolBump, amount)

  - sToken (existing, PDA): mint address of sToken.
  - xTokenAta (existing): user's ATA to credit "amount" of xToken.
  - sTokenAta (existing): user's ATA to burn "amount" of sToken.
  - pool (existing, PDA): program's xToken ATA and sToken mint authority.
  - owner (signer): user performing the stake operation.

ATA = Associated Token Account.
