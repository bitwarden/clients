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

import { I18nPipe } from "@bitwarden/ui-common";

import { BitHintDirective } from "../form-control/hint.directive";
import { BitLabelComponent } from "../form-control/label.component";
import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { BitPrefixDirective } from "../form-field/prefix.directive";

import { FileNameComponent } from "./file-name.component";

/**
 * A single-file picker composed over `bit-form-field`. The component hosts
 * `BitFormFieldControlDirective` and is its own `ControlValueAccessor`, so it plugs into
 * `bit-form-field` through the normal control path and consumers bind it the standard way —
 * `formControlName` / `[formControl]` / `[(ngModel)]`. Its value is a single `File`, or `null` when
 * nothing is selected. For multi-file selection use `bit-file-dropzone`, whose value is a `File[]`.
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
  imports: [BitFormFieldComponent, BitPrefixDirective, FileNameComponent, I18nPipe],
  hostDirectives: [{ directive: BitFormFieldControlDirective, inputs: ["id"] }],
  host: {
    class: "tw-block",
    "[id]": "formFieldControl.id()",
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

  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  /** The hosted control directive `bit-form-field` reads its label / required / error state from. */
  protected readonly formFieldControl = inject(BitFormFieldControlDirective);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");
  private readonly hint = contentChild(BitHintDirective, { descendants: true });
  // Enforce an accessible label; consumers must project a <bit-label>.
  private readonly label = contentChild.required(BitLabelComponent);

  private readonly _file = signal<File | null>(null);
  private readonly _disabledFromCva = signal(false);

  private readonly onChange = signal<(value: File | null) => void>(() => {});
  private readonly onTouched = signal<() => void>(() => {});

  // The consumer's `id` (or the directive's auto-generated fallback) lands on the host element; the
  // focusable button and other internals derive distinct ids from it so nothing collides.
  protected readonly inputId = computed(() => `${this.formFieldControl.id()}-button`);
  protected readonly statusId = computed(() => `${this.inputId()}-status`);
  protected readonly fileInputId = computed(() => `${this.inputId()}-input`);

  protected readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());
  protected readonly fileName = computed(() => this._file()?.name);

  /**
   * The projected hint id (queried here because `bit-form-field` can't see a hint we re-project
   * through our own `<ng-content>`), form-field's error target, and the live status region.
   */
  protected readonly describedBy = computed(() => {
    const ids = [this.hint()?.id, this.formFieldControl.ariaDescribedBy(), this.statusId()].filter(
      Boolean,
    );
    return [...new Set(ids)].join(" ") || null;
  });

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    // Point the field's <label for> at the focusable "Choose File" button rather than the host.
    effect(() => {
      this.label(); // assert a <bit-label> was projected (NG0951 if missing)
      this.formFieldControl.labelForId.set(this.inputId());
    });
  }

  writeValue(value: File | null): void {
    this._file.set(value ?? null);
  }

  registerOnChange(fn: (value: File | null) => void): void {
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
    this._file.set(input.files[0]);
    this.onChange()(this._file());
  }
}
