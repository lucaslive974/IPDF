use scholarium_core::core::domain::{Highlight, HighlightAnchor, RichAnnotation, RichAnnotationType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcRichAnnotationDto {
    pub r#type: String,
    pub raw_data: String,
    pub svg_preview: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcHighlightDto {
    pub id: String,
    pub book_hash: String,
    pub text: String,
    pub color: String,
    pub anchor: HighlightAnchor,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
    pub annotations: Vec<IpcRichAnnotationDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcLlmRequestDto {
    pub system_prompt: String,
    pub user_prompt: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookProgressDto {
    pub book_hash: String,
    pub current_page: u32,
    pub total_pages: u32,
    #[serde(default)]
    pub page_offset_ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReadingPresenceDto {
    pub book_hash: String,
    pub book_title: String,
    pub book_author: String,
    #[serde(default)]
    pub chapter_title: Option<String>,
    pub current_page: u32,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcPlatformInfoDto {
    pub platform: String,
    pub config_dir: String,
    pub data_dir: String,
    pub cache_dir: String,
    pub database_path: String,
    pub supports_discord_presence: bool,
}

pub fn domain_to_ipc_highlight(h: Highlight) -> IpcHighlightDto {
    let mut annots = Vec::new();
    for (k, v) in &h.annotations {
        let (raw_data, svg_preview) = match v {
            RichAnnotation::AssistedMarkdown { raw_data, .. } => (raw_data.clone(), None),
        };
        annots.push(IpcRichAnnotationDto {
            r#type: match k {
                RichAnnotationType::AssistedMarkdown => "assisted-markdown".to_string(),
            },
            raw_data,
            svg_preview,
            updated_at: h.updated_at_ms.to_string(),
        });
    }
    IpcHighlightDto {
        id: h.id,
        book_hash: h.book_hash,
        text: h.text,
        color: h.color,
        anchor: h.anchor,
        note: h.note,
        created_at: h.created_at_ms.to_string(),
        updated_at: h.updated_at_ms.to_string(),
        annotations: annots,
    }
}

pub fn ipc_highlight_to_domain(highlight: &IpcHighlightDto, now_ms: i64) -> Highlight {
    let mut domain = Highlight::new(
        &highlight.id,
        &highlight.book_hash,
        &highlight.text,
        &highlight.color,
        highlight.anchor.clone(),
        &highlight.note,
        now_ms,
    );

    for a in &highlight.annotations {
        let rich = match a.r#type.as_str() {
            "assisted-markdown" => RichAnnotation::AssistedMarkdown {
                raw_data: a.raw_data.clone(),
                updated_at_ms: now_ms,
            },
            _ => continue,
        };
        domain.set_rich_annotation(rich, now_ms);
    }

    domain
}
