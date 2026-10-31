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
    Tldraw {
        raw_data: String,
        svg_preview: Option<String>,
        updated_at_ms: i64,
    },
    Drawio {
        raw_data: String,
        svg_preview: Option<String>,
        updated_at_ms: i64,
    },
}

pub trait AnnotationVisitor<R> {
    fn visit_assisted_text(&self, raw_data: &str, updated_at_ms: i64) -> R;
    fn visit_tldraw_board(
        &self,
        raw_data: &str,
        svg_preview: Option<&str>,
        updated_at_ms: i64,
    ) -> R;
    fn visit_drawio_diagram(
        &self,
        raw_data: &str,
        svg_preview: Option<&str>,
        updated_at_ms: i64,
    ) -> R;
}

impl RichAnnotation {
    pub fn annotation_type(&self) -> RichAnnotationType {
        match self {
            RichAnnotation::AssistedMarkdown { .. } => RichAnnotationType::AssistedMarkdown,
            RichAnnotation::Tldraw { .. } => RichAnnotationType::Tldraw,
            RichAnnotation::Drawio { .. } => RichAnnotationType::Drawio,
        }
    }

    pub fn updated_at_ms(&self) -> i64 {
        match self {
            RichAnnotation::AssistedMarkdown { updated_at_ms, .. }
            | RichAnnotation::Tldraw { updated_at_ms, .. }
            | RichAnnotation::Drawio { updated_at_ms, .. } => *updated_at_ms,
        }
    }

    pub fn accept<R>(&self, visitor: &dyn AnnotationVisitor<R>) -> R {
        match self {
            RichAnnotation::AssistedMarkdown {
                raw_data,
                updated_at_ms,
            } => visitor.visit_assisted_text(raw_data, *updated_at_ms),
            RichAnnotation::Tldraw {
                raw_data,
                svg_preview,
                updated_at_ms,
            } => visitor.visit_tldraw_board(raw_data, svg_preview.as_deref(), *updated_at_ms),
            RichAnnotation::Drawio {
                raw_data,
                svg_preview,
                updated_at_ms,
            } => visitor.visit_drawio_diagram(raw_data, svg_preview.as_deref(), *updated_at_ms),
        }
    }

    pub fn attach_to(self, highlight: &mut Highlight) {
        let now = self.updated_at_ms();
        if let RichAnnotation::AssistedMarkdown { ref raw_data, .. } = self {
            highlight.update_note(raw_data.clone(), now);
        }
        highlight.set_rich_annotation(self, now);
    }
}
