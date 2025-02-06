use crate::BotData;

pub mod moderation;
pub mod conf;
pub mod util;

pub fn get_commands() -> Vec<poise::Command<BotData, crate::handlers::error::BotErr>> {
    vec![
        util::ping::ping(),
        moderation::kick::kick(),
    ]
}