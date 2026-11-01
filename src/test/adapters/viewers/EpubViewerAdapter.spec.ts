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

describe('EpubViewerAdapter (EPUB CFI, Highlights & Virtual Pagination)', () => {
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

    const page1 = viewer.getPage(1);
    expect(page1).not.toBeNull();
    expect(page1?.pageNumber).toBe(1);

    const chunk = viewer.getPagesChunk(1, 2);
    expect(chunk).toHaveLength(2);

    viewer.setPages([
      {
        pageNumber: 1,
        chapterTitle: 'Custom Chapter',
        paragraphs: ['Custom content'],
        cfiBase: 'cfi-1',
      },
    ]);
    expect(viewer.getPage(1)?.chapterTitle).toBe('Custom Chapter');
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

  it('extracts paragraphs and chapters from structured document content', async () => {
    const viewer = new EpubViewerAdapter();
    const container = createFakeContainer();

    const epubContent = JSON.stringify({
      chapters: [
        {
          title: 'Allegory of the Cave',
          cfiBase: 'epubcfi(/6/10!/4/2',
          content:
            '<p>Behold prisoners chained in the dark.</p><p>They see shadows cast upon the wall.</p>',
        },
      ],
    });

    await viewer.render(container, encodeUtf8(epubContent));

    const chapters = viewer.getChapters();
    expect(chapters).toHaveLength(1);
    expect(chapters[0]?.title).toBe('Allegory of the Cave');

    const paragraphs = viewer.getParagraphsForChapter(0);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('Behold prisoners chained in the dark.');
  });

  it('handles navigation boundaries, paragraph chunking, and fallback empty pages', async () => {
    const viewer = new EpubViewerAdapter();
    const container = createFakeContainer();

    // 1. Empty render fallback
    await viewer.render(container, encodeUtf8(''));
    expect(viewer.getPage(999)).toBeNull();
    const emptyPages = viewer.getPagesChunk(1, 10);
    expect(emptyPages[0]?.paragraphs).toEqual(['Empty EPUB Document']);

    // Prev page at 1 does nothing
    await viewer.prevPage();
    expect(viewer.getCurrentPage().currentPage).toBe(1);

    // 2. Multi-chapter document
    const jsonEpub = JSON.stringify({
      chapters: [
        {
          title: 'Chapter 1',
          cfiBase: 'epubcfi(/6/10!/4/2',
          content: 'Paragraph 1\n\nParagraph 2',
        },
        {
          title: 'Chapter 2',
          cfiBase: 'epubcfi(/6/12!/4/2',
          content: 'Paragraph 3',
        },
      ],
    });

    await viewer.render(container, encodeUtf8(jsonEpub));
    const pages = viewer.getPagesChunk(1, 100);
    expect(pages.length).toBe(2);

    // Next page at boundary
    await viewer.nextPage();
    await viewer.nextPage(); // beyond max
    expect(viewer.getCurrentPage().currentPage).toBe(2);

    // Out-of-bounds goToPage
    await viewer.goToPage(100);
    await viewer.goToPage(-1);
    await viewer.goToPage('epubcfi(invalid-cfi-target)');
  });
});
