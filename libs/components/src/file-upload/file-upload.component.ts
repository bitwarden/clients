import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, NgControl } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitFieldContainerDirective } from "../form-field/field-container.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";

import { FileNameComponent } from "./file-name.component";

let nextId = 0;

/**
 * A single-file picker composed over `bit-form-field`. The component is itself the form control
 * (`ControlValueAccessor`), so consumers bind it the standard way — `formControlName` /
 * `[formControl]` / `[(ngModel)]` — and its value is always a `File[]` (`[]` = no file).
 *
 * @example
 * ```html
 * <bit-file-upload formControlName="file" accept=".json">
 *   <bit-label>License file</bit-label>
 *   <bit-hint>JSON only</bit-hint>
 * </bit-file-upload>
 * ```
 */
@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitFieldContainerDirective, BitFormFieldComponent, FileNameComponent, I18nPipe],
  host: {
    class: "tw-block",
  },
})
export class FileUploadComponent implements ControlValueAccessor {
  /**
   * Accepted file types. Uses a comma separated list.
   *
   * @example
   * Images only: "image/*"
   * PDF and Word docs: ".pdf,.doc,.docx"
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept#unique_file_type_specifiers
   *
   * NOTE: This is only a browser html hint, not validation.
   */
  readonly accept = input("");

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  // Exposed to the template so its control can be handed to `bit-form-field` for label/error state.
  protected readonly ngControl = inject(NgControl, { optional: true, self: true });

  protected readonly formField = viewChild(BitFormFieldComponent);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");

  private readonly _files = signal<File[]>([]);
  private readonly _disabledFromCva = signal(false);

  private readonly onChange = signal<(value: File[]) => void>(() => {});
  private readonly onTouched = signal<() => void>(() => {});

  protected readonly inputId = `bit-file-upload-${nextId++}`;
  protected readonly statusId = `${this.inputId}-status`;

  protected readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());
  protected readonly fileName = computed(() => this._files()[0]?.name);

  /** Combined `aria-describedby` for the picker: form-field's hint/error plus the live status. */
  protected readonly describedBy = computed(
    () => [this.formField()?.describedById(), this.statusId].filter(Boolean).join(" ") || null,
  );

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
  }

  writeValue(value: File[] | null): void {
    this._files.set((value ?? []).slice(0, 1));
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

  /** Marks the control touched when the picker loses focus so required errors can surface. */
  protected onBlur(): void {
    this.onTouched()();
  }

  protected openPicker(): void {
    if (this.disabled()) {
      return;
    }
    const input = this.fileInput()?.nativeElement;
    if (input) {
      input.value = ""; // clear before opening so the same file can be re-selected
      input.click();
    }
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    this.onTouched()();
    this._files.set([input.files[0]]);
    this.onChange()(this._files());
  }
}
