use crate::core::ports::{
    MediaControlService, MediaMetadata, PlaybackState, PowerSaveBlocker, SpeakOptions, TtsProvider,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SentenceQueueItem {
    pub id: String,
    pub text: String,
}

pub struct TtsSessionManager<T, M, W>
where
    T: TtsProvider,
    M: MediaControlService,
    W: PowerSaveBlocker,
{
    tts: T,
    media_controls: M,
    power_blocker: W,
    queue: Vec<SentenceQueueItem>,
    current_index: usize,
    state: PlaybackState,
    options: SpeakOptions,
}

impl<T, M, W> TtsSessionManager<T, M, W>
where
    T: TtsProvider,
    M: MediaControlService,
    W: PowerSaveBlocker,
{
    pub fn new(tts: T, media_controls: M, power_blocker: W, options: SpeakOptions) -> Self {
        Self {
            tts,
            media_controls,
            power_blocker,
            queue: Vec::new(),
            current_index: 0,
            state: PlaybackState::None,
            options,
        }
    }

    pub fn start_session(
        &mut self,
        metadata: &MediaMetadata,
        sentences: Vec<SentenceQueueItem>,
    ) -> Result<Option<SentenceQueueItem>, String> {
        self.tts.initialize()?;
        self.queue = sentences;
        self.current_index = 0;

        if self.queue.is_empty() {
            self.stop()?;
            return Ok(None);
        }

        self.media_controls.set_metadata(metadata)?;
        self.media_controls
            .set_playback_state(PlaybackState::Playing)?;
        self.power_blocker.keep_screen_awake(true)?;
        self.state = PlaybackState::Playing;

        self.speak_current_and_prefetch_next()
    }

    pub fn advance_to_next(&mut self) -> Result<Option<SentenceQueueItem>, String> {
        if self.current_index + 1 >= self.queue.len() {
            self.stop()?;
            return Ok(None);
        }
        self.current_index += 1;
        self.speak_current_and_prefetch_next()
    }

    pub fn pause(&mut self) -> Result<(), String> {
        self.tts.pause()?;
        self.media_controls
            .set_playback_state(PlaybackState::Paused)?;
        self.power_blocker.keep_screen_awake(false)?;
        self.state = PlaybackState::Paused;
        Ok(())
    }

    pub fn resume(&mut self) -> Result<(), String> {
        self.tts.resume()?;
        self.media_controls
            .set_playback_state(PlaybackState::Playing)?;
        self.power_blocker.keep_screen_awake(true)?;
        self.state = PlaybackState::Playing;
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        self.tts.stop()?;
        self.media_controls
            .set_playback_state(PlaybackState::None)?;
        self.power_blocker.keep_screen_awake(false)?;
        self.state = PlaybackState::None;
        Ok(())
    }

    pub fn playback_state(&self) -> PlaybackState {
        self.state
    }

    fn speak_current_and_prefetch_next(&mut self) -> Result<Option<SentenceQueueItem>, String> {
        let Some(current) = self.queue.get(self.current_index).cloned() else {
            return Ok(None);
        };

        self.tts.speak(&current.id, &current.text, &self.options)?;

        if let Some(next) = self.queue.get(self.current_index + 1) {
            self.tts.prefetch(&next.id, &next.text, &self.options)?;
        }

        Ok(Some(current))
    }
}
