import { NgTemplateOutlet } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitFieldContainerDirective } from "../form-field";
import { BitErrorComponent } from "../form-field/error.component";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";
import { TruncatedFilenameComponent } from "./truncated-filename.component";

let nextId = 0;

@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    DropzoneComponent,
    FileListComponent,
    TruncatedFilenameComponent,
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
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly accept = input("");

  /**
   * Maximum file size in MB
   *
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly maxFileSize = input<number | undefined>(undefined);

  /**
   * Allow multiple file selection
   *
   * NOTE: If `multiple="true"` it will render the 'dropzone' version of the component
   */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Error state — shows danger border and message */
  readonly errorMessage = input<string>(undefined);

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

  private readonly cvaOnChange = signal<(value: File | null) => void>(() => {});
  private readonly cvaOnTouched = signal<() => void>(() => {});

  /** Required for NG_VALUE_ACCESSOR */
  writeValue(value: File | null): void {
    this.files.set(value ? [value] : []);
  }

  registerOnChange(fn: (value: File | null) => void): void {
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
  protected readonly ariaLabelledBy = `${this.inputId}-label ${this.inputId}-status`;

  private readonly hint = contentChild(BitHintDirective);
  private readonly errorEl = viewChild(BitErrorComponent);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");

  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorMessage()) {
      return this.errorEl()?.id ?? null;
    }
    return this.hint()?.id ?? null;
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
    this.cvaOnChange()(this.files()[0] ?? null);
  }

  protected onFileRemoved(file: File): void {
    if (this.disabled()) {
      return;
    }
    this.files.update((current) => current.filter((f) => f !== file));
    this.cvaOnChange()(this.files()[0] ?? null);
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
