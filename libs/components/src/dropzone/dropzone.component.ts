import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonComponent } from "../button/button.component";

let nextId = 0;

@Component({
  selector: "bit-dropzone",
  templateUrl: "./dropzone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, I18nPipe],
  host: {
    class: "tw-block",
  },
})
export class DropzoneComponent {
  /** Accepted file types (e.g. ".png,.jpg,.svg") */
  readonly accept = input("");

  /** Maximum file size in MB */
  readonly maxFileSize = input.required<number>();

  /** Allow multiple file selection */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Emits when files are selected or dropped */
  readonly filesSelected = output<File[]>();

  protected readonly inputId = `bit-dropzone-input-${nextId++}`;
  protected readonly isDragOver = signal(false);
  protected readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>("fileInput");

  /**
   * Track drag enter/leave depth to prevent flicker when dragging over child elements.
   * Each child element triggers its own dragenter/dragleave pair on the parent.
   */
  private readonly dragDepth = signal(0);

  protected onDragEnter(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth.update((d) => d + 1);
    this.isDragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth.update((d) => d - 1);
    if (this.dragDepth() <= 0) {
      this.dragDepth.set(0);
      this.isDragOver.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth.set(0);
    this.isDragOver.set(false);

    if (!event.dataTransfer?.files.length) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    this.emitFiles(files);
  }

  protected openFileBrowser(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileInput().nativeElement.click();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const files = Array.from(input.files);
    this.emitFiles(files);

    // Clear value so re-selecting the same file still triggers a change event
    input.value = "";
  }

  private emitFiles(files: File[]): void {
    if (!this.multiple() && files.length > 0) {
      this.filesSelected.emit([files[0]]);
    } else {
      this.filesSelected.emit(files);
    }
  }
}
