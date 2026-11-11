use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum BookFormat {
    #[default]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookPagePayload {
    pub page_number: u32,
    pub chapter_title: String,
    pub paragraphs: Vec<String>,
    pub cfi_base: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RichAnnotationType {
    AssistedMarkdown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlatformKind {
    Linux,
    Android,
    Windows,
    Ios,
}

impl PlatformKind {
    pub fn is_desktop(&self) -> bool {
        matches!(self, PlatformKind::Linux | PlatformKind::Windows)
    }

    pub fn supports_discord_presence(&self) -> bool {
        self.is_desktop()
    }
}
