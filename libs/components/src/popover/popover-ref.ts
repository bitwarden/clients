import { Observable, Subject } from "rxjs";

/** A popover opened with `PopoverService`. */
export class PopoverRef {
  private readonly closedSubject = new Subject<void>();
  private isClosed = false;

  /** Emits once on close: the close button, Escape, a backdrop click, or `close()`. */
  readonly closed: Observable<void> = this.closedSubject.asObservable();

  constructor(private readonly dispose: () => void) {}

  close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.dispose();
    this.closedSubject.next();
    this.closedSubject.complete();
  }
}
