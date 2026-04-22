import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  Signal,
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

import { BitFormFieldControl, InputTypes } from "../form-field/form-field-control";
import { BitFormFieldComponent } from "../form-field/form-field.component";

// Increments for each instance of this component
let nextId = 0;

export function inputBorderClasses(error: boolean) {
  return [
    "tw-border",
    "!tw-border-solid",
    error ? "tw-border-danger-600" : "tw-border-secondary-500",
    "focus:tw-outline-none",
  ];
}

@Directive({
  selector: "input[bitInput], select[bitInput], textarea[bitInput]",
  providers: [{ provide: BitFormFieldControl, useExisting: BitInputDirective }],
  host: {
    "[class]": "classList()",
    "[id]": "id()",
    "[attr.type]": "type()",
    "[attr.spellcheck]": "spellcheck()",
    "(input)": "onInput()",
    "[attr.aria-describedby]": "ariaDescribedBy()",
    "[attr.aria-invalid]": "ariaInvalid",
    "[required]": "required()",
  },
})
export class BitInputDirective implements BitFormFieldControl, AfterViewInit {
  private ngControl = inject(NgControl, { optional: true, self: true });
  private ngZone = inject(NgZone);
  private elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private parentFormField = inject(BitFormFieldComponent, { optional: true });

  protected classList() {
    const isReadonlyTextarea =
      this.elementRef.nativeElement.tagName.toLowerCase() === "textarea" && this.readOnly;

    const classes = [
      "tw-block",
      "tw-w-full",
      "[&:is(input,select)]:tw-h-full",
      "[&:is(textarea)]:tw-h-auto",
      "[&:is(textarea)]:tw-min-h-[80px]",
      ...(isReadonlyTextarea ? [] : ["tw-max-h-[50vh]", "tw-overflow-scroll"]),
      "[&:is(textarea)]:tw-resize-none",
      "tw-px-1",
      "tw-placeholder-fg-body-subtle",
      "tw-border-none",
      "focus:tw-outline-none",
      "tw-bg-transparent",
      "tw-text-fg-heading",
      "[&:is(input,textarea):disabled]:tw-bg-bg-secondary",
      "[&:is(input,textarea):disabled]:!tw-placeholder-fg-inactive",
      "[&:is(input,textarea):disabled]:!tw-text-fg-inactive",
    ];

    if (this.parentFormField === null) {
      classes.push(...inputBorderClasses(this.hasError()), ...this.standaloneInputClasses);
    }

    return classes.filter((s) => s != "");
  }

  readonly id = input(`bit-input-${nextId++}`);

  readonly ariaDescribedBy = signal<string | undefined>(undefined);

  protected get ariaInvalid() {
    return this.hasError() ? true : undefined;
  }

  readonly type = model<InputTypes>();

  readonly spellcheck = model<boolean>();

  readonly requiredInput = input(false, { transform: booleanAttribute, alias: "required" });
  readonly required: Signal<boolean> = computed(() => {
    this.controlEvent();
    return (
      this.requiredInput() || (this.ngControl?.control?.hasValidator(Validators.required) ?? false)
    );
  });

  protected readonly hasPrefix = input(false);
  protected readonly hasSuffix = input(false);

  protected readonly showErrorsWhenDisabled = input<boolean>(false);

  private readonly destroyRef = inject(DestroyRef);
  private readonly controlEvent = signal<unknown>(null);

  readonly hasError: Signal<boolean> = computed(() => {
    this.controlEvent();
    if (this.showErrorsWhenDisabled()) {
      return !!(
        (this.ngControl?.status === "INVALID" || this.ngControl?.status === "DISABLED") &&
        this.ngControl?.touched &&
        this.ngControl?.errors != null
      );
    } else {
      return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
    }
  });

  get labelForId(): string {
    return this.id();
  }

  ngAfterViewInit() {
    this.adjustTextareaHeight();
    this.ngControl?.control?.events
      .pipe(
        filter((e) => e instanceof TouchedChangeEvent || e instanceof StatusChangeEvent),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.controlEvent.set(e));
  }

  protected onInput() {
    this.ngControl?.control?.markAsUntouched();
    this.adjustTextareaHeight();
  }

  private adjustTextareaHeight() {
    const el = this.elementRef.nativeElement;
    if (el.tagName.toLowerCase() !== "textarea") {
      return;
    }
    const textarea = el;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  get error(): [string, any] {
    const errors = this.ngControl?.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }

  focus() {
    this.ngZone.runOutsideAngular(() => {
      const end = this.elementRef.nativeElement.value.length;
      this.elementRef.nativeElement.setSelectionRange(end, end);
      this.elementRef.nativeElement.focus();
    });
  }

  get readOnly(): boolean {
    return this.elementRef.nativeElement.readOnly;
  }

  protected get standaloneInputClasses() {
    return [
      "tw-px-3",
      "tw-py-2",
      "tw-rounded-lg",
      this.hasError() ? "hover:tw-border-border-danger" : "hover:tw-border-border-brand",
      "disabled:tw-bg-bg-secondary",
      "disabled:hover:tw-border-border-base",
      "focus:tw-border-border-brand",
      "focus:tw-ring-1",
      "focus:tw-ring-border-brand",
      "focus:tw-z-10",
    ];
  }
}
