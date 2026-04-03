import { FocusableOption } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import {
  Component,
  ElementRef,
  HostBinding,
  Input,
  input,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";

@Component({
  selector: "[bitMenuItem]",
  templateUrl: "menu-item.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItemComponent implements FocusableOption {
  readonly variant = input<"primary" | "danger">("primary");

  protected readonly computedStyles = computed(() => {
    switch (this.variant()) {
      case "primary":
        return ["tw-text-fg-body", "hover:tw-text-fg-heading", "hover:tw-bg-bg-brand-softer"];
      case "danger":
        return [
          "tw-text-fg-danger",
          "hover:tw-text-fg-danger-strong",
          "hover:tw-bg-bg-danger-soft",
        ];
      default:
        return [];
    }
  });

  @HostBinding("class") get classList() {
    return [
      "tw-block",
      "tw-w-full",
      "tw-p-2",
      "tw-rounded-lg",
      "!tw-no-underline",
      "tw-cursor-pointer",
      "tw-border-none",
      "tw-bg-background",
      "tw-text-left",
      "focus-visible:tw-z-50",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-rounded-lg",
      "focus-visible:tw-ring-inset",
      "focus-visible:tw-ring-border-focus",
      "active:!tw-ring-0",
      "active:!tw-ring-offset-0",
      "disabled:!tw-text-fg-disabled",
      "disabled:!tw-bg-transparent",
      "disabled:hover:!tw-bg-transparent",
      "disabled:!tw-cursor-not-allowed",
      ...this.computedStyles(),
    ];
  }
  @HostBinding("attr.role") role = "menuitem";
  @HostBinding("tabIndex") tabIndex = "-1";
  @HostBinding("attr.disabled") get disabledAttr() {
    return this.disabled || null; // native disabled attr must be null when false
  }

  // TODO: Skipped for signal migration because:
  //  This input overrides a field from a superclass, while the superclass field
  //  is not migrated.
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty }) disabled?: boolean = false;

  constructor(public elementRef: ElementRef<HTMLButtonElement>) {}

  focus() {
    this.elementRef.nativeElement.focus();
  }
}
