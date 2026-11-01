use super::discord_ipc_transport::{
    DiscordIpcTransport, NativeDiscordIpcTransport, OP_FRAME, OP_HANDSHAKE,
};
use crate::core::ports::{PresenceProvider, ReadingActivity};

pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1345829104928194600";

pub struct DiscordPresenceAdapter<T: DiscordIpcTransport> {
    id: String,
    client_id: String,
    enabled: bool,
    transport: T,
    has_handshake: bool,
    process_id: u32,
}

impl<T: DiscordIpcTransport> DiscordPresenceAdapter<T> {
    pub fn new(client_id: impl Into<String>, enabled: bool, transport: T) -> Self {
        Self {
            id: "discord".to_string(),
            client_id: client_id.into(),
            enabled,
            transport,
            has_handshake: false,
            process_id: std::process::id(),
        }
    }

    pub fn with_process_id(mut self, pid: u32) -> Self {
        self.process_id = pid;
        self
    }

    pub fn transport(&self) -> &T {
        &self.transport
    }

    pub fn transport_mut(&mut self) -> &mut T {
        &mut self.transport
    }

    fn ensure_connected(&mut self) -> Result<(), String> {
        if !self.transport.is_connected() {
            self.transport.connect()?;
            self.has_handshake = false;
        }

        if !self.has_handshake {
            let handshake_payload = serde_json::json!({
                "v": 1,
                "client_id": self.client_id
            });
            self.transport
                .send_frame(OP_HANDSHAKE, &handshake_payload.to_string())?;
            self.has_handshake = true;
        }

        Ok(())
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
            "Página {}/{} ({:.1}%)",
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

pub type NativeDiscordPresenceAdapter = DiscordPresenceAdapter<NativeDiscordIpcTransport>;

impl NativeDiscordPresenceAdapter {
    pub fn create_default(client_id: Option<String>, enabled: bool) -> Self {
        let cid = client_id.unwrap_or_else(|| DEFAULT_DISCORD_CLIENT_ID.to_string());
        Self::new(cid, enabled, NativeDiscordIpcTransport::new())
    }
}

impl<T: DiscordIpcTransport> PresenceProvider for DiscordPresenceAdapter<T> {
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
            self.transport.disconnect();
            self.has_handshake = false;
        }
    }

    fn publish_activity(&mut self, activity: &ReadingActivity) -> Result<(), String> {
        if !self.enabled {
            return Ok(());
        }

        self.ensure_connected()?;

        let details = Self::format_details_string(activity);
        let state = Self::format_state_string(activity);
        let start_time_secs = activity.session_started_at_ms / 1000;

        let payload = serde_json::json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": self.process_id,
                "activity": {
                    "details": details,
                    "state": state,
                    "timestamps": {
                        "start": start_time_secs
                    },
                    "assets": {
                        "large_image": "ipdf_logo",
                        "large_text": "IPDF Active Study Reader",
                        "small_image": match activity.state.as_str() {
                            "listening_tts" => "tts_audio",
                            "annotating" => "pencil_edit",
                            _ => "book_reading"
                        },
                        "small_text": match activity.state.as_str() {
                            "listening_tts" => "Ouvindo TTS",
                            "annotating" => "Anotando",
                            _ => "Lendo"
                        }
                    }
                }
            },
            "nonce": format!("{}", activity.current_page)
        });

        match self.transport.send_frame(OP_FRAME, &payload.to_string()) {
            Ok(_) => Ok(()),
            Err(e) => {
                self.transport.disconnect();
                self.has_handshake = false;
                Err(e)
            }
        }
    }

    fn clear_activity(&mut self) -> Result<(), String> {
        if !self.transport.is_connected() {
            return Ok(());
        }

        let payload = serde_json::json!({
            "cmd": "SET_ACTIVITY",
            "args": {
                "pid": self.process_id,
                "activity": null
            },
            "nonce": "clear"
        });

        let _ = self.transport.send_frame(OP_FRAME, &payload.to_string());
        Ok(())
    }
}
