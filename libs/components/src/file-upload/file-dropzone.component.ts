import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { ControlValueAccessor, FormControl, NgControl } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { BitCustomInputDirective } from "../form-field/custom-input.directive";
import { BitFormControlProxyDirective } from "../form-field/form-control-proxy.directive";
import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { BitInputDirective } from "../input/input.directive";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";

let nextId = 0;

@Component({
  selector: "bit-file-dropzone",
  templateUrl: "./file-dropzone.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitCustomInputDirective,
    BitFormControlProxyDirective,
    BitFormFieldComponent,
    BitInputDirective,
    DropzoneComponent,
    FileListComponent,
    I18nPipe,
  ],
  host: {
    class: "tw-block",
  },
})
export class FileDropzoneComponent implements ControlValueAccessor {
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

  /** Allow multiple file selection. */
  readonly multiple = input(false, { transform: booleanAttribute });

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

  private readonly fallbackControl = new FormControl<File[]>([], { nonNullable: true });

  protected get boundControl(): FormControl<File[]> {
    return (this.ngControl?.control as FormControl<File[]> | null) ?? this.fallbackControl;
  }

  /** Required for NG_VALUE_ACCESSOR. Form value is always `File[]` ([] = no files). */
  writeValue(value: File[] | null): void {
    const incoming = value ?? [];
    this._files.set(this.multiple() ? incoming : incoming.slice(0, 1));
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

  protected readonly inputId = `bit-file-dropzone-${nextId++}`;
  protected readonly filesUploadedStatusId = `${this.inputId}-files-uploaded`;

  protected readonly innerFormFieldControl = viewChild(BitFormFieldControlDirective);
  private readonly dropzoneRef = viewChild(DropzoneComponent);
  private readonly fileListRef = viewChild(FileListComponent);

  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

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

  protected readonly ariaDescribedBy = computed(() => {
    return this.files().length > 0 ? this.filesUploadedStatusId : null;
  });

  private readonly pendingFocusIndex = signal<number | null>(null);

  constructor() {
    if (this.ngControl != null) {
      this.ngControl.valueAccessor = this;
    }
    // Self-stabilizing override: re-run whenever labelForId changes (e.g. the
    // directive's own effect resets it to its host id) and re-point it at the
    // dropzone's internal file input so the rendered <label [for]> targets the
    // focusable element rather than the hidden ghost input.
    effect(() => {
      const inner = this.innerFormFieldControl();
      if (!inner) {
        return;
      }
      if (inner.labelForId() !== this.inputId) {
        inner.labelForId.set(this.inputId);
      }
    });
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

  /**
   * Fires `cvaOnTouched` when the dropzone's internal file input loses focus.
   * Without this, Validators.required errors never surface because the
   * FormControl never transitions to `touched` unless the user actually picks
   * a file.
   */
  protected onDropzoneBlur(): void {
    this.cvaOnTouched()();
  }

  protected onFilesSelected(newFiles: File[]): void {
    this.cvaOnTouched()();
    if (this.multiple()) {
      this._files.update((current) => [...current, ...newFiles]);
    } else {
      this._files.set(newFiles.length > 0 ? [newFiles[0]] : []);
    }
    if (newFiles.length === 1) {
      this.announce(this.i18nService.t("fileAdded", newFiles[0].name));
    } else if (newFiles.length > 1) {
      this.announce(
        this.i18nService.t(
          "filesAdded",
          String(newFiles.length),
          newFiles.map((f) => f.name).join(", "),
        ),
      );
    }
    this.emitCvaChange();
  }

  protected onFileRemoved(file: File): void {
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
    this.emitCvaChange();
  }

  /**
   * Wraps `LiveAnnouncer.announce` with `assertive` politeness so the change
   * interrupts whatever the SR is reading — file add/remove is a direct response
   * to a user action and should not queue behind label/hint readout.
   */
  private announce(message: string): void {
    void this.liveAnnouncer.announce(message, "assertive");
  }

  private emitCvaChange(): void {
    this.cvaOnChange()(this.files());
  }
}
