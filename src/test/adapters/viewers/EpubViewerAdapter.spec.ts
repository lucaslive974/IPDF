import { describe, expect, it } from 'vitest';
import { EpubViewerAdapter } from '../../../adapters/viewers/EpubViewerAdapter';
import { Highlight } from '../../../core/domain/Highlight';
import type { PageInfo, TextSelection } from '../../../core/domain/types';

function createFakeContainer(): HTMLElement {
  const attributes = new Map<string, string>();
  const fakeElement = {
    innerHTML: '',
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string): string | null {
      return attributes.get(name) ?? null;
    },
  };
  return fakeElement as unknown as HTMLElement;
}

function encodeUtf8(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

describe('EpubViewerAdapter (EPUB CFI, Highlights, Inline Ruby & Cover Extraction)', () => {
  it('extracts PNG, JPEG, and WEBP cover images into Uint8Array without Node Buffer', async () => {
    const pngPayload = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03,
      0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const pngCover = await EpubViewerAdapter.extractCoverToUint8Array(pngPayload.buffer);
    expect(pngCover).not.toBeNull();
    expect(pngCover?.coverMimeType).toBe('image/png');
    expect(pngCover?.coverImageBuffer).toBeInstanceOf(Uint8Array);
    expect(pngCover?.coverImageBuffer[0]).toBe(0x89);

    const jpegPayload = new Uint8Array([0x00, 0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0xff, 0xd9]);
    const jpegCover = await EpubViewerAdapter.extractCoverToUint8Array(jpegPayload.buffer);
    expect(jpegCover?.coverMimeType).toBe('image/jpeg');
    expect(jpegCover?.coverImageBuffer).toBeInstanceOf(Uint8Array);

    const webpPayload = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0xaa, 0xbb,
    ]);
    const webpCover = await EpubViewerAdapter.extractCoverToUint8Array(webpPayload.buffer);
    expect(webpCover?.coverMimeType).toBe('image/webp');

    const emptyCover = await EpubViewerAdapter.extractCoverToUint8Array(encodeUtf8('Plain text'));
    expect(emptyCover).toBeNull();
  });

  it('renders EPUB chapters, navigates by page number and CFI, and emits onPageChanged', async () => {
    const viewer = new EpubViewerAdapter();
    const container = createFakeContainer();
    const pageEvents: PageInfo[] = [];
    viewer.onPageChanged((info) => pageEvents.push(info));

    const epubContent = JSON.stringify({
      chapters: [
        {
          title: 'Book I — Justice',
          cfiBase: 'epubcfi(/6/2!/4/2',
          content: 'I went down yesterday to the Piraeus with Glaucon the son of Ariston.',
        },
        {
          title: 'Book VII — The Cave',
          cfiBase: 'epubcfi(/6/14!/4/2',
          content: 'Behold! human beings living in an underground den. They see only shadows.',
        },
      ],
    });

    await viewer.render(container, encodeUtf8(epubContent));
    expect(viewer.getCurrentPage()).toEqual({
      currentPage: 1,
      totalPages: 2,
      chapterTitle: 'Book I — Justice',
      percentage: 50,
    });
    expect(container.innerHTML).toContain('Piraeus with Glaucon');

    await viewer.nextPage();
    expect(viewer.getCurrentPage().currentPage).toBe(2);
    expect(viewer.getCurrentPage().chapterTitle).toBe('Book VII — The Cave');
    expect(viewer.getCurrentPage().percentage).toBe(100);

    await viewer.prevPage();
    expect(viewer.getCurrentPage().currentPage).toBe(1);

    await viewer.goToPage('epubcfi(/6/14!/4/2/1:0)');
    expect(viewer.getCurrentPage().currentPage).toBe(2);

    await viewer.goToPage(1);
    expect(viewer.getCurrentPage().currentPage).toBe(1);
    expect(pageEvents.length).toBeGreaterThanOrEqual(4);
  });

  it('renders highlights, erases highlights, injects ruby annotations, and handles TTS sentences', async () => {
    const viewer = new EpubViewerAdapter();
    const container = createFakeContainer();
    const clickedIds: string[] = [];
    viewer.onHighlightClicked((hl) => clickedIds.push(hl.id));

    await viewer.render(
      container,
      encodeUtf8('First philosophical sentence. Second dialectical proposition!')
    );

    const hl = new Highlight(
      'hl-1',
      'book-hash-1',
      'First philosophical sentence.',
      '#eab308',
      { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2/1:0)' },
      'Opening thesis'
    );

    viewer.renderHighlights([hl]);
    expect(container.innerHTML).toContain('data-highlight-id="hl-1"');
    expect(container.innerHTML).toContain('data-epub-cfi="epubcfi(/6/2!/4/2/1:0)"');

    viewer.triggerHighlightClick('hl-1');
    expect(clickedIds).toEqual(['hl-1']);

    viewer.injectInlineAnnotation(
      { format: 'epub', pageNumber: 1, epubCfi: 'epubcfi(/6/2!/4/2/1:6)' },
      'philosophical',
      'love of wisdom (philosophia)'
    );
    expect(container.innerHTML).toContain('<ruby');
    expect(container.innerHTML).toContain('love of wisdom (philosophia)');

    const sentences = await viewer.extractVisibleSentences();
    expect(sentences.length).toBe(2);
    expect(sentences[0]?.text).toBe('First philosophical sentence.');
    expect(sentences[0]?.anchor.epubCfi).toContain('epubcfi(');

    viewer.setActiveTTSSentence(sentences[0]?.id ?? null);
    expect(container.innerHTML).toContain(`data-tts-active="${sentences[0]?.id}"`);

    viewer.setActiveTTSSentence(null);
    expect(container.innerHTML).not.toContain('data-tts-active="');

    viewer.eraseHighlightFromDOM('hl-1');
    expect(container.innerHTML).not.toContain('data-highlight-id="hl-1"');

    const selections: Array<TextSelection | null> = [];
    viewer.onTextSelected((sel) => selections.push(sel));
    viewer.simulateTextSelection('dialectical proposition', 'epubcfi(/6/2!/4/2/1:30)');
    expect(viewer.getSelection()?.text).toBe('dialectical proposition');
    expect(selections[0]?.anchor.epubCfi).toBe('epubcfi(/6/2!/4/2/1:30)');

    viewer.clearSelection();
    expect(viewer.getSelection()).toBeNull();

    viewer.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('parses EPUB binary archive and extracts paragraphs and chapters', async () => {
    const viewer = new EpubViewerAdapter();
    const container = createFakeContainer();

    const filename = 'chapter1.xhtml';
    const content =
      '<html><head><title>Allegory</title></head><body><h1>The Cave</h1><p>Behold prisoners chained in the dark.</p><p>They see shadows cast upon the wall.</p></body></html>';
    const nameBytes = new TextEncoder().encode(filename);
    const contentBytes = new TextEncoder().encode(content);

    const totalLen = 30 + nameBytes.length + contentBytes.length;
    const zipBytes = new Uint8Array(totalLen);
    const view = new DataView(zipBytes.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true); // method 0 (stored)
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, contentBytes.length, true);
    view.setUint32(22, contentBytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);

    zipBytes.set(nameBytes, 30);
    zipBytes.set(contentBytes, 30 + nameBytes.length);

    await viewer.render(container, zipBytes.buffer);

    const chapters = viewer.getChapters();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe('Allegory');

    const paragraphs = viewer.getParagraphsForChapter(0);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('Behold prisoners chained in the dark.');
  });
});
