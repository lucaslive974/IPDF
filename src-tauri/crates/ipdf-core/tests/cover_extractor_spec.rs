use ipdf_core::core::domain::BookFormat;
use ipdf_core::core::ports::BookCoverExtractor;
use ipdf_core::core::services::extractor::{
    BookCoverExtractorFactory, EpubCoverExtractor, PdfCoverExtractor,
};
use std::io::Write;

#[test]
fn test_epub_cover_extractor_from_fallback_filename() {
    let extractor = EpubCoverExtractor::new();

    // 1. Invalid input
    assert!(extractor.extract_cover(b"").is_none());
    assert!(extractor.extract_cover(b"not-a-zip-payload").is_none());

    // 2. Minimal ZIP with no cover
    let mut no_cover_zip = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut no_cover_zip);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        zip.start_file("chapter1.xhtml", options).unwrap();
        zip.write_all(b"<p>No cover here</p>").unwrap();
        zip.finish().unwrap();
    }
    assert!(extractor.extract_cover(&no_cover_zip).is_none());

    // 3. Minimal ZIP with fallback filename containing "cover" (.jpg)
    let mut with_cover_zip = Vec::new();
    let fake_jpeg = vec![
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9,
    ];
    {
        let cursor = std::io::Cursor::new(&mut with_cover_zip);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        zip.start_file("OEBPS/Images/cover.jpg", options).unwrap();
        zip.write_all(&fake_jpeg).unwrap();
        zip.finish().unwrap();
    }

    let extracted = extractor.extract_cover(&with_cover_zip).unwrap();
    assert_eq!(extracted.mime_type, "image/jpeg");
    assert_eq!(extracted.extension, "jpg");
    assert_eq!(extracted.data, fake_jpeg);

    // 4. Minimal ZIP with fallback filename containing "titlepage" (.png)
    let mut titlepage_zip = Vec::new();
    let fake_png = b"\x89PNG\r\n\x1a\nfake-png-data".to_vec();
    {
        let cursor = std::io::Cursor::new(&mut titlepage_zip);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);
        zip.start_file("titlepage.png", options).unwrap();
        zip.write_all(&fake_png).unwrap();
        zip.finish().unwrap();
    }

    let extracted_png = extractor.extract_cover(&titlepage_zip).unwrap();
    assert_eq!(extracted_png.mime_type, "image/png");
    assert_eq!(extracted_png.extension, "png");
    assert_eq!(extracted_png.data, fake_png);
}

#[test]
fn test_epub_cover_extractor_from_opf_manifest() {
    let extractor = EpubCoverExtractor::new();

    let mut opf_zip = Vec::new();
    let fake_webp = b"RIFF....WEBPVP8 ...fake-webp-payload".to_vec();
    {
        let cursor = std::io::Cursor::new(&mut opf_zip);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);

        // Add content.opf specifying cover-image
        zip.start_file("OEBPS/content.opf", options).unwrap();
        let opf_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="my-cover-id" href="assets/front.webp" properties="cover-image" media-type="image/webp"/>
    <item id="text1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>"#;
        zip.write_all(opf_xml.as_bytes()).unwrap();

        // Add the image entry referenced by href
        zip.start_file("OEBPS/assets/front.webp", options).unwrap();
        zip.write_all(&fake_webp).unwrap();

        zip.finish().unwrap();
    }

    let extracted = extractor.extract_cover(&opf_zip).unwrap();
    assert_eq!(extracted.mime_type, "image/webp");
    assert_eq!(extracted.extension, "webp");
    assert_eq!(extracted.data, fake_webp);

    // Test OPF with id='cover' and single quotes
    let mut opf_single_quote_zip = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut opf_single_quote_zip);
        let mut zip = zip::ZipWriter::new(cursor);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Stored);

        zip.start_file("content.opf", options).unwrap();
        let opf_xml = "<package><manifest><item id='cover' href='cover_alt.jpg' media-type='image/jpeg'/></manifest></package>";
        zip.write_all(opf_xml.as_bytes()).unwrap();

        zip.start_file("cover_alt.jpg", options).unwrap();
        zip.write_all(b"fake-alt-jpg").unwrap();

        zip.finish().unwrap();
    }

    let extracted_alt = extractor.extract_cover(&opf_single_quote_zip).unwrap();
    assert_eq!(extracted_alt.extension, "jpg");
    assert_eq!(extracted_alt.data, b"fake-alt-jpg");
}

#[test]
fn test_pdf_cover_extractor_and_factory() {
    let pdf_extractor = PdfCoverExtractor::new();

    // 1. Non-PDF returns None
    assert!(pdf_extractor.extract_cover(b"not-a-pdf").is_none());

    // 2. PDF without JPEG stream returns None
    let empty_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
    assert!(pdf_extractor.extract_cover(empty_pdf).is_none());

    // 3. PDF with embedded JPEG SOI and EOI
    let mut pdf_with_jpeg =
        b"%PDF-1.7\n1 0 obj\n<< /Type /XObject /Subtype /Image /Filter /DCTDecode >>\nstream\n"
            .to_vec();
    let mut fake_jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0];
    fake_jpeg.extend(vec![0xAA; 120]); // dummy jpeg body > 100 bytes
    fake_jpeg.extend_from_slice(&[0xFF, 0xD9]);
    pdf_with_jpeg.extend_from_slice(&fake_jpeg);
    pdf_with_jpeg.extend_from_slice(b"\nendstream\nendobj\n%%EOF");

    let extracted = pdf_extractor.extract_cover(&pdf_with_jpeg).unwrap();
    assert_eq!(extracted.mime_type, "image/jpeg");
    assert_eq!(extracted.extension, "jpg");
    assert_eq!(extracted.data, fake_jpeg);

    // 4. Factory creation
    let from_factory_epub = BookCoverExtractorFactory::create(BookFormat::Epub);
    assert!(from_factory_epub.extract_cover(b"").is_none());

    let from_factory_pdf = BookCoverExtractorFactory::create(BookFormat::Pdf);
    assert!(from_factory_pdf.extract_cover(b"").is_none());
}
