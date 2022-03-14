use anchor_lang::prelude::*;
use anchor_spl::token;

declare_id!("2g6awRdSpC1hdzqyFvJnpwoocpFG6oAKaGkS6J4XcwEZ");

fn transfer_to_pool<'a, 'b>(
    accounts: &'a StakeUnstake<'b>,
) -> CpiContext<'a, 'a, 'a, 'b, token::Transfer<'b>> {
    let StakeUnstake {
        x_token_ata,
        pool,
        owner,
        token_program,
        ..
    } = accounts;

    CpiContext::new(
        token_program.to_account_info(),
        token::Transfer {
            from: x_token_ata.to_account_info(),
            to: pool.to_account_info(),
            authority: owner.to_account_info(),
        },
    )
}

fn transfer_from_pool<'a, 'b>(
    accounts: &'a StakeUnstake<'b>,
    seeds: &'a [&'a [&'a [u8]]],
) -> CpiContext<'a, 'a, 'a, 'b, token::Transfer<'b>> {
    let StakeUnstake {
        x_token_ata,
        pool,
        token_program,
        ..
    } = accounts;

    CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::Transfer {
            from: pool.to_account_info(),
            to: x_token_ata.to_account_info(),
            authority: pool.to_account_info(),
        },
        seeds,
    )
}

fn s_token_mint<'a, 'b>(
    accounts: &'a StakeUnstake<'b>,
    seeds: &'a [&'a [&'a [u8]]],
) -> CpiContext<'a, 'a, 'a, 'b, token::MintTo<'b>> {
    let StakeUnstake {
        s_token,
        s_token_ata,
        pool,
        token_program,
        ..
    } = accounts;

    CpiContext::new_with_signer(
        token_program.to_account_info(),
        token::MintTo {
            mint: s_token.to_account_info(),
            to: s_token_ata.to_account_info(),
            authority: pool.to_account_info(),
        },
        seeds,
    )
}

fn s_token_burn<'a, 'b>(
    accounts: &'a StakeUnstake<'b>,
) -> CpiContext<'a, 'a, 'a, 'b, token::Burn<'b>> {
    let StakeUnstake {
        s_token,
        s_token_ata,
        owner,
        token_program,
        ..
    } = accounts;

    CpiContext::new(
        token_program.to_account_info(),
        token::Burn {
            mint: s_token.to_account_info(),
            to: s_token_ata.to_account_info(),
            authority: owner.to_account_info(),
        },
    )
}

#[program]
pub mod stake_1 {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn stake(
        ctx: Context<StakeUnstake>,
        _s_token_bump: u8,
        pool_bump: u8,
        amount: u64,
    ) -> Result<()> {
        let x_token = ctx.accounts.x_token_ata.mint;
        let seeds = [b"pool", x_token.as_ref(), &[pool_bump]];

        token::transfer(transfer_to_pool(&ctx.accounts), amount)?;
        token::mint_to(s_token_mint(&ctx.accounts, &[&seeds[..]]), amount)?;

        Ok(())
    }

    pub fn unstake(
        ctx: Context<StakeUnstake>,
        _s_token_bump: u8,
        pool_bump: u8,
        amount: u64,
    ) -> Result<()> {
        let x_token = ctx.accounts.x_token_ata.mint;
        let seeds = [b"pool", x_token.as_ref(), &[pool_bump]];

        token::transfer(transfer_from_pool(&ctx.accounts, &[&seeds[..]]), amount)?;
        token::burn(s_token_burn(&ctx.accounts), amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    pub x_token: Account<'info, token::Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = x_token,
        token::authority = pool,
        seeds = [b"pool", x_token.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, token::TokenAccount>,

    #[account(
        init,
        payer = payer,
        mint::decimals = x_token.decimals,
        mint::authority = pool,
        seeds = [b"stoken", x_token.key().as_ref()],
        bump
    )]
    pub s_token: Account<'info, token::Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, token::Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(s_token_bump: u8, pool_bump: u8)]
pub struct StakeUnstake<'info> {
    #[account(mut, seeds = [b"stoken", x_token_ata.mint.as_ref()], bump = s_token_bump)]
    pub s_token: Account<'info, token::Mint>,

    #[account(mut, has_one = owner)]
    pub x_token_ata: Account<'info, token::TokenAccount>,

    #[account(mut, has_one = owner)]
    pub s_token_ata: Account<'info, token::TokenAccount>,

    #[account(mut, seeds = [b"pool", x_token_ata.mint.as_ref()], bump = pool_bump)]
    pub pool: Account<'info, token::TokenAccount>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, token::Token>,
}
