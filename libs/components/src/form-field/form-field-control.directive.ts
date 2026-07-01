import {
  AfterViewInit,
  DestroyRef,
  Directive,
  Signal,
  WritableSignal,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  NgControl,
  StatusChangeEvent,
  TouchedChangeEvent,
  Validators,
} from "@angular/forms";
import { filter } from "rxjs";

export type InputTypes =
  | "text"
  | "password"
  | "number"
  | "datetime-local"
  | "email"
  | "checkbox"
  | "search"
  | "file"
  | "date"
  | "time";

/**
 * Whether the field should show its required indicator. `requiredOverride` covers the `required`
 * attribute set independently of a `Validators.required` on the control.
 */
export function isControlRequired(
  control: AbstractControl | null | undefined,
  requiredOverride = false,
): boolean {
  return requiredOverride || (control?.hasValidator(Validators.required) ?? false);
}

/**
 * Whether the field should surface an error: invalid + touched, plus an optional disabled variant.
 */
export function controlHasError(
  control: AbstractControl | null | undefined,
  showErrorsWhenDisabled = false,
): boolean {
  if (control == null) {
    return false;
  }
  if (showErrorsWhenDisabled) {
    return (
      (control.status === "INVALID" || control.status === "DISABLED") &&
      control.touched &&
      control.errors != null
    );
  }
  return control.status === "INVALID" && control.touched;
}

/** The first error on the control as a `[key, value]` tuple, for `bit-error`. */
export function firstControlError(control: AbstractControl | null | undefined): [string, any] {
  const errors = control?.errors ?? {};
  const key = Object.keys(errors)[0];
  return [key, errors[key]];
}

let nextId = 0;

@Directive({
  standalone: true,
  host: {
    "[attr.aria-describedby]": "ariaDescribedBy()",
  },
})
export class BitFormFieldControlDirective implements AfterViewInit {
  protected readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly destroyRef = inject(DestroyRef);
  // Bridges NgControl's RxJS events into the signal graph so `required` and `hasError` computed
  // signals re-evaluate on StatusChangeEvent / TouchedChangeEvent.
  private readonly controlEvent = signal<unknown>(null);

  readonly id = input(`bit-form-field-${nextId++}`);

  readonly ariaDescribedBy: WritableSignal<string | undefined> = signal(undefined);
  readonly labelForId: WritableSignal<string> = signal("");

  constructor() {
    effect(() => this.labelForId.set(this.id()));
  }

  readonly readOnly = input(false, { transform: booleanAttribute, alias: "readonly" });
  readonly type = model<InputTypes | undefined>(undefined);
  readonly spellcheck = model<boolean | undefined>(undefined);

  readonly requiredInput = input(false, { transform: booleanAttribute, alias: "required" });
  readonly required: Signal<boolean> = computed(() => {
    this.controlEvent();
    return isControlRequired(this.ngControl?.control, this.requiredInput());
  });

  readonly showErrorsWhenDisabled = input(false);
  readonly hasError: Signal<boolean> = computed(() => {
    this.controlEvent();
    return controlHasError(this.ngControl?.control, this.showErrorsWhenDisabled());
  });

  get error(): [string, any] {
    return firstControlError(this.ngControl?.control);
  }

  ngAfterViewInit() {
    this.ngControl?.control?.events
      .pipe(
        filter((e) => e instanceof TouchedChangeEvent || e instanceof StatusChangeEvent),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.controlEvent.set(e));
  }
}
