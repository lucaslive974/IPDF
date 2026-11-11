pub mod discord_presence_adapter;
pub mod discord_presence_client;

pub use discord_presence_adapter::{
    DiscordPresenceAdapter, NativeDiscordPresenceAdapter, DEFAULT_DISCORD_CLIENT_ID,
};
pub use discord_presence_client::{DiscordPresenceClient, NativeDiscordPresenceClient};
