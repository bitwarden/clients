import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NgControl } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonComponent } from "../button/button.component";
import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { BitCustomInputDirective } from "../form-field/custom-input.directive";
import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";

import { FileListComponent } from "./file-list.component";

/**
 * A drag-and-drop file upload rendered as a `bit-form-field`. The component is itself the form
 * control (`ControlValueAccessor`), so consumers bind it with `formControlName` /
 * `[formControl]` / `[(ngModel)]` and its value is always a `File[]` (`[]` = no files).
 *
 * @example
 * ```html
 * <bit-file-dropzone formControlName="files" multiple [maxFileSize]="5">
 *   <bit-label>Attachments</bit-label>
 *   <bit-hint>Max 5 MB each</bit-hint>
 * </bit-file-dropzone>
 * ```
 */
@Component({
  selector: "bit-file-dropzone",
  templateUrl: "./file-dropzone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    BitCustomInputDirective,
    BitFormFieldComponent,
    FileListComponent,
    I18nPipe,
  ],
  hostDirectives: [{ directive: BitFormFieldControlDirective, inputs: ["id"] }],
  host: {
    class: "tw-block",
    "[id]": "formFieldControl.id()",
  },
})
export class FileDropzoneComponent implements ControlValueAccessor {
  /**
   * Accepted file types. Uses a comma separated list.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept#unique_file_type_specifiers
   *
   * NOTE: This is only a browser html hint, not validation.
   */
  readonly accept = input("");

  /**
   * Maximum file size in MB. When omitted, the size hint is hidden.
   *
   * NOTE: This is only a user hint, not validation.
   */
  readonly maxFileSize = input<number>();

  /** Allow multiple file selection. */
  readonly multiple = input(false, { transform: booleanAttribute });

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  /** The hosted control directive `bit-form-field` reads its label / required / error state from. */
  protected readonly formFieldControl = inject(BitFormFieldControlDirective);
  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");
  private readonly fileList = viewChild(FileListComponent);
  private readonly hint = contentChild(BitHintDirective, { descendants: true });
  // Enforce an accessible label; consumers must project a <bit-label>.
  private readonly label = contentChild.required(BitLabelComponent);

  private readonly _files = signal<File[]>([]);
  readonly files = this._files.asReadonly();

  private readonly _disabledFromCva = signal(false);
  private readonly pendingFocusIndex = signal<number | null>(null);
  protected readonly isDragOver = signal(false);
  // Track drag enter/leave depth so dragging over child elements doesn't flicker the state.
  private readonly dragDepth = signal(0);

  private readonly onChange = signal<(value: File[]) => void>(() => {});
  private readonly onTouched = signal<() => void>(() => {});

  // The consumer's `id` (or the directive's auto-generated fallback) lands on the host element; the
  // native input and other internals derive distinct ids from it so nothing collides.
  protected readonly inputId = computed(() => `${this.formFieldControl.id()}-input`);
  protected readonly statusId = computed(() => `${this.inputId()}-status`);
  protected readonly maxFileSizeId = computed(() => `${this.inputId()}-size`);
  protected readonly instructionsId = computed(() => `${this.inputId()}-instructions`);

