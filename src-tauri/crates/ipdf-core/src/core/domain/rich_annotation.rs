use crate::core::domain::highlight::Highlight;
use crate::core::domain::types::RichAnnotationType;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum RichAnnotation {
    AssistedMarkdown {
        raw_data: String,
        updated_at_ms: i64,
    },
}

impl RichAnnotation {
    pub fn annotation_type(&self) -> RichAnnotationType {
        match self {
            RichAnnotation::AssistedMarkdown { .. } => RichAnnotationType::AssistedMarkdown,
        }
    }

    pub fn updated_at_ms(&self) -> i64 {
        match self {
            RichAnnotation::AssistedMarkdown { updated_at_ms, .. } => *updated_at_ms,
        }
    }

    pub fn attach_to(self, highlight: &mut Highlight) {
        let now = self.updated_at_ms();
        let RichAnnotation::AssistedMarkdown { ref raw_data, .. } = self;
        highlight.update_note(raw_data.clone(), now);
        highlight.set_rich_annotation(self, now);
    }
}
