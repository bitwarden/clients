import { Directive, Input, OnDestroy, TemplateRef, ViewContainerRef } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Only shows the element if the user can delete the cipher.
 */
@Directive({
  selector: "[appCanDeleteCipher]",
})
export class CanDeleteCipherDirective implements OnDestroy {
  private destroy$ = new Subject<void>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input("appCanDeleteCipher") set cipher(cipher: CipherViewLike) {
    this.viewContainer.clear();

    this.cipherAuthorizationService
      .canDeleteCipher$(cipher)
      .pipe(takeUntil(this.destroy$))
      .subscribe((canDelete: boolean) => {
        if (canDelete) {
          this.viewContainer.createEmbeddedView(this.templateRef);
        } else {
          this.viewContainer.clear();
        }
      });
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private cipherAuthorizationService: CipherAuthorizationService,
  ) {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
