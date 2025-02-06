use poise::Context;

use crate::{handlers::error::BotErr, BotData};

/// Check the heartbeat of the gateway
#[poise::command(slash_command)]
pub async fn ping(ctx: Context<'_, BotData, BotErr>) -> Result<(), BotErr> {
    let ping = ctx.ping().await;

    ctx.say(t!(
        "log.current.gateway_heartbeat",
        heartbeat = ping.as_millis().to_string()
    ))
    .await?;

    Ok(())
}
