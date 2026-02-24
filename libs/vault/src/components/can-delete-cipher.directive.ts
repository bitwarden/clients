import { DestroyRef, Directive, inject, Input, TemplateRef, ViewContainerRef } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Only shows the element if the user can delete the cipher.
 */
@Directive({
  selector: "[appCanDeleteCipher]",
})
export class CanDeleteCipherDirective {
  private readonly destroyRef = inject(DestroyRef);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input("appCanDeleteCipher") set cipher(cipher: CipherViewLike) {
    this.viewContainer.clear();

    this.cipherAuthorizationService
      .canDeleteCipher$(cipher)
      .pipe(takeUntilDestroyed(this.destroyRef))
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
}
