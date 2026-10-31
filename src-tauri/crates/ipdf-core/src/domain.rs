use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BookFormat {
    Epub,
    Pdf,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl BoundingBox {
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        self.x < other.x + other.width
            && self.x + self.width > other.x
            && self.y < other.y + other.height
            && self.y + self.height > other.y
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HighlightAnchor {
    pub format: BookFormat,
    pub page_number: u32,
    pub epub_cfi: Option<String>,
    pub pdf_rects: Option<Vec<BoundingBox>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookMetadata {
    pub book_hash: String,
    pub title: String,
    pub author: String,
    pub format: BookFormat,
    pub current_page: u32,
    pub total_pages: u32,
    pub percentage: f64,
    pub cover_image_url: Option<String>,
    pub last_read_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RichAnnotationType {
    AssistedMarkdown,
    Tldraw,
    Drawio,
}

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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Highlight {
    pub id: String,
    pub book_hash: String,
    pub text: String,
    pub color: String,
    pub anchor: HighlightAnchor,
    pub note: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub annotations: BTreeMap<RichAnnotationType, RichAnnotation>,
}

impl Highlight {
    pub fn new(
        id: impl Into<String>,
        book_hash: impl Into<String>,
        text: impl Into<String>,
        color: impl Into<String>,
        anchor: HighlightAnchor,
        note: impl Into<String>,
        timestamp_ms: i64,
    ) -> Self {
        Self {
            id: id.into(),
            book_hash: book_hash.into(),
            text: text.into(),
            color: color.into(),
            anchor,
            note: note.into().trim().to_string(),
            created_at_ms: timestamp_ms,
            updated_at_ms: timestamp_ms,
            annotations: BTreeMap::new(),
        }
    }

    pub fn update_note(&mut self, new_note: impl Into<String>, timestamp_ms: i64) {
        self.note = new_note.into().trim().to_string();
        self.updated_at_ms = timestamp_ms;
    }

    pub fn change_color(&mut self, new_color: impl Into<String>, timestamp_ms: i64) {
        self.color = new_color.into();
        self.updated_at_ms = timestamp_ms;
    }

    pub fn set_rich_annotation(&mut self, annotation: RichAnnotation, timestamp_ms: i64) {
        self.annotations
            .insert(annotation.annotation_type(), annotation);
        self.updated_at_ms = timestamp_ms;
    }

    pub fn remove_rich_annotation(
        &mut self,
        kind: RichAnnotationType,
        timestamp_ms: i64,
    ) -> Option<RichAnnotation> {
        let removed = self.annotations.remove(&kind);
        if removed.is_some() {
            self.updated_at_ms = timestamp_ms;
        }
        removed
    }

    pub fn accept_visitor<R>(&self, visitor: &dyn AnnotationVisitor<R>) -> Vec<R> {
        self.annotations
            .values()
            .map(|ann| ann.accept(visitor))
            .collect()
    }

    pub fn overlaps_with(&self, other: &HighlightAnchor) -> bool {
        if self.anchor.format != other.format || self.anchor.page_number != other.page_number {
            return false;
        }

        match self.anchor.format {
            BookFormat::Epub => match (&self.anchor.epub_cfi, &other.epub_cfi) {
                (Some(a), Some(b)) => !a.is_empty() && a == b,
                _ => false,
            },
            BookFormat::Pdf => match (&self.anchor.pdf_rects, &other.pdf_rects) {
                (Some(r1_list), Some(r2_list)) => r1_list
                    .iter()
                    .any(|r1| r2_list.iter().any(|r2| r1.intersects(r2))),
                _ => false,
            },
        }
    }
}
