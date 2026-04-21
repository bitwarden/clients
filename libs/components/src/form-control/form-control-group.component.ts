import { NgTemplateOutlet } from "@angular/common";
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ControlValueAccessor, NgControl, TouchedChangeEvent, Validators } from "@angular/forms";
import { filter } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";

import { BitHintDirective } from "./hint.directive";
import { BitLabelComponent } from "./label.component";

let nextId = 0;

@Component({
  selector: "bit-form-control-group, bit-radio-group",
  templateUrl: "form-control-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, I18nPipe, IconComponent],
  host: {
    "(focusout)": "onFocusOut($event)",
    class: "tw-block tw-mb-4",
  },
})
export class FormControlGroupComponent<T = unknown>
  implements ControlValueAccessor, AfterContentInit
{
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly i18nService = inject(I18nService);
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = `bit-form-control-group-${nextId++}`;
  readonly errorId = `${this.id}-error`;

  readonly block = input(false);

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  protected readonly label = contentChild(BitLabelComponent);
  readonly hint = contentChild(BitHintDirective, { descendants: false });

  // ── Template helpers ─────────────────────────────────────────────────────
  // Card groups (multi) are always column layout. Inline radio groups (single + !block) flow naturally.
  readonly containerClass = computed(() =>
    this.block() || this.mode() === "multi"
      ? "tw-flex tw-flex-col tw-gap-2 [&_bit-form-control-card]:!tw-mb-0 [&_bit-radio-button-card]:!tw-mb-0 [&_bit-radio-button]:!tw-mb-0"
      : "tw-flex [&_bit-form-control]:tw-flex",
  );

  // ── Mode (auto-detected from child types) ─────────────────────────────────
  // Radio children call registerRadioChild() in their constructor, which flips
  // mode to 'single'. Checkbox/switch children never register, keeping 'multi'.
  private readonly _hasRadioChildren = signal(false);
  readonly mode = computed(() => (this._hasRadioChildren() ? "single" : "multi"));

  registerRadioChild(): void {
    this._hasRadioChildren.set(true);
  }

  // ── Accessor needed by RadioButtonBaseDirective ───────────────────────────
  get name(): string | undefined {
    return this.ngControl?.name?.toString();
  }

  // ── State ─────────────────────────────────────────────────────────────────
  readonly selectedValues = signal<unknown[]>([]);
  readonly groupDisabled = signal(false);
  private readonly _touched = signal(false);
  private readonly _status = signal<string | null>(null);

  // ── Computed validation state ─────────────────────────────────────────────
  readonly required = computed(() => {
    this._status(); // subscribe so this re-evaluates when status changes
    return this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  });

  readonly hasError = computed(() => this._status() === "INVALID" && this._touched());

  readonly error = computed((): [string, any] => {
    this._status();
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  });

  readonly displayError = computed(() => {
    const [key, details] = this.error();
    switch (key) {
      case "required":
        return this.i18nService.t("inputRequired");
      default:
        if (details?.message) {
          return details.message;
        }
        return key;
    }
  });

  // ── Child coordination ────────────────────────────────────────────────────
  onItemChange(value: unknown): void {
    if (this.mode() === "single") {
      this.selectedValues.set([value]);
      this.notifyOnChange()?.(value);
    } else {
      this.selectedValues.update((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
      );
      this.notifyOnChange()?.(this.selectedValues());
    }
    this.notifyOnTouched()?.();
  }

  onBlur(): void {
    this.notifyOnTouched()?.();
  }

  onFocusOut(event: FocusEvent): void {
    if (!this.elementRef.nativeElement.contains(event.relatedTarget as Node)) {
      this.onBlur();
    }
  }

  ngAfterContentInit(): void {
    if (!this.ngControl) {
      return;
    }
    this._status.set(this.ngControl.status);
    if (this.ngControl.control?.touched) {
      this._touched.set(true);
    }
    this.ngControl.statusChanges
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => this._status.set(status));
    this.ngControl.control?.events
      .pipe(
        filter((e): e is TouchedChangeEvent => e instanceof TouchedChangeEvent),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this._touched.set(e.touched));
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────
  private readonly notifyOnChange = signal<(v: any) => void>(() => {});
  private readonly notifyOnTouched = signal<() => void>(() => {});

  writeValue(value: T | T[] | null): void {
    // Use Array.isArray to distinguish single vs multi (array) payloads.
    // This must work before mode is detected (writeValue is called during form setup,
    // before radio children register), so we infer from the value shape rather than mode.
    if (Array.isArray(value)) {
      this.selectedValues.set(value);
    } else if (value != null) {
      this.selectedValues.set([value]);
    } else {
      this.selectedValues.set([]);
    }
  }

  registerOnChange(fn: (v: any) => void): void {
    this.notifyOnChange.set(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.notifyOnTouched.set(() => {
      fn();
      this._touched.set(true);
    });
  }

  setDisabledState(isDisabled: boolean): void {
    this.groupDisabled.set(isDisabled);
  }
}
