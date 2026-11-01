use discord_presence::Client as DiscordRpcClient;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

pub trait DiscordPresenceClient: Send {
    fn is_started(&self) -> bool;
    fn start(&mut self) -> Result<(), String>;
    fn set_activity(
        &mut self,
        details: &str,
        state: &str,
        start_time_secs: i64,
        large_image: Option<&str>,
        large_text: Option<&str>,
    ) -> Result<(), String>;
    fn clear_activity(&mut self) -> Result<(), String>;
}

pub struct NativeDiscordPresenceClient {
    client: DiscordRpcClient,
    started: Arc<AtomicBool>,
}

impl NativeDiscordPresenceClient {
    pub fn new(client_id: u64) -> Self {
        let client = DiscordRpcClient::new(client_id);
        let started = Arc::new(AtomicBool::new(false));
        let started_clone = Arc::clone(&started);
        client
            .on_ready(move |_| {
                started_clone.store(true, Ordering::SeqCst);
            })
            .persist();
        Self { client, started }
    }
}

impl DiscordPresenceClient for NativeDiscordPresenceClient {
    fn is_started(&self) -> bool {
        self.started.load(Ordering::SeqCst)
    }

    fn start(&mut self) -> Result<(), String> {
        self.client.start();
        Ok(())
    }

    fn set_activity(
        &mut self,
        details: &str,
        state: &str,
        start_time_secs: i64,
        large_image: Option<&str>,
        large_text: Option<&str>,
    ) -> Result<(), String> {
        let details = details.to_string();
        let state = state.to_string();
        let large_image = large_image.map(|s| s.to_string());
        let large_text = large_text.map(|s| s.to_string());

        self.client
            .set_activity(|act| {
                let mut act = act.details(details).state(state);
                if start_time_secs > 0 {
                    act = act.timestamps(|t| t.start(start_time_secs as u64));
                }
                if let (Some(img), Some(txt)) = (large_image, large_text) {
                    act = act.assets(|a| a.large_image(img).large_text(txt));
                }
                act
            })
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    fn clear_activity(&mut self) -> Result<(), String> {
        self.client
            .clear_activity()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}
