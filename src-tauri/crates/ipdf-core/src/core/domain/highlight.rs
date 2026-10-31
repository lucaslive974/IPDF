use crate::core::domain::rich_annotation::{AnnotationVisitor, RichAnnotation};
use crate::core::domain::types::{BookFormat, HighlightAnchor, RichAnnotationType};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
