import { Directive, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

/**
 * Hides the element if the user has premium.
 */
@Directive({
  selector: "[appNotPremium]",
})
export class NotPremiumDirective implements OnInit {
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit(): Promise<void> {
    const premium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$,
    );

    if (premium) {
      this.viewContainer.clear();
    } else {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
