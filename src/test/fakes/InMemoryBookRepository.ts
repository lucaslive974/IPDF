import type { BookMetadata } from '../../core/domain/BookMetadata';
import type { IBookRepository } from '../../core/ports/IRepository';

export class InMemoryBookRepository implements IBookRepository {
  private readonly store = new Map<string, BookMetadata>();

  public async save(entity: BookMetadata): Promise<void> {
    this.store.set(entity.bookHash, { ...entity });
  }

  public async findById(id: string): Promise<BookMetadata | null> {
    const found = this.store.get(id);
    return found ? { ...found } : null;
  }

  public async update(entity: BookMetadata): Promise<void> {
    this.store.set(entity.bookHash, { ...entity });
  }

  public async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  public async findAll(): Promise<BookMetadata[]> {
    return Array.from(this.store.values()).map((b) => ({ ...b }));
  }
}
