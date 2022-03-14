import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";
import { Stake1 } from "../target/types/stake_1";
import {
  createSTokenAccounts,
  createTokenAndMint,
  createUsers,
  deriveStakeContext,
  getTokenBalance,
  initialize,
  stake,
  unstake,
} from "./utils";

describe("stake-1", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.Stake1 as Program<Stake1>;

  it("creates associated accounts on initialize", async () => {
    const provider = anchor.getProvider();
    const [admin, alice, bob] = await createUsers(provider.connection, 3);

    // Set up xToken accounts

    const xToken = await createTokenAndMint(
      provider.connection,
      admin,
      [alice.publicKey, bob.publicKey],
      10_000
    );

    // Initialize staking pool

    const ctx = await deriveStakeContext(program.programId, xToken);

    const initTx = await initialize(program, ctx, admin);
    await provider.connection.confirmTransaction(initTx);

    // Set up sToken accounts

    await createSTokenAccounts(provider.connection, ctx.sToken, admin, [
      alice.publicKey,
      bob.publicKey,
    ]);

    // Stake

    const stakeTx = await Promise.all([
      stake(program, ctx, alice, 3_000),
      stake(program, ctx, bob, 7_000),
    ]);

    await Promise.all(
      stakeTx.map((tx) => provider.connection.confirmTransaction(tx))
    );

    // Verify balances

    const xTokenAccounts = await Promise.all([
      getTokenBalance(provider.connection, xToken, alice.publicKey),
      getTokenBalance(provider.connection, xToken, bob.publicKey),
    ]);
    expect(xTokenAccounts).to.have.members([7_000, 3_000]);

    const sTokenAccounts = await Promise.all([
      getTokenBalance(provider.connection, ctx.sToken, alice.publicKey),
      getTokenBalance(provider.connection, ctx.sToken, bob.publicKey),
    ]);
    expect(sTokenAccounts).to.have.members([3_000, 7_000]);

    // Unstake

    const unstakeTx = await Promise.all([
      unstake(program, ctx, alice, 2_000),
      unstake(program, ctx, bob, 7_000),
    ]);

    await Promise.all(
      stakeTx.map((tx) => provider.connection.confirmTransaction(tx))
    );

    // Verify balances

    const xTokenAccounts2 = await Promise.all([
      getTokenBalance(provider.connection, xToken, alice.publicKey),
      getTokenBalance(provider.connection, xToken, bob.publicKey),
    ]);
    expect(xTokenAccounts2).to.have.members([9_000, 10_000]);

    const sTokenAccounts2 = await Promise.all([
      getTokenBalance(provider.connection, ctx.sToken, alice.publicKey),
      getTokenBalance(provider.connection, ctx.sToken, bob.publicKey),
    ]);
    expect(sTokenAccounts2).to.have.members([1_000, 0_000]);
  });
});
