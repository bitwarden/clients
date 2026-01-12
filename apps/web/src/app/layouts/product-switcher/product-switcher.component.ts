import { AfterViewInit, ChangeDetectorRef, Component, Input } from "@angular/core";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { IconButtonType } from "@bitwarden/components/src/icon-button/icon-button.component";

import { ProductSwitcherService } from "./shared/product-switcher.service";
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "product-switcher",
  templateUrl: "./product-switcher.component.html",
  standalone: false,
})
export class ProductSwitcherComponent implements AfterViewInit {
  /**
   * Passed to the product switcher's `bitIconButton`
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  buttonType: IconButtonType = "main";

  ngAfterViewInit() {
    /**
     * Resolves https://angular.io/errors/NG0100 [SM-403]
     *
     * Caused by `[bitMenuTriggerFor]="content?.menu"` in template
     */
    this.changeDetector.detectChanges();
  }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private productSwitcherService: ProductSwitcherService,
  ) {}

  protected readonly products$ = this.productSwitcherService.products$;
}
