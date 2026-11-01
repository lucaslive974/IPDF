use super::discord_presence_client::{DiscordPresenceClient, NativeDiscordPresenceClient};
use crate::core::ports::{PresenceProvider, ReadingActivity};

pub const DEFAULT_DISCORD_CLIENT_ID: u64 = 1566424463602356286;

pub struct DiscordPresenceAdapter<C: DiscordPresenceClient> {
    id: String,
    client_id: u64,
    enabled: bool,
    client: C,
    has_started: bool,
}

impl<C: DiscordPresenceClient> DiscordPresenceAdapter<C> {
    pub fn new(client_id: u64, enabled: bool, client: C) -> Self {
        Self {
            id: "discord".to_string(),
            client_id,
            enabled,
            client,
            has_started: false,
        }
    }

    pub fn client(&self) -> &C {
        &self.client
    }

    pub fn client_mut(&mut self) -> &mut C {
        &mut self.client
    }

    pub fn client_id(&self) -> u64 {
        self.client_id
    }

    fn format_state_string(activity: &ReadingActivity) -> String {
        let pct = activity.percentage.clamp(0.0, 100.0);
        if let Some(ref chapter) = activity.chapter_title {
            if !chapter.trim().is_empty() {
                return format!(
                    "{} — Pág. {}/{} ({:.1}%)",
                    chapter.trim(),
                    activity.current_page,
                    activity.total_pages,
                    pct
                );
            }
        }
        format!(
            "Página {} de {} ({:.1}%)",
            activity.current_page, activity.total_pages, pct
        )
    }

    fn format_details_string(activity: &ReadingActivity) -> String {
        if activity.book_author.trim().is_empty() || activity.book_author == "Unknown" {
            activity.book_title.clone()
        } else {
            format!("{} — {}", activity.book_title, activity.book_author)
        }
    }
}

pub type NativeDiscordPresenceAdapter = DiscordPresenceAdapter<NativeDiscordPresenceClient>;

impl NativeDiscordPresenceAdapter {
    pub fn create_default(client_id: Option<u64>, enabled: bool) -> Self {
        let cid = client_id.unwrap_or(DEFAULT_DISCORD_CLIENT_ID);
        Self::new(cid, enabled, NativeDiscordPresenceClient::new(cid))
    }
}

impl<C: DiscordPresenceClient> PresenceProvider for DiscordPresenceAdapter<C> {
    fn id(&self) -> &str {
        &self.id
    }

    fn is_enabled(&self) -> bool {
        self.enabled
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            let _ = self.clear_activity();
        }
    }

    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        if !self.has_started {
            let _ = self.client.start();
            self.has_started = true;
        }

        let details = Self::format_details_string(activity);
        let state = Self::format_state_string(activity);
        let start_time_secs = activity.session_started_at_ms / 1000;

        let res = self.client.set_activity(
            &details,
            &state,
            start_time_secs,
            Some("app_logo"),
            Some("Scholarium — Active Study Reader"),
        );

        if res.is_err() {
            let _ = self
                .client
                .set_activity(&details, &state, start_time_secs, None, None);
        }

        Ok(())
    }

    fn clear_activity(&mut self) -> Result<(), String> {
        self.client.clear_activity()
    }
}
