import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, FormControl, NgControl } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitFormControlProxyDirective } from "../form-field/form-control-proxy.directive";
import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { BitPrefixDirective } from "../form-field/prefix.directive";
import { BitInputDirective } from "../input/input.directive";

import { FileNameComponent } from "./file-name.component";

let nextId = 0;

@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitFormControlProxyDirective,
    BitFormFieldComponent,
    BitInputDirective,
    BitPrefixDirective,
    FileNameComponent,
    I18nPipe,
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

  readonly required = input(false, { transform: booleanAttribute });

  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  private readonly _files = signal<File[]>([]);
  /** Current selection. External consumers should bind via CVA; this signal is read-only. */
  readonly files = this._files.asReadonly();

  private readonly _disabledFromCva = signal(false);
  readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());

  private readonly cvaOnChange = signal<(value: File[]) => void>(() => {});
  private readonly cvaOnTouched = signal<() => void>(() => {});

  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  /**
   * Fallback control used when the component is mounted without a `formControl` /
   * `ngModel` binding. `bit-form-field`'s `contentChild.required(BitFormFieldControlDirective)`
   * resolves against the ghost input, which requires a FormControl on the same element.
   */
  private readonly fallbackControl = new FormControl<File[]>([], { nonNullable: true });

  protected get boundControl(): FormControl<File[]> {
    return (this.ngControl?.control as FormControl<File[]> | null) ?? this.fallbackControl;
  }

  /** Required for NG_VALUE_ACCESSOR. Form value is always `File[]` ([] = no file). */
  writeValue(value: File[] | null): void {
    const incoming = value ?? [];
    this._files.set(incoming.slice(0, 1));
  }

  registerOnChange(fn: (value: File[]) => void): void {
    this.cvaOnChange.set(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.cvaOnTouched.set(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledFromCva.set(isDisabled);
  }

  protected readonly inputId = `bit-file-upload-${nextId++}`;
  protected readonly statusId = `${this.inputId}-status`;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");
  private readonly innerFormFieldControl = viewChild(BitFormFieldControlDirective);

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    // Self-stabilizing override: re-run whenever labelForId changes (e.g. the
    // directive's own effect resets it to its host id) and re-point it at the
    // visible "Choose File" pill so the rendered <label [for]> targets the
    // user-facing control rather than the hidden ghost input.
    effect(() => {
      const inner = this.innerFormFieldControl();
      if (!inner) {
        return;
      }
      if (inner.labelForId() !== this.inputId) {
        inner.labelForId.set(this.inputId);
      }
    });
  }

  protected readonly fileLabel = computed(() => {
    const files = this.files();
    if (files.length) {
      return files[0].name;
    }
    return undefined;
  });

  protected onFilesSelected(newFiles: File[]): void {
    this.cvaOnTouched()();
    this._files.set(newFiles.length > 0 ? [newFiles[0]] : []);
    this.emitCvaChange();
  }

  /**
   * Fires `cvaOnTouched` when the visible focusable element (the "Choose File"
   * prefix button) loses focus. Without this, Validators.required errors never
   * surface because the FormControl never transitions to `touched` unless the
   * user actually picks a file.
   */
  protected onPickerBlur(): void {
    this.cvaOnTouched()();
  }

  private emitCvaChange(): void {
    this.cvaOnChange()(this.files());
  }

  protected openFilePicker(): void {
    if (this.disabled()) {
      return;
    }
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
