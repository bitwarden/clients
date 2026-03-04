// NOTE: Illustrative only — saved as button.vanilla.component.ts to avoid
// breaking the real build. Shows what button.component.ts would look like
// if migrated to vanilla-extract.

import {
  input,
  HostBinding,
  Component,
  model,
  computed,
  booleanAttribute,
  inject,
  ElementRef,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { debounce, interval } from "rxjs";

import { AriaDisableDirective } from "../a11y";
// ButtonType / ButtonSize are now derived from the recipe rather than
// defined by hand — they stay in sync automatically.
import { buttonRecipe, buttonContentRecipe, buttonInner, ButtonType, ButtonSize } from "./button.css";
import { ButtonLikeAbstraction } from "../shared/button-like.abstraction";
import { BitwardenIcon } from "../shared/icon";
import { SpinnerComponent } from "../spinner";
import { ariaDisableElement } from "../utils";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "button[bitButton], a[bitButton]",
  templateUrl: "button.component.html",
  providers: [{ provide: ButtonLikeAbstraction, useExisting: ButtonComponent }],
  imports: [SpinnerComponent],
  hostDirectives: [AriaDisableDirective],
})
export class ButtonComponent implements ButtonLikeAbstraction {
  @HostBinding("class") get classList() {
    // buttonRecipe() returns a stable, pre-hashed class name string generated
    // at build time — no runtime class joining, no Tailwind scanning required.
    return buttonRecipe({
      buttonType: this.buttonType() ?? "secondary",
      size: this.size() ?? "default",
      // Vanilla-extract uses string keys for boolean-ish variants
      block: this.block() ? "full" : "inline",
      showDisabledStyles: this.showDisabledStyles() || this.disabled() ? "shown" : "hidden",
    });
  }

  protected readonly disabledAttr = computed(() => {
    const disabled = this.disabled() != null && this.disabled() !== false;
    return disabled || this.loading();
  });

  protected readonly showDisabledStyles = computed(() => {
    return this.showLoadingStyle() || (this.disabledAttr() && this.loading() === false);
  });

  readonly buttonType = input<ButtonType>("secondary");
  readonly startIcon = input<BitwardenIcon | undefined>(undefined);
  readonly endIcon = input<BitwardenIcon | undefined>(undefined);
  readonly size = input<ButtonSize>("default");
  readonly block = input(false, { transform: booleanAttribute });
  readonly loading = model<boolean>(false);

  readonly startIconClasses = computed(() => ["bwi", this.startIcon()]);
  readonly endIconClasses = computed(() => ["bwi", this.endIcon()]);

  // Exposed to the template so it can reference vanilla-extract class names
  // without importing them directly (Angular templates can't import modules).
  protected readonly styles = buttonInner;

  protected readonly contentClasses = computed(() =>
    buttonContentRecipe({ loading: this.showLoadingStyle() ? "shown" : "hidden" }),
  );

  protected readonly showLoadingStyle = toSignal(
    toObservable(this.loading).pipe(debounce((isLoading) => interval(isLoading ? 75 : 0))),
  );

  readonly disabled = model<boolean>(false);
  private el = inject(ElementRef<HTMLButtonElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabledAttr);
  }
}
