use poise::Context;
use serenity::all::{GuildId, User};

use crate::{
    handlers::{
        error::{BotErr, BotError, Error, ErrorKind, ErrorOrigin},
        punishment::PunishmentHandler,
    },
    prisma::PunishmentType,
    utils, BotData,
};

pub async fn action(
    ctx: Context<'_, BotData, BotErr>,
    guild_id: GuildId,
    user: User,
    reason: String,
) -> Result<(), BotErr> {
    let http = ctx.http();

    //let member = guild_id.member(&http, user.id).await?;
    //member.kick_with_reason(&http, reason.as_str()).await?;

    let create_punishment = PunishmentHandler {
        guild_id,
        prisma: ctx.data().prisma.clone(),
    }
    .add(
        user.id,
        ctx.author().id,
        PunishmentType::Kick,
        reason,
        ctx.created_at().to_utc(),
        ctx.created_at().to_utc(),
    )
    .await;

    if let Err(err) = create_punishment {
        return Err(BotError::new(
            err.to_string(),
            ErrorKind::Other,
            ErrorOrigin::Unknown,
        ));
    }

    Ok(())
}

/// Kick a user and specify a reason!
#[poise::command(slash_command)]
pub async fn kick(
    ctx: Context<'_, BotData, BotErr>,
    user: User,
    reason: String,
    ephemeral: Option<
        bool,
    >,
) -> Result<(), BotErr> {
    utils::matchs::ephemeral(&ctx, ephemeral).await?;

    let guild_id =
        utils::matchs::required_guild_id(&ctx, t!("use.command.only_server").to_string().as_str()).await?;

    action(ctx, guild_id, user, reason.to_string()).await?;

    ctx.say(t!("reply.kick.success")).await?;

    Ok(())
}
