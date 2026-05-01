import {
  AfterViewInit,
  DestroyRef,
  Directive,
  Signal,
  WritableSignal,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NgControl, StatusChangeEvent, TouchedChangeEvent, Validators } from "@angular/forms";
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

@Directive({
  standalone: true,
  host: {
    "[attr.aria-describedby]": "ariaDescribedBy()",
  },
})
export class BitFormFieldControl implements AfterViewInit {
  protected readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly controlEvent = signal<unknown>(null);

  readonly ariaDescribedBy: WritableSignal<string | undefined> = signal(undefined);
  readonly labelForId: WritableSignal<string> = signal("");
  readonly readOnly: WritableSignal<boolean | undefined> = signal(undefined);
  readonly type = model<InputTypes | undefined>(undefined);
  readonly spellcheck = model<boolean | undefined>(undefined);

  readonly requiredInput = input(false, { transform: booleanAttribute, alias: "required" });
  readonly required: Signal<boolean> = computed(() => {
    this.controlEvent();
    return (
      this.requiredInput() || (this.ngControl?.control?.hasValidator(Validators.required) ?? false)
    );
  });

  readonly showErrorsWhenDisabled = input(false);
  readonly hasError: Signal<boolean> = computed(() => {
    this.controlEvent();
    if (this.showErrorsWhenDisabled()) {
      return !!(
        (this.ngControl?.status === "INVALID" || this.ngControl?.status === "DISABLED") &&
        this.ngControl?.touched &&
        this.ngControl?.errors != null
      );
    }
    return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
  });

  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
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
