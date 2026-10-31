import { memo } from 'react';
import { BookIcon, Button, Card } from '../ui';

export const LibraryCollectionsTab = memo(function LibraryCollectionsTab() {
  return (
    <div className="flex flex-col gap-4">
      <Card
        variant="dashed"
        padding="lg"
        className="text-center flex flex-col items-center gap-3 py-10"
      >
        <BookIcon className="h-6 w-6 text-tx-faint" />
        <h3 className="text-sm font-semibold text-tx-main">Curated Collections</h3>
        <p className="max-w-md text-xs text-tx-muted">
          Curate custom active study tracks (e.g. &ldquo;Ancient Epistemology&rdquo;, &ldquo;Modern
          Political Philosophy&rdquo;).
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => alert('Reading list curation planned for Phase 6!')}
        >
          New Collection
        </Button>
      </Card>
    </div>
  );
});
