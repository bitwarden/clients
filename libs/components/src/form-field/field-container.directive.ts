import { booleanAttribute, computed, Directive, input } from "@angular/core";

export type FieldContainerSize = "base" | "large";

@Directive({
  selector: "[bitFieldContainer]",
  standalone: true,
  host: { "[class]": "classes()" },
})
export class BitFieldContainerDirective {
  readonly size = input<FieldContainerSize>("base");
  readonly hasError = input(false, { transform: booleanAttribute });
  readonly readOnly = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() => {
    const size = this.size();
    const hasError = this.hasError();
    const readOnly = this.readOnly();

    return [
      "tw-group/form-field",
      "tw-flex",
      "tw-border",
      "tw-rounded-xl",
      "tw-border-solid",
      "tw-border-border-strong",
      "tw-bg-bg-secondary",
      "has-[input:disabled]:tw-border-border-base",
      "tw-transition-colors",
      "has-[:focus-visible]:tw-border-border-brand",
      "has-[:focus-visible]:tw-ring-border-brand",
      "has-[:focus-visible]:tw-ring-1",
      ...(size === "large" ? ["tw-text-base/6", "tw-min-h-12"] : ["tw-text-sm/5", "tw-min-h-10"]),
      ...(hasError
        ? [
            "!tw-ring-border-danger",
            "tw-ring-1",
            "!tw-border-border-danger",
            "has-[:focus-visible]:!tw-border-border-brand",
            "has-[:focus-visible]:!tw-ring-border-brand",
          ]
        : []),
      ...(readOnly
        ? [
            "tw-bg-transparent",
            "tw-border-transparent",
            "has-[:focus-visible]:!tw-border-border-focus",
            "has-[:focus-visible]:!tw-ring-border-focus",
          ]
        : ["[&:not(:has(:focus-visible), :has(input:disabled)):hover]:tw-bg-bg-quaternary"]),
    ].join(" ");
  });
}
