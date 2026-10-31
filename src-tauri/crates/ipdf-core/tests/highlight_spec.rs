mod fakes;

use fakes::TestVisitor;
use ipdf_core::core::domain::{
    BookFormat, BoundingBox, Highlight, HighlightAnchor, RichAnnotation, RichAnnotationType,
};

#[test]
fn test_highlight_overlap_and_visitor_double_dispatch() {
    let mut hl = Highlight::new(
        "hl-1",
        "book-1",
        "Allegory",
        "#eab308",
        HighlightAnchor {
            format: BookFormat::Pdf,
            page_number: 10,
            epub_cfi: None,
            pdf_rects: Some(vec![BoundingBox {
                x: 100.0,
                y: 200.0,
                width: 150.0,
                height: 20.0,
            }]),
        },
        "Initial note",
        1000,
    );

    assert!(hl.overlaps_with(&HighlightAnchor {
        format: BookFormat::Pdf,
        page_number: 10,
        epub_cfi: None,
        pdf_rects: Some(vec![BoundingBox {
            x: 120.0,
            y: 205.0,
            width: 40.0,
            height: 10.0,
        }]),
    }));

    RichAnnotation::AssistedMarkdown {
        raw_data: "**Plato**".to_string(),
        updated_at_ms: 2000,
    }
    .attach_to(&mut hl);

    RichAnnotation::Tldraw {
        raw_data: "{}".to_string(),
        svg_preview: Some("<svg>board</svg>".to_string()),
        updated_at_ms: 2500,
    }
    .attach_to(&mut hl);

    assert_eq!(hl.note, "**Plato**");
    assert_eq!(hl.updated_at_ms, 2500);

    let visited = hl.accept_visitor(&TestVisitor);
    assert_eq!(visited, vec!["MD:**Plato**", "TLDRAW:<svg>board</svg>"]);

    hl.remove_rich_annotation(RichAnnotationType::Tldraw, 3000);
    assert_eq!(hl.updated_at_ms, 3000);
}
