import { afterRenderEffect, computed, ElementRef, inject, signal, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { auditTime, fromEvent, map } from "rxjs";

const ROW_HEIGHT_PX = 56;
const FOOTER_HEIGHT_PX = 84;
const MIN_PAGE_SIZE = 5;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const RESIZE_AUDIT_MS = 100;

export type AutoPageSize = {
  autoPageSize: Signal<number>;
  pageSizeOptions: Signal<number[]>;
};

/**
 * Sizes a table's pages to fit the window, so the paginator is only needed when the rows don't
 * all fit. Must be called in an injection context, from the component hosting the table.
 */
export function injectAutoPageSize(options: {
  rows: Signal<unknown>;
  loading: Signal<boolean>;
}): AutoPageSize {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);

  const viewportHeight = toSignal(
    fromEvent(window, "resize").pipe(
      auditTime(RESIZE_AUDIT_MS),
      map(() => window.innerHeight),
    ),
    { initialValue: window.innerHeight },
  );

  const rowsTop = signal<number | undefined>(undefined);
  const rowHeight = signal(ROW_HEIGHT_PX);

  const autoPageSize = computed(() => {
    const top = rowsTop();
    if (top === undefined) {
      return DEFAULT_PAGE_SIZE;
    }
    const available = viewportHeight() - Math.max(0, top) - FOOTER_HEIGHT_PX;
    return Math.max(MIN_PAGE_SIZE, Math.floor(available / rowHeight()));
  });

  const pageSizeOptions = computed(() =>
    [...new Set([autoPageSize(), ...PAGE_SIZE_OPTIONS])].sort((a, b) => a - b),
  );

  afterRenderEffect(() => {
    options.rows();
    options.loading();
    viewportHeight();

    const row = host.nativeElement.querySelector("bit-row");
    if (row == null) {
      return;
    }
    const { top, height } = row.getBoundingClientRect();
    rowsTop.set(top);
    if (height > 0) {
      rowHeight.set(height);
    }
  });

  return { autoPageSize, pageSizeOptions };
}
