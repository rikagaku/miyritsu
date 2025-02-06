use serenity::all::{Context, EventHandler, Message, Ready};
use poise::serenity_prelude::FullEvent;
use serenity::async_trait;

pub struct Handler;

#[async_trait]
impl EventHandler for Handler {
    async fn ready(&self, _ctx: Context, _ready: Ready) {
        println!("{} is connected!", _ready.user.name);
    }
    async fn message(&self, _ctx: Context, _msg: Message) {
        println!("{} said: {}", _msg.author.name, _msg.content);
    }
}

impl Handler {
    pub async fn match_event(&self, ctx: &Context, event: &FullEvent) -> () {
        match event {
            FullEvent::Message { new_message } => {
                self.message(ctx.clone(), new_message.clone()).await;
            }
            FullEvent::Ready { data_about_bot } => {
                self.ready(ctx.clone(), data_about_bot.clone()).await;
            }
            _ => {}
        }
    }
}