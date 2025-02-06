use poise::{command, 
    serenity_prelude::{
        GuildId, User,
        Timestamp,
    }
};
use chrono::Duration;
use rust_i18n::t;

use crate::{
    handlers::{
        error::{BotErr, BotError, Error, ErrorKind, ErrorOrigin},
        punishment::PunishmentHandler,
    },
    prisma::PunishmentType,
    utils, BotData,
    Context,
};

pub async fn action(
    ctx: Context<'_>,
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
        PunishmentType::Mute,
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

#[command(
    prefix_command,
    slash_command,
    user_cooldown = "2",
    track_edits, 
    guild_only,
    required_permissions = "MODERATE_MEMBERS"
)]
pub async fn prevent(
    ctx: Context<'_>,
    #[description = ""] user: User,
    #[description = ""] topcase: Option<bool>,
    #[description = ""] limit: Option<u8>,
) -> Result<(), BotErr> {
    let guild_id = 
        utils::matchs::required_guild_id(&ctx, t!("use.command.only_server").to_string().as_str()).await?;
    let http = ctx.serenity_context().http.clone();
    let mut member = guild_id.member(http, user.id).await?;
    let topcase = topcase.unwrap_or_else(|| false);
    let limit = limit.unwrap_or_else(|| 30);

    let end_time = Timestamp::now()
    .checked_add_signed(Duration::minutes(limit as i64))
    .ok_or_else(|| BotError::new(
        "Error calculating the end of the timeout.".to_string(),
        ErrorKind::Other,
        ErrorOrigin::Unknown,
    ))?;
    let end_timeout = Timestamp::from(end_time);

    member.disable_communication_until_datetime(&http, end_timeout).await?;

    let http_clone = http.clone();
    let guild_id_clone = guild_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(limit as u64 * 60)).await;
        if let Ok(mut mut_member) = guild_id_clone.member(&http_clone, user.id).await {
            let _ = mut_member.enable_communication(&http_clone).await;
        }
    });

    Ok(())
}