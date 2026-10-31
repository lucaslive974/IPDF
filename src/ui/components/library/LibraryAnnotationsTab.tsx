import { memo } from 'react';
import { Card } from '../ui';

export const LibraryAnnotationsTab = memo(function LibraryAnnotationsTab() {
  return (
    <div className="flex flex-col gap-3">
      <Card variant="dashed" padding="lg" className="text-center text-xs text-tx-muted py-8">
        Bookmarks and passage annotations are indexed within active study reading sessions.
      </Card>
    </div>
  );
});
