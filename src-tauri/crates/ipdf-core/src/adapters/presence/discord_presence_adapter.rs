use super::discord_presence_client::{DiscordPresenceClient, NativeDiscordPresenceClient};
use crate::core::ports::{PresenceActivity, PresenceHealth, PresenceProvider, ReadingActivity};

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

    fn format_reading_state(activity: &ReadingActivity) -> String {
        let pct = activity.percentage.clamp(0.0, 100.0);
        if let Some(ref chapter) = activity.chapter_title {
            if !chapter.trim().is_empty() {
                return format!(
                    "{} — Page {} of {} ({:.1}%)",
                    chapter.trim(),
                    activity.current_page,
                    activity.total_pages,
                    pct
                );
            }
        }
        format!(
            "Page {} of {} ({:.1}%)",
            activity.current_page, activity.total_pages, pct
        )
    }

    fn format_reading_details(activity: &ReadingActivity) -> String {
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

    fn publish_activity(&mut self, activity: &PresenceActivity) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        if !self.has_started {
            let _ = self.client.start();
            self.has_started = true;
        }

        let (details, state, start_time_secs, large_text) = match activity {
            PresenceActivity::Reading(reading) => {
                let details = Self::format_reading_details(reading);
                let state = Self::format_reading_state(reading);
                let start_time = reading.session_started_at_ms / 1000;
                (
                    details,
                    state,
                    start_time,
                    "Scholarium — Active Study Reader",
                )
            }
            PresenceActivity::Library {
                total_books,
                session_started_at_ms,
            } => {
                let details = "Browsing Library".to_string();
                let state = if *total_books == 1 {
                    "1 book in collection".to_string()
                } else {
                    format!("{total_books} books in collection")
                };
                let start_time = if *session_started_at_ms > 0 {
                    session_started_at_ms / 1000
                } else {
                    0
                };
                (details, state, start_time, "Scholarium — Library")
            }
            PresenceActivity::Annotations {
                total_annotations,
                session_started_at_ms,
            } => {
                let details = "Reviewing Annotations".to_string();
                let state = if *total_annotations == 1 {
                    "1 note taken".to_string()
                } else {
                    format!("{total_annotations} notes taken")
                };
                let start_time = if *session_started_at_ms > 0 {
                    session_started_at_ms / 1000
                } else {
                    0
                };
                (details, state, start_time, "Scholarium — Annotations")
            }
        };

        let res = self.client.set_activity(
            &details,
            &state,
            start_time_secs,
            Some("app_logo"),
            Some(large_text),
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

    fn check_health(&self) -> Result<PresenceHealth, String> {
        if !self.enabled {
            return Ok(PresenceHealth {
                ok: false,
                message: "Discord Rich Presence is disabled in settings".to_string(),
            });
        }
        self.client.check_health()
    }
}
