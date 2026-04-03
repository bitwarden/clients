import { Directive, ElementRef, NgZone, OnDestroy, OnInit, output } from "@angular/core";

import { DragDropResult, readDragDropEntries } from "../utils/drag-drop-entries";

/**
 * Attribute directive that turns any host element into a file drop target.
 *
 * Usage:
 * ```html
 * <div toolsDragDropZone (filesDropped)="onDrop($event)" (dragActive)="isDragging = $event">
 * ```
 */
@Directive({
  selector: "[toolsDragDropZone]",
  standalone: true,
})
export class DragDropZoneDirective implements OnInit, OnDestroy {
  readonly filesDropped = output<DragDropResult>();
  readonly dragActive = output<boolean>();

  /**
   * Counter tracks nested dragenter/dragleave pairs from child elements
   * to avoid flicker when dragging over children.
   */
  private enterCount = 0;

  private boundDragEnter = this.onDragEnter.bind(this);
  private boundDragOver = this.onDragOver.bind(this);
  private boundDragLeave = this.onDragLeave.bind(this);
  private boundDrop = this.onDrop.bind(this);

  constructor(
    private el: ElementRef<HTMLElement>,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    // Register outside Angular zone for performance — only re-enter for state changes
    this.ngZone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      el.addEventListener("dragenter", this.boundDragEnter);
      el.addEventListener("dragover", this.boundDragOver);
      el.addEventListener("dragleave", this.boundDragLeave);
      el.addEventListener("drop", this.boundDrop);
    });
  }

  ngOnDestroy(): void {
    const el = this.el.nativeElement;
    el.removeEventListener("dragenter", this.boundDragEnter);
    el.removeEventListener("dragover", this.boundDragOver);
    el.removeEventListener("dragleave", this.boundDragLeave);
    el.removeEventListener("drop", this.boundDrop);
  }

  private onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event)) {
      return;
    }
    event.preventDefault();
    this.enterCount++;
    if (this.enterCount === 1) {
      this.ngZone.run(() => this.dragActive.emit(true));
    }
  }

  private onDragOver(event: DragEvent): void {
    if (!this.hasFiles(event)) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  }

  private onDragLeave(event: DragEvent): void {
    if (!this.hasFiles(event)) {
      return;
    }
    this.enterCount--;
    if (this.enterCount <= 0) {
      this.enterCount = 0;
      this.ngZone.run(() => this.dragActive.emit(false));
    }
  }

  private onDrop(event: DragEvent): void {
    event.preventDefault();
    this.enterCount = 0;
    this.ngZone.run(() => this.dragActive.emit(false));

    if (!event.dataTransfer || event.dataTransfer.items.length === 0) {
      return;
    }

    // Only process file drops
    const hasFileItems = Array.from(event.dataTransfer.items).some((item) => item.kind === "file");
    if (!hasFileItems) {
      return;
    }

    readDragDropEntries(event.dataTransfer)
      .then((result) => {
        if (result.files.length > 0) {
          this.ngZone.run(() => this.filesDropped.emit(result));
        }
      })
      .catch(() => {
        // Silently ignore — file reading can fail if DataTransfer is cleared
      });
  }

  /** Check whether the drag event contains files (as opposed to text/URLs). */
  private hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types?.includes("Files") ?? false;
  }
}
