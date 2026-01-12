import { DestroyRef, Directive, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

/**
 * Hides the element if the user has premium.
 */
@Directive({
  selector: "[appNotPremium]",
  standalone: false,
})
export class NotPremiumDirective implements OnInit {
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private destroyRef: DestroyRef,
    private accountService: AccountService,
  ) {}

  async ngOnInit(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);

    if (!account) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      return;
    }

    this.billingAccountProfileStateService
      .hasPremiumFromAnySource$(account.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((premium) => {
        if (premium) {
          this.viewContainer.clear();
        } else {
          this.viewContainer.createEmbeddedView(this.templateRef);
        }
      });
  }
}
