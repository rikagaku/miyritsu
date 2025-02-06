use poise::Context;
use serenity::all::GuildId;

use crate::{
    handlers::error::{BotErr, BotError, Error, ErrorKind, ErrorOrigin},
    BotData,
};

pub async fn ephemeral(
    ctx: &Context<'_, BotData, BotErr>,
    ephemeral: Option<bool>,
) -> Result<(), BotErr> {
    if ephemeral.is_none() || ephemeral.unwrap() {
        ctx.defer_ephemeral().await?;
    } else {
        ctx.defer().await?;
    }

    Ok(())
}

pub async fn required_guild_id(
    ctx: &Context<'_, BotData, BotErr>,
    error_msg: &str,
) -> Result<GuildId, BotErr> {
    let guild_id = match ctx.guild_id() {
        Some(guild_id) => guild_id,
        None => {
            return Err(BotError::new(
                error_msg.to_string(),
                ErrorKind::Other,
                ErrorOrigin::User,
            ))
        }
    };

    Ok(guild_id)
}
