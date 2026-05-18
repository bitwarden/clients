import { AfterViewInit, Directive, ElementRef, computed, inject } from "@angular/core";
import { NgControl } from "@angular/forms";

import { BitFormFieldControlDirective } from "../form-field/form-field-control.directive";
import { BitFormFieldComponent } from "../form-field/form-field.component";

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
  hostDirectives: [
    {
      directive: BitFormFieldControlDirective,
      inputs: ["required", "showErrorsWhenDisabled", "type", "spellcheck", "id", "readonly"],
    },
  ],
  host: {
    "[class]": "classList()",
    "[id]": "formFieldControl.id()",
    "[attr.type]": "formFieldControl.type()",
    "[attr.spellcheck]": "formFieldControl.spellcheck()",
    "(input)": "onInput()",
    "[attr.aria-invalid]": "ariaInvalid()",
    "[required]": "formFieldControl.required()",
    "[attr.readonly]": "formFieldControl.readOnly() ? '' : null",
  },
})
export class BitInputDirective implements AfterViewInit {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly parentFormField = inject(BitFormFieldComponent, { optional: true });
  readonly formFieldControl = inject(BitFormFieldControlDirective);

  protected readonly classList = computed(() => {
    const isReadonlyTextarea =
      this.elementRef.nativeElement.tagName.toLowerCase() === "textarea" &&
      this.formFieldControl.readOnly();

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
      classes.push(
        ...inputBorderClasses(this.formFieldControl.hasError()),
        ...this.standaloneInputClasses(),
      );
    }

    return classes.filter((s) => s != "");
  });

  protected readonly ariaInvalid = computed(() =>
    this.formFieldControl.hasError() ? true : undefined,
  );

  ngAfterViewInit() {
    this.adjustTextareaHeight();
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

  protected readonly standaloneInputClasses = computed(() => [
    "tw-px-3",
    "tw-py-2",
    "tw-rounded-lg",
    this.formFieldControl.hasError()
      ? "hover:tw-border-border-danger"
      : "hover:tw-border-border-brand",
    "disabled:tw-bg-bg-secondary",
    "disabled:hover:tw-border-border-base",
    "focus:tw-border-border-brand",
    "focus:tw-ring-1",
    "focus:tw-ring-border-brand",
    "focus:tw-z-10",
  ]);
}
