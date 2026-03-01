import {
  DestroyRef,
  Directive,
  inject,
  OnInit,
  TemplateRef,
  ViewContainerRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";

/**
 * Only shows the element if the user has premium.
 */
@Directive({
  selector: "[appPremium]",
})
export class PremiumDirective implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

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
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((premium: boolean) => {
        if (premium) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
          this.viewContainer.clear();
        }
      });
  }
}
