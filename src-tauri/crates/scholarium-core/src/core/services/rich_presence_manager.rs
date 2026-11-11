use crate::core::ports::{PresenceActivity, PresenceHealth, PresenceProvider, ReadingActivity};

pub struct RichPresenceManager {
    providers: Vec<Box<dyn PresenceProvider + Send>>,
    debounce_ms: i64,
    last_dispatched_at_ms: Option<i64>,
    app_started_at_ms: i64,
    last_activity_signature: Option<String>,
}

impl RichPresenceManager {
    pub fn new(debounce_ms: i64) -> Self {
        Self {
            providers: Vec::new(),
            debounce_ms,
            last_dispatched_at_ms: None,
            app_started_at_ms: 0,
            last_activity_signature: None,
        }
    }

    pub fn new_with_start_time(debounce_ms: i64, app_started_at_ms: i64) -> Self {
        Self {
            providers: Vec::new(),
            debounce_ms,
            last_dispatched_at_ms: None,
            app_started_at_ms,
            last_activity_signature: None,
        }
    }

    pub fn app_started_at_ms(&self) -> i64 {
        self.app_started_at_ms
    }

    pub fn set_app_started_at_ms(&mut self, timestamp: i64) {
        self.app_started_at_ms = timestamp;
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

    pub fn is_provider_enabled(&self, id: &str) -> bool {
        self.providers
            .iter()
            .find(|p| p.id() == id)
            .is_some_and(|p| p.is_enabled())
    }

    fn activity_signature(activity: &PresenceActivity) -> String {
        match activity {
            PresenceActivity::Reading(r) => format!("reading:{}", r.book_hash),
            PresenceActivity::Library { .. } => "library".to_string(),
            PresenceActivity::Annotations { .. } => "annotations".to_string(),
        }
    }

    pub fn update_activity(&mut self, activity: &PresenceActivity, now_ms: i64, immediate: bool) {
        let signature = Self::activity_signature(activity);
        let is_context_change = self.last_activity_signature.as_ref() != Some(&signature);

        let should_bypass_debounce = immediate || is_context_change;

        if !should_bypass_debounce {
            if let Some(last_ms) = self.last_dispatched_at_ms {
                if now_ms - last_ms < self.debounce_ms {
                    return;
                }
            }
        }

        self.last_dispatched_at_ms = Some(now_ms);
        self.last_activity_signature = Some(signature);

        if self.app_started_at_ms <= 0 {
            self.app_started_at_ms = now_ms;
        }
        let app_start = self.app_started_at_ms;

        let normalized_activity = match activity {
            PresenceActivity::Reading(r) => {
                let mut r = r.clone();
                r.session_started_at_ms = app_start;
                PresenceActivity::Reading(r)
            }
            PresenceActivity::Library { total_books, .. } => PresenceActivity::Library {
                total_books: *total_books,
                session_started_at_ms: app_start,
            },
            PresenceActivity::Annotations {
                total_annotations, ..
            } => PresenceActivity::Annotations {
                total_annotations: *total_annotations,
                session_started_at_ms: app_start,
            },
        };

        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.publish_activity(&normalized_activity);
            }
        }
    }

    pub fn update_reading_activity(
        &mut self,
        reading: &ReadingActivity,
        now_ms: i64,
        immediate: bool,
    ) {
        self.update_activity(
            &PresenceActivity::Reading(reading.clone()),
            now_ms,
            immediate,
        );
    }

    pub fn clear_all_presence(&mut self) {
        self.last_activity_signature = None;
        for provider in &mut self.providers {
            if provider.is_enabled() {
                let _ = provider.clear_activity();
            }
        }
    }

    pub fn check_provider_health(&self, id: &str) -> Result<PresenceHealth, String> {
        let provider = self
            .providers
            .iter()
            .find(|p| p.id() == id)
            .ok_or_else(|| format!("Presence provider '{id}' not found"))?;

        provider.check_health()
    }
}
