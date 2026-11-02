use crate::core::ports::PresenceHealth;

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
    fn check_health(&self) -> Result<PresenceHealth, String>;
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod desktop {
    use super::*;
    use discord_presence::Client as DiscordRpcClient;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc::{channel, Sender};
    use std::sync::Arc;

    enum DiscordWorkerCommand {
        Start,
        SetActivity {
            details: String,
            state: String,
            start_time_secs: i64,
            large_image: Option<String>,
            large_text: Option<String>,
        },
        ClearActivity,
    }

    pub struct NativeDiscordPresenceClient {
        tx: Sender<DiscordWorkerCommand>,
        started: Arc<AtomicBool>,
        ready: Arc<AtomicBool>,
    }

    impl NativeDiscordPresenceClient {
        pub fn new(client_id: u64) -> Self {
            let mut client = DiscordRpcClient::new(client_id);
            let started = Arc::new(AtomicBool::new(false));
            let ready = Arc::new(AtomicBool::new(false));

            let ready_clone = Arc::clone(&ready);
            client
                .on_ready(move |_| {
                    ready_clone.store(true, Ordering::SeqCst);
                })
                .persist();

            let ready_for_err = Arc::clone(&ready);
            client
                .on_error(move |_| {
                    ready_for_err.store(false, Ordering::SeqCst);
                })
                .persist();

            let (tx, rx) = channel::<DiscordWorkerCommand>();

            let _ = std::thread::Builder::new()
                .name("discord-presence-worker".to_string())
                .spawn(move || {
                    while let Ok(cmd) = rx.recv() {
                        match cmd {
                            DiscordWorkerCommand::Start => {
                                client.start();
                            }
                            DiscordWorkerCommand::SetActivity {
                                details,
                                state,
                                start_time_secs,
                                large_image,
                                large_text,
                            } => {
                                let res = client.set_activity(|act| {
                                    let mut act = act.details(details.clone()).state(state.clone());
                                    if start_time_secs > 0 {
                                        act = act.timestamps(|t| t.start(start_time_secs as u64));
                                    }
                                    if let (Some(ref img), Some(ref txt)) =
                                        (&large_image, &large_text)
                                    {
                                        act = act.assets(|a| a.large_image(img).large_text(txt));
                                    }
                                    act
                                });

                                if res.is_err() && (large_image.is_some() || large_text.is_some()) {
                                    let _ = client.set_activity(|act| {
                                        let mut act = act.details(details).state(state);
                                        if start_time_secs > 0 {
                                            act =
                                                act.timestamps(|t| t.start(start_time_secs as u64));
                                        }
                                        act
                                    });
                                }
                            }
                            DiscordWorkerCommand::ClearActivity => {
                                let _ = client.clear_activity();
                            }
                        }
                    }
                });

            Self { tx, started, ready }
        }
    }

    impl DiscordPresenceClient for NativeDiscordPresenceClient {
        fn is_started(&self) -> bool {
            self.started.load(Ordering::SeqCst)
        }

        fn start(&mut self) -> Result<(), String> {
            self.started.store(true, Ordering::SeqCst);
            self.tx
                .send(DiscordWorkerCommand::Start)
                .map_err(|e| e.to_string())
        }

        fn set_activity(
            &mut self,
            details: &str,
            state: &str,
            start_time_secs: i64,
            large_image: Option<&str>,
            large_text: Option<&str>,
        ) -> Result<(), String> {
            self.tx
                .send(DiscordWorkerCommand::SetActivity {
                    details: details.to_string(),
                    state: state.to_string(),
                    start_time_secs,
                    large_image: large_image.map(|s| s.to_string()),
                    large_text: large_text.map(|s| s.to_string()),
                })
                .map_err(|e| e.to_string())
        }

        fn clear_activity(&mut self) -> Result<(), String> {
            self.tx
                .send(DiscordWorkerCommand::ClearActivity)
                .map_err(|e| e.to_string())
        }

        fn check_health(&self) -> Result<PresenceHealth, String> {
            let is_ready = self.ready.load(Ordering::SeqCst) || DiscordRpcClient::is_ready();
            if is_ready {
                Ok(PresenceHealth {
                    ok: true,
                    message: "Connected to Discord client".to_string(),
                })
            } else {
                Ok(PresenceHealth {
                    ok: false,
                    message: "Discord client is not running or not detected".to_string(),
                })
            }
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop::NativeDiscordPresenceClient;

#[cfg(any(target_os = "android", target_os = "ios"))]
mod mobile {
    use super::*;

    pub struct NativeDiscordPresenceClient;

    impl NativeDiscordPresenceClient {
        pub fn new(_client_id: u64) -> Self {
            Self
        }
    }

    impl DiscordPresenceClient for NativeDiscordPresenceClient {
        fn is_started(&self) -> bool {
            false
        }

        fn start(&mut self) -> Result<(), String> {
            Ok(())
        }

        fn set_activity(
            &mut self,
            _details: &str,
            _state: &str,
            _start_time_secs: i64,
            _large_image: Option<&str>,
            _large_text: Option<&str>,
        ) -> Result<(), String> {
            Ok(())
        }

        fn clear_activity(&mut self) -> Result<(), String> {
            Ok(())
        }

        fn check_health(&self) -> Result<PresenceHealth, String> {
            Ok(PresenceHealth {
                ok: false,
                message: "Discord Rich Presence requires a Desktop OS (Linux, Windows, macOS)"
                    .to_string(),
            })
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub use mobile::NativeDiscordPresenceClient;
