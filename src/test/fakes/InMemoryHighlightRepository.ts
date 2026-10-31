import type { Highlight } from '../../core/domain/Highlight';
import type { IHighlightRepository } from '../../core/ports/IRepository';

export class InMemoryHighlightRepository implements IHighlightRepository {
  private readonly store = new Map<string, Highlight>();

  public async save(entity: Highlight): Promise<void> {
    this.store.set(entity.id, entity);
  }

  public async findById(id: string): Promise<Highlight | null> {
    return this.store.get(id) ?? null;
  }

  public async update(entity: Highlight): Promise<void> {
    this.store.set(entity.id, entity);
  }

  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  public async findByBook(bookHash: string): Promise<Highlight[]> {
    return Array.from(this.store.values()).filter((h) => h.bookHash === bookHash);
  }

  public async findByBookAndPage(bookHash: string, pageNumber: number): Promise<Highlight[]> {
    return Array.from(this.store.values()).filter(
      (h) => h.bookHash === bookHash && h.anchor.pageNumber === pageNumber
    );
  }

  public async searchByTextOrNote(bookHash: string, query: string): Promise<Highlight[]> {
    const normalized = query.toLowerCase();
    return Array.from(this.store.values()).filter(
      (h) =>
        h.bookHash === bookHash &&
        (h.text.toLowerCase().includes(normalized) || h.note.toLowerCase().includes(normalized))
    );
  }
}
