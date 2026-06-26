import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonComponent } from "../button/button.component";

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
  /**
   * Accepted file types. Uses comma separated list
   *
   * @example
   * Images only: "image/*"
   * PDF and Word docs: ".pdf,.doc,.docx"
   * Specific audio formats: "audio/mpeg,audio/wav"
   * Mixed types: "image/*,.pdf"
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept#unique_file_type_specifiers
   *
   * NOTE: This is only a browser html hint. Not a validation
   */
  readonly accept = input("");

  /**
   * Maximum file size in MB. When omitted, the size hint is hidden.
   *
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly maxFileSize = input<number>();

  /** Allow multiple file selection */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Error state — shows danger border */
  readonly hasError = input(false, { transform: booleanAttribute });

  /** Disabled state — prevents file selection and drag/drop */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** ID of the element that describes this input (error or hint) */
  readonly ariaDescribedBy = input<string | null>(null);

  /** Emits when files are selected or dropped */
  readonly filesSelected = output<File[]>();

  /** Emits when the dropzone's internal file input loses focus. Lets parents mark
   *  the bound FormControl as touched so Validators.required can surface errors. */
  readonly blurred = output<void>();

  /**
   * Id for the internal `<input type="file">`. Required so the parent's
   * `<label for="...">` associates with the dropzone's file input.
   */
  readonly inputId = input.required<string>();

  private readonly fileInputEl = viewChild<ElementRef<HTMLInputElement>>("fileInput");

  protected readonly isDragOver = signal(false);

  /** Focus the underlying native file input. */
  focus(): void {
    this.fileInputEl()?.nativeElement.focus();
  }

  /**
   * Track drag enter/leave depth to prevent flicker when dragging over child elements.
   * Each child element triggers its own dragenter/dragleave pair on the parent.
   */
  private readonly dragDepth = signal(0);

  protected readonly containerClasses = computed(() => {
    const base = [
      "tw-flex",
      "tw-flex-col",
      "tw-items-center",
      "tw-gap-4",
      "tw-py-10",
      "tw-border",
      "tw-border-dashed",
      "tw-rounded-xl",

      "tw-transition-colors",
      "tw-bg-bg-secondary",

      // File input is now nested inside the <label>, so use `focus-within`
      // (descendant focus selector) instead of the old `peer-focus-visible`
      // (sibling selector). `:focus-visible` is unreliable for sr-only file
      // inputs across browsers — `:focus-within` matches any descendant focus.
      "focus-within:tw-border-transparent",
      "focus-within:tw-ring",
      "focus-within:tw-ring-offset-0",
      "focus-within:tw-ring-border-focus",
    ];

    if (this.disabled()) {
      base.push("tw-text-fg-inactive", "tw-border-border-base", "!tw-cursor-not-allowed");
    } else if (this.hasError()) {
      base.push("tw-border-border-danger", "tw-cursor-pointer");
    } else if (this.isDragOver()) {
      base.push("tw-border-border-strong", "tw-cursor-pointer");
    } else {
      base.push("tw-border-border-strong", "tw-cursor-pointer", "hover:tw-bg-bg-quaternary");
    }

    return base.join(" ");
  });

  protected onDragEnter(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth.update((d) => d + 1);
    this.isDragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  protected onDragLeave(event: DragEvent): void {
    if (this.disabled()) {
      return;
    }
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

    if (this.disabled() || !event.dataTransfer?.files.length) {
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    this.emitFiles(files);
  }

  protected onFileInputChange(event: Event): void {
    if (this.disabled()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const files = Array.from(input.files);
    this.emitFiles(files);
  }

  /**
   * Reset the input value at click time (before the OS picker opens) so re-selecting
   * the same file still fires a `change` event. Clearing after `change` instead would
   * leave the input empty while focused, which causes screen readers to announce
   * "no file selected" — masking the file-count message wired via aria-describedby.
   */
  protected onFileInputClick(event: MouseEvent): void {
    if (this.disabled()) {
      return;
    }
    (event.target as HTMLInputElement).value = "";
  }

  private emitFiles(files: File[]): void {
    if (!this.multiple() && files.length > 0) {
      this.filesSelected.emit([files[0]]);
    } else {
      this.filesSelected.emit(files);
    }
  }
}
