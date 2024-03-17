import { Directive, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

/**
 * Only shows the element if the user has premium.
 */
@Directive({
  selector: "[appPremium]",
})
export class PremiumDirective implements OnInit, OnDestroy {
  private directiveIsDestroyed$ = new Subject<boolean>();

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.billingAccountProfileStateService.hasPremiumFromAnySource$
      .pipe(takeUntil(this.directiveIsDestroyed$))
      .subscribe((premium: boolean) => {
        if (premium) {
          this.viewContainer.clear();
        } else {
          this.viewContainer.createEmbeddedView(this.templateRef);
        }
      });
  }

  ngOnDestroy() {
    this.directiveIsDestroyed$.next(true);
    this.directiveIsDestroyed$.complete();
  }
}
