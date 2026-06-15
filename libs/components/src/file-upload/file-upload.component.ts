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
  model,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitFieldContainerDirective } from "../form-field";
import { BitErrorComponent } from "../form-field/error.component";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";
import { FileNameComponent } from "./file-name.component";

let nextId = 0;

@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DropzoneComponent,
    FileListComponent,
    FileNameComponent,
    BitFieldContainerDirective,
    I18nPipe,
    BitErrorComponent,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: FileUploadComponent,
      multi: true,
    },
  ],
  host: {
    class: "tw-block",
  },
})
export class FileUploadComponent implements ControlValueAccessor {
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
   **/
  readonly accept = input("");

  /**
   * Maximum file size in MB. When omitted, the size hint is hidden.
   *
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly maxFileSize = input<number>();

  /**
   * Allow multiple file selection
   *
   * NOTE: If `multiple="true"` it will render the 'dropzone' version of the component
   */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Error state — shows danger border and message */
  readonly errorMessage = input<string>();

  /**
   * Two-way bound file list — use [(files)] for two-way binding
   *
   * NOTE: File list only renders in the dropzone variant usage
   */
  readonly files = model<File[]>([]);

  /** UI variant: 'dropzone' or 'default' */
  readonly variant = input<"dropzone" | "default">("default");

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  private readonly _disabledFromCva = signal(false);

  readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());

  private readonly cvaOnChange = signal<(value: File | File[] | null) => void>(() => {});
  private readonly cvaOnTouched = signal<() => void>(() => {});

  /**
   * Required for NG_VALUE_ACCESSOR.
   *
   * The form value is `File[]` when `multiple` is set, and `File | null` otherwise.
   * `writeValue` accepts either shape so consumers don't have to pre-normalize.
   */
  writeValue(value: File | File[] | null | undefined): void {
    const incoming = Array.isArray(value) ? value : value ? [value] : [];
    this.files.set(this.multiple() ? incoming : incoming.slice(0, 1));
  }

  registerOnChange(fn: (value: File | File[] | null) => void): void {
    this.cvaOnChange.set(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.cvaOnTouched.set(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledFromCva.set(isDisabled);
  }

  protected readonly inputId = `bit-file-upload-${nextId++}`;

  protected readonly useDropzoneVariant = computed(
    () => this.variant() === "dropzone" || this.multiple(),
  );

  protected readonly labelId = `${this.inputId}-label`;
  protected readonly statusId = `${this.inputId}-status`;
  protected readonly filesUploadedStatusId = `${this.inputId}-files-uploaded`;
  protected readonly ariaLabelledBy = `${this.inputId}-label ${this.inputId}-status`;

  private readonly hint = contentChild(BitHintDirective);
  private readonly errorEl = viewChild(BitErrorComponent);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");
  private readonly dropzoneRef = viewChild(DropzoneComponent);
  private readonly fileListRef = viewChild(FileListComponent);

  /**
   * Drives the dropzone-variant aria-live announcement and the post-removal
   * focus effect. `{ type: "none" }` keeps the live region empty on first
   * render so screen readers don't announce anything on load.
   */
  protected readonly lastAction = signal<
    | { type: "none" }
    | { type: "added"; name: string }
    | { type: "addedMultiple"; count: number; names: string }
    | { type: "removed"; name: string }
  >({ type: "none" });

  private readonly i18nService = inject(I18nService);

  /**
   * Translated text for the dropzone-variant aria-live region. Bound as a
   * single text node ({{ statusMessage() }}) rather than @switch so screen
   * readers reliably register mutations to the live region.
   */
  protected readonly statusMessage = computed(() => {
    const action = this.lastAction();
    switch (action.type) {
      case "added":
        return this.i18nService.t("fileAdded", action.name);
      case "addedMultiple":
        return this.i18nService.t("filesAdded", String(action.count), action.names);
      case "removed":
        return this.i18nService.t("fileRemoved", action.name);
      default:
        return "";
    }
  });

  /**
   * Text wired into the dropzone input via aria-describedby so screen readers
   * announce existing upload state on focus arrival. Empty when no files are
   * attached so the SR reads the label/hint unchanged.
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

  private readonly pendingFocusIndex = signal<number | null>(null);

  constructor() {
    effect(() => {
      const idx = this.pendingFocusIndex();
      if (idx === null) {
        return;
      }
      const remaining = this.files();
      if (remaining.length === 0) {
        this.dropzoneRef()?.focus();
      } else {
        this.fileListRef()?.focusDeleteAt(Math.min(idx, remaining.length - 1));
      }
      this.pendingFocusIndex.set(null);
    });
  }

  protected readonly ariaDescribedBy = computed(() => {
    const ids: string[] = [];
    if (this.useDropzoneVariant() && this.files().length > 0) {
      ids.push(this.filesUploadedStatusId);
    }
    if (this.errorMessage()) {
      const errorId = this.errorEl()?.id;
      if (errorId) {
        ids.push(errorId);
      }
    } else {
      const hintId = this.hint()?.id;
      if (hintId) {
        ids.push(hintId);
      }
    }
    return ids.length > 0 ? ids.join(" ") : null;
  });

  protected readonly fileLabel = computed(() => {
    const files = this.files();
    if (files.length) {
      return files[0].name;
    }
  });

  protected onFilesSelected(newFiles: File[]): void {
    this.cvaOnTouched()();
    if (this.multiple()) {
      this.files.update((current) => [...current, ...newFiles]);
    } else {
      this.files.set(newFiles.length > 0 ? [newFiles[0]] : []);
    }
    if (this.useDropzoneVariant()) {
      if (newFiles.length === 1) {
        this.lastAction.set({ type: "added", name: newFiles[0].name });
      } else if (newFiles.length > 1) {
        this.lastAction.set({
          type: "addedMultiple",
          count: newFiles.length,
          names: newFiles.map((f) => f.name).join(", "),
        });
      }
    }
    this.emitCvaChange();
  }

  protected onFileRemoved(file: File): void {
    if (this.disabled()) {
      return;
    }
    const removedIndex = this.files().indexOf(file);
    this.files.update((current) => current.filter((f) => f !== file));
    this.lastAction.set({ type: "removed", name: file.name });
    if (removedIndex >= 0) {
      this.pendingFocusIndex.set(removedIndex);
    }
    this.emitCvaChange();
  }

  private emitCvaChange(): void {
    const files = this.files();
    this.cvaOnChange()(this.multiple() ? files : (files[0] ?? null));
  }

  protected openFilePicker(): void {
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = ""; // clear before opening so the same file can be re-selected
      input.click();
    }
  }

  protected onButtonFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.onFilesSelected(Array.from(input.files));
    }
  }
}
