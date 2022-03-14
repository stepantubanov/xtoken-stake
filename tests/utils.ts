import { Program, BN, web3 } from "@project-serum/anchor";
import {
  createAssociatedTokenAccountInstruction,
  createMint,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Stake1 } from "../target/types/stake_1";

export function findPoolAddress(
  xToken: web3.PublicKey,
  programId: web3.PublicKey
): Promise<[web3.PublicKey, number]> {
  return web3.PublicKey.findProgramAddress(
    [Buffer.from("pool"), xToken.toBuffer()],
    programId
  );
}

export function findSTokenAddress(
  xToken: web3.PublicKey,
  programId: web3.PublicKey
): Promise<[web3.PublicKey, number]> {
  return web3.PublicKey.findProgramAddress(
    [Buffer.from("stoken"), xToken.toBuffer()],
    programId
  );
}

export type StakeContext = {
  programId: web3.PublicKey;
  xToken: web3.PublicKey;
  sToken: web3.PublicKey;
  sTokenBump: number;
  pool: web3.PublicKey;
  poolBump: number;
};

export async function deriveStakeContext(
  programId: web3.PublicKey,
  xToken: web3.PublicKey
): Promise<StakeContext> {
  const [[pool, poolBump], [sToken, sTokenBump]] = await Promise.all([
    findPoolAddress(xToken, programId),
    findSTokenAddress(xToken, programId),
  ]);

  return {
    programId,
    xToken,
    sToken,
    sTokenBump,
    pool,
    poolBump,
  };
}

export async function initialize(
  program: Program<Stake1>,
  ctx: StakeContext,
  payer: web3.Signer
): Promise<string> {
  return program.rpc.initialize({
    accounts: {
      xToken: ctx.xToken,
      sToken: ctx.sToken,
      pool: ctx.pool,
      payer: payer.publicKey,
      rent: web3.SYSVAR_RENT_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    },
    signers: [payer],
  });
}

export async function createSTokenAccounts(
  connection: web3.Connection,
  sToken: web3.PublicKey,
  payer: web3.Signer,
  owners: web3.PublicKey[]
) {
  const transaction = new web3.Transaction();
  for (const owner of owners) {
    const addr = await getAssociatedTokenAddress(sToken, owner);
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        addr,
        owner,
        sToken
      )
    );
  }
  await web3.sendAndConfirmTransaction(connection, transaction, [payer]);
}

async function stakeOrUnstake(
  action: "stake" | "unstake",
  program: Program<Stake1>,
  ctx: StakeContext,
  user: web3.Signer,
  amount: number
): Promise<string> {
  const xTokenAta = await getAssociatedTokenAddress(ctx.xToken, user.publicKey);
  const sTokenAta = await getAssociatedTokenAddress(ctx.sToken, user.publicKey);

  return program.rpc[action](ctx.sTokenBump, ctx.poolBump, new BN(amount), {
    accounts: {
      sToken: ctx.sToken,
      xTokenAta,
      sTokenAta,
      pool: ctx.pool,
      owner: user.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [user],
  });
}

export function stake(
  program: Program<Stake1>,
  ctx: StakeContext,
  user: web3.Signer,
  amount: number
): Promise<string> {
  return stakeOrUnstake("stake", program, ctx, user, amount);
}

export function unstake(
  program: Program<Stake1>,
  ctx: StakeContext,
  user: web3.Signer,
  amount: number
): Promise<string> {
  return stakeOrUnstake("unstake", program, ctx, user, amount);
}

// General-purpose utility functions

async function createUser(connection: web3.Connection): Promise<web3.Signer> {
  const user = web3.Keypair.generate();
  const tx = await connection.requestAirdrop(
    user.publicKey,
    web3.LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx);
  return user;
}

export async function createUsers(
  connection: web3.Connection,
  numUsers: number
): Promise<web3.Signer[]> {
  const users = [];
  for (let i = 0; i < numUsers; i += 1) {
    users.push(createUser(connection));
  }
  return Promise.all(users);
}

export async function createTokenAndMint(
  connection: web3.Connection,
  admin: web3.Signer,
  recipients: web3.PublicKey[],
  amount: number
): Promise<web3.PublicKey> {
  const mint = await createMint(
    connection,
    admin,
    admin.publicKey,
    admin.publicKey,
    9
  );

  const transaction = new web3.Transaction();
  const recpWithAddresses = await Promise.all(
    recipients.map(async (recipient) => {
      return [recipient, await getAssociatedTokenAddress(mint, recipient)];
    })
  );

  for (const [recipient, addr] of recpWithAddresses) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        admin.publicKey,
        addr,
        recipient,
        mint
      ),
      createMintToInstruction(mint, addr, admin.publicKey, amount)
    );
  }

  await web3.sendAndConfirmTransaction(connection, transaction, [admin]);
  return mint;
}

export async function getTokenBalance(
  connection: web3.Connection,
  mint: web3.PublicKey,
  owner: web3.PublicKey
): Promise<number> {
  const addr = await getAssociatedTokenAddress(mint, owner, true);
  const account = await getAccount(connection, addr);
  return Number(account.amount);
}
