use crate::core::ports::{PresenceProvider, ReadingActivity};

pub struct RichPresenceManager {
    providers: Vec<Box<dyn PresenceProvider + Send>>,
    debounce_ms: i64,
    last_dispatched_at_ms: Option<i64>,
}

impl RichPresenceManager {
    pub fn new(debounce_ms: i64) -> Self {
        Self {
            providers: Vec::new(),
            debounce_ms,
            last_dispatched_at_ms: None,
        }
    }

    pub fn register_provider<P: PresenceProvider + Send + 'static>(&mut self, provider: P) {
        self.providers.push(Box::new(provider));
    }

    pub fn register_boxed_provider(&mut self, provider: Box<dyn PresenceProvider + Send>) {
        self.providers.push(provider);
    }

    pub fn set_provider_enabled(&mut self, id: &str, enabled: bool) {
        for provider in &mut self.providers {
            if provider.id() == id {
                provider.set_enabled(enabled);
                if !enabled {
                    let _ = provider.clear_activity();
                }
            }
        }
    }

    pub fn update_activity(&mut self, activity: &ReadingActivity, now_ms: i64, immediate: bool) {
        if !immediate {
            if let Some(last_ms) = self.last_dispatched_at_ms {
                if now_ms - last_ms < self.debounce_ms {
                    return;
                }
            }
        }
        self.last_dispatched_at_ms = Some(now_ms);
        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.publish_activity(activity);
            }
        }
    }

    pub fn clear_all_presence(&mut self) {
        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.clear_activity();
            }
        }
    }
}
