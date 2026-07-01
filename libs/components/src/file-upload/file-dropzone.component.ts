import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  AfterViewInit,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  NgControl,
  StatusChangeEvent,
  TouchedChangeEvent,
  Validators,
} from "@angular/forms";
import { filter } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonComponent } from "../button/button.component";
import { BitFormFieldComponent } from "../form-field/form-field.component";
import { BitIconButtonComponent } from "../icon-button/icon-button.component";
import { IconTileComponent } from "../icon-tile/icon-tile.component";

import { FileNameComponent } from "./file-name.component";

let nextId = 0;

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
    BitFormFieldComponent,
    BitIconButtonComponent,
    FileNameComponent,
    IconTileComponent,
    I18nPipe,
  ],
  host: {
    class: "tw-block",
  },
})
export class FileDropzoneComponent implements ControlValueAccessor, AfterViewInit {
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

  readonly requiredInput = input(false, { transform: booleanAttribute, alias: "required" });
  readonly disabledInput = input(false, { transform: booleanAttribute, alias: "disabled" });

  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  private readonly formField = viewChild(BitFormFieldComponent);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>("fileInput");
  private readonly deleteButtons = viewChildren("deleteBtn", { read: ElementRef });

  private readonly _files = signal<File[]>([]);
  readonly files = this._files.asReadonly();

  private readonly _disabledFromCva = signal(false);
  // Bridges NgControl's RxJS status/touched events into the signal graph so `required`,
  // `hasError`, and `error` re-evaluate when the bound control changes.
  private readonly controlEvent = signal<unknown>(null);
  private readonly pendingFocusIndex = signal<number | null>(null);
  protected readonly isDragOver = signal(false);
  // Track drag enter/leave depth so dragging over child elements doesn't flicker the state.
  private readonly dragDepth = signal(0);

  private readonly onChange = signal<(value: File[]) => void>(() => {});
  private readonly onTouched = signal<() => void>(() => {});

  protected readonly inputId = `bit-file-dropzone-${nextId++}`;
  protected readonly statusId = `${this.inputId}-status`;
  protected readonly listLabelId = `${this.inputId}-list-label`;

  protected readonly disabled = computed(() => this.disabledInput() || this._disabledFromCva());

  protected readonly required = computed(() => {
    this.controlEvent();
    return (
      this.requiredInput() || (this.ngControl?.control?.hasValidator(Validators.required) ?? false)
    );
  });

  protected readonly hasError = computed(() => {
    this.controlEvent();
    return this.ngControl?.status === "INVALID" && (this.ngControl?.touched ?? false);
  });

  protected readonly error = computed<[string, any] | undefined>(() => {
    this.controlEvent();
    const errors = this.ngControl?.errors;
    if (errors == null) {
      return undefined;
    }
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  });

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

  protected readonly describedBy = computed(
    () =>
      [this.formField()?.describedById(), this.files().length > 0 ? this.statusId : null]
        .filter(Boolean)
        .join(" ") || null,
  );

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
    } else if (this.hasError()) {
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
        const target = this.deleteButtons()[Math.min(idx, remaining.length - 1)];
        (target?.nativeElement as HTMLButtonElement | undefined)?.focus();
      }
      this.pendingFocusIndex.set(null);
    });
  }

  ngAfterViewInit(): void {
    this.ngControl?.control?.events
      .pipe(
        filter((e) => e instanceof TouchedChangeEvent || e instanceof StatusChangeEvent),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.controlEvent.set(e));
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

  protected onInputClick(event: MouseEvent): void {
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

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);
    return `${Number.isInteger(size) ? size : size.toFixed(1)} ${units[i]}`;
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
