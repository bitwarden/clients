import { signal } from "@angular/core";

/**
 * Tracks which table rows have a mutation in flight and drops a repeat call for a row already busy.
 */
export class RowBusyTracker<TRowId> {
  private readonly busyIds = signal<ReadonlySet<TRowId>>(new Set<TRowId>());

  readonly isBusy = (rowId: TRowId): boolean => this.busyIds().has(rowId);

  async run(rowId: TRowId, action: () => Promise<void>): Promise<void> {
    if (this.isBusy(rowId)) {
      return;
    }
    this.busyIds.update((ids) => new Set(ids).add(rowId));
    try {
      await action();
    } finally {
      this.busyIds.update((ids) => {
        const next = new Set(ids);
        next.delete(rowId);
        return next;
      });
    }
  }
}
