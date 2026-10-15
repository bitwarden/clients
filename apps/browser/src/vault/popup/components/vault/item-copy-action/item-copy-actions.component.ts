import { AsyncPipe } from "@angular/common";
import { Component, computed, input, inject } from "@angular/core";

import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultCopyButtonsService, VaultItemCopyActionsComponent } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-item-copy-actions",
  templateUrl: "item-copy-actions.component.html",
  imports: [VaultItemCopyActionsComponent, AsyncPipe],
})
export class ItemCopyActionsComponent {
  protected showQuickCopyActions$ = inject(VaultCopyButtonsService).showQuickCopyActions$;

  readonly cipher = input.required<CipherViewLike>();

  /** A PAM-gated item without a lease has nothing to copy. */
  protected readonly partial = computed(() => CipherViewLikeUtils.isPartial(this.cipher()));
}