  protected readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());

  /**
   * Announced on focus arrival so screen readers read the current upload count. Empty when no
   * files are attached so the label/hint reads unchanged.
   */
  protected readonly filesUploadedStatus = computed(() => {
    const count = this.files().length;
    if (count === 0) {
      return "";
    }
    if (count === 1) {
      return this.i18nService.t("oneFileUploaded");
    }
    return this.i18nService.t("filesUploaded", String(count));
  });

  /**
   * The visible drop instruction (the input's accessible name is the projected `<bit-label>`, so
   * the instruction is exposed as a description instead), the projected hint id (queried here
   * because `bit-form-field` can't see a hint we re-project through our own `<ng-content>`), the
   * max-file-size text, form-field's error target, and the live status region.
   */
  protected readonly describedBy = computed(() => {
    const ids = [
      this.instructionsId(),
      this.hint()?.id,
      this.maxFileSize() != null ? this.maxFileSizeId() : null,
      this.formFieldControl.ariaDescribedBy(),
      this.files().length > 0 ? this.statusId() : null,
    ].filter(Boolean);
    return [...new Set(ids)].join(" ") || null;
  });

  protected readonly dropzoneClasses = computed(() => {
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
      "focus-within:tw-border-transparent",
      "focus-within:tw-ring",
      "focus-within:tw-ring-offset-0",
      "focus-within:tw-ring-border-focus",
    ];

    if (this.disabled()) {
      base.push("tw-text-fg-inactive", "tw-border-border-base", "!tw-cursor-not-allowed");
    } else if (this.formFieldControl.hasError()) {
      base.push("tw-border-border-danger", "tw-cursor-pointer");
    } else if (this.isDragOver()) {
      base.push("tw-border-border-strong", "tw-cursor-pointer");
    } else {
      base.push("tw-border-border-strong", "tw-cursor-pointer", "hover:tw-bg-bg-quaternary");
    }

    return base.join(" ");
  });

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    // Point the field's <label for> at the dropzone's internal file input.
    effect(() => {
      this.label(); // assert a <bit-label> was projected (NG0951 if missing)
      this.formFieldControl.labelForId.set(this.inputId());
    });
    // After a removal, restore focus to a sensible neighbor (the next delete button, or the
    // dropzone itself when the list is now empty).
    effect(() => {
      const idx = this.pendingFocusIndex();
      if (idx === null) {
        return;
      }
      const remaining = this.files();
      if (remaining.length === 0) {
        this.fileInput()?.nativeElement.focus();
      } else {
        this.fileList()?.focusDeleteAt(Math.min(idx, remaining.length - 1));
      }
      this.pendingFocusIndex.set(null);
    });
  }

  writeValue(value: File[] | null): void {
    const incoming = value ?? [];
    this._files.set(this.multiple() ? incoming : incoming.slice(0, 1));
  }

  registerOnChange(fn: (value: File[]) => void): void {
    this.onChange.set(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched.set(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledFromCva.set(isDisabled);
  }

  /** Marks the control touched when the dropzone loses focus so required errors can surface. */
  protected onBlur(): void {
    this.onTouched()();
  }

  /**
   * Opens the file picker when the drop area is clicked. The input carries `pointer-events-none`,
   * so a pointer click never lands on it directly and this handler always drives the picker.
   */
  protected onDropzoneClick(): void {
    if (this.disabled()) {
      return;
    }
    this.fileInput()?.nativeElement.click();
  }

  protected onInputClick(event: MouseEvent): void {
    // The programmatic click from `onDropzoneClick` dispatches a click on the input that would
    // otherwise bubble back to the container handler and re-open the picker; stop it here.
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    // Reset at click time so re-selecting the same file still fires `change`.
    (event.target as HTMLInputElement).value = "";
  }

  protected onInputChange(event: Event): void {
    if (this.disabled()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.addFiles(Array.from(input.files));
    }
  }

  protected onDragEnter(event: DragEvent): void {
    // Cancel before the disabled check: an element only becomes a valid drop target if its
    // drag handlers call preventDefault. Skipping it on a disabled dropzone would let the
    // browser fall back to its default file-drop action and navigate the tab to the file.
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
    this.dragDepth.update((d) => d + 1);
    this.isDragOver.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled()) {
      // Keep the "not allowed" cursor so the disabled state still reads correctly.
      if (event.dataTransfer != null) {
        event.dataTransfer.dropEffect = "none";
      }
      return;
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.disabled()) {
      return;
    }
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
    this.addFiles(Array.from(event.dataTransfer.files));
  }

  protected onRemove(file: File): void {
    if (this.disabled()) {
      return;
    }
    const removedIndex = this.files().indexOf(file);
    if (removedIndex < 0) {
      return;
    }
    this._files.update((current) => current.filter((f) => f !== file));
    this.announce(this.i18nService.t("fileRemoved", file.name));
    this.pendingFocusIndex.set(removedIndex);
    this.onChange()(this.files());
  }

  private addFiles(newFiles: File[]): void {
    const files = this.multiple() ? newFiles : newFiles.slice(0, 1);
    this.onTouched()();
    if (this.multiple()) {
      this._files.update((current) => [...current, ...files]);
    } else {
      this._files.set(files);
    }
    if (files.length === 1) {
      this.announce(this.i18nService.t("fileAdded", files[0].name));
    } else if (files.length > 1) {
      this.announce(
        this.i18nService.t("filesAdded", String(files.length), files.map((f) => f.name).join(", ")),
      );
    }
    this.onChange()(this.files());
  }

  /**
   * Announces with `assertive` politeness so add/remove — a direct response to a user action —
   * interrupts rather than queues behind the label/hint readout.
   */
  private announce(message: string): void {
    void this.liveAnnouncer.announce(message, "assertive");
  }
}
