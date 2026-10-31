use crate::core::ports::{LlmRequest, ReadingContext};

pub struct PromptBuilder;

impl PromptBuilder {
    pub fn build_term_lookup_request(ctx: &ReadingContext, target_lang: &str) -> LlmRequest {
        LlmRequest {
            system_instruction:
                "You are a philosophical and literary lexicon assistant. Provide accurate contextual definitions."
                    .to_string(),
            user_prompt: Self::format_context_block(
                ctx,
                &format!(
                    "Define the selected term \"{}\" in {target_lang} within this specific work's context.",
                    ctx.selected_text
                ),
            ),
            temperature: 0.2,
        }
    }

    pub fn build_translation_request(ctx: &ReadingContext, target_lang: &str) -> LlmRequest {
        LlmRequest {
            system_instruction:
                "You are a literary and philosophical translator. Preserve nuance and terminology."
                    .to_string(),
            user_prompt: Self::format_context_block(
                ctx,
                &format!(
                    "Translate the selected passage into {target_lang}, preserving philosophical precision."
                ),
            ),
            temperature: 0.2,
        }
    }

    fn format_context_block(ctx: &ReadingContext, directive: &str) -> String {
        let mut lines = vec![
            format!("Book Title: {}", ctx.book_title),
            format!("Author: {}", ctx.book_author),
        ];
        if let Some(ref chapter) = ctx.chapter_title {
            lines.push(format!("Chapter: {chapter}"));
        }
        lines.push(format!(
            "Surrounding Paragraph: \"{}\"",
            ctx.surrounding_context
        ));
        lines.push(format!("Selected Text: \"{}\"", ctx.selected_text));
        lines.push(format!("Task: {directive}"));
        lines.join("\n")
    }
}
