use ipdf_core::core::domain::{
    BookFormat, BoundingBox, Highlight, HighlightAnchor, RichAnnotation, RichAnnotationType,
};

#[test]
fn test_highlight_overlap_and_pattern_matching() {
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

    hl.change_color("#22c55e", 1500);
    assert_eq!(hl.color, "#22c55e");

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

    assert!(!hl.overlaps_with(&HighlightAnchor {
        format: BookFormat::Pdf,
        page_number: 11,
        epub_cfi: None,
        pdf_rects: None,
    }));

    let epub_hl = Highlight::new(
        "hl-epub",
        "book-1",
        "CFI",
        "#eab308",
        HighlightAnchor {
            format: BookFormat::Epub,
            page_number: 1,
            epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
            pdf_rects: None,
        },
        "",
        1000,
    );
    assert!(epub_hl.overlaps_with(&HighlightAnchor {
        format: BookFormat::Epub,
        page_number: 1,
        epub_cfi: Some("epubcfi(/6/2!/4/2)".to_string()),
        pdf_rects: None,
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

    RichAnnotation::Drawio {
        raw_data: "<mxGraphModel/>".to_string(),
        svg_preview: Some("<svg>diagram</svg>".to_string()),
        updated_at_ms: 2700,
    }
    .attach_to(&mut hl);

    assert_eq!(hl.note, "**Plato**");
    assert_eq!(hl.updated_at_ms, 2700);

    // Native pattern matching in Rust
    let formatted: Vec<String> = hl
        .annotations
        .values()
        .map(|ann| match ann {
            RichAnnotation::AssistedMarkdown { raw_data, .. } => format!("MD:{raw_data}"),
            RichAnnotation::Tldraw { svg_preview, .. } => {
                format!("TLDRAW:{}", svg_preview.as_deref().unwrap_or_default())
            }
            RichAnnotation::Drawio { svg_preview, .. } => {
                format!("DRAWIO:{}", svg_preview.as_deref().unwrap_or_default())
            }
        })
        .collect();

    assert_eq!(
        formatted,
        vec![
            "MD:**Plato**",
            "TLDRAW:<svg>board</svg>",
            "DRAWIO:<svg>diagram</svg>"
        ]
    );

    hl.remove_rich_annotation(RichAnnotationType::Tldraw, 3000);
    assert_eq!(hl.updated_at_ms, 3000);
}
