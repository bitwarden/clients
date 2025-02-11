import { Directive, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { of, Subject, switchMap, takeUntil } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
    private accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          account
            ? this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
            : of(false),
        ),
        takeUntil(this.directiveIsDestroyed$),
      )
      .subscribe((premium: boolean) => {
        if (premium) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
          this.viewContainer.clear();
        }
      });
  }

  ngOnDestroy() {
    this.directiveIsDestroyed$.next(true);
    this.directiveIsDestroyed$.complete();
  }
}
