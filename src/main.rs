#[macro_use]
extern crate rust_i18n;

use dotenv::dotenv;

use handlers::error::BotErr;
use poise::serenity_prelude as serenity;

use serenity::all::{ApplicationId, ClientBuilder, GatewayIntents, GuildId};
use std::{env, sync::Arc};
use tokio::sync::Mutex;

mod commands;
mod handlers;
#[allow(warnings, unused)]
mod prisma;
mod tests;
mod utils;

pub struct BotData {
    pub prisma: Arc<Mutex<prisma::PrismaClient>>,
}

pub type Context<'a> = poise::Context<'a, BotData, BotErr>;

rust_i18n::i18n!();

#[tokio::main]
async fn main() {
    dotenv().ok();

    let intents = GatewayIntents::GUILDS
        | GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::GUILD_MESSAGE_REACTIONS
        | GatewayIntents::GUILD_EMOJIS_AND_STICKERS
        | GatewayIntents::MESSAGE_CONTENT
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::DIRECT_MESSAGE_REACTIONS;

    let token = env::var("TOKEN").expect("Expected a token");
    let app_id: ApplicationId = env::var("CLIENT_ID")
        .expect("Expected a client id")
        .parse()
        .unwrap();

    env::remove_var("TOKEN");
    env::remove_var("CLIENT_ID");

    let prisma_client = Arc::new(Mutex::new(
        prisma::PrismaClient::_builder().build().await.unwrap(),
    ));

    let get_commands = commands::get_commands();
    let commands = handlers::i18n::I18nHandler::internationalize_slash(get_commands);

    let framework = poise::Framework::<BotData, BotErr>::builder()
        .options(poise::FrameworkOptions {
            commands,
            prefix_options: poise::PrefixFrameworkOptions {
                prefix: Some("f.".to_string()),
                ..Default::default()
            },
            event_handler: |ctx, event, _framework, _err| {
                Box::pin(async move {
                    let handler = handlers::event::Handler {};

                    handler.match_event(ctx, event).await;

                    Ok(())
                })
            },
            ..Default::default()
        })
        .setup(|ctx, _ready, framework| {
            Box::pin(async move {
                //poise::builtins::register_globally(ctx, &framework.options().commands).await?;

                // dev
                poise::builtins::register_in_guild(
                    ctx,
                    &framework.options().commands,
                    GuildId::new(1102710490922238042),
                )
                .await?;

                Ok(BotData {
                    prisma: prisma_client,
                })
            })
        })
        .build();

    let mut discord_client = ClientBuilder::new(&token, intents)
        .framework(framework)
        .application_id(app_id)
        .status(serenity::OnlineStatus::Online)
        .await
        .expect("Error creating client");

    discord_client.start().await.unwrap()
}
