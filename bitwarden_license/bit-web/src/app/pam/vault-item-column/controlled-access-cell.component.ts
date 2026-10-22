import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VaultRowLeaseBadgeComponent } from "../vault-row-lease-badge/vault-row-lease-badge.component";

/**
 * The Controlled access column's cell. A thin wrapper, because the shared row badge keeps a
 * nullable `cipher` for the legacy collection row, which `VaultItemColumn.component` does not
 * accept.
 */
@Component({
  selector: "app-pam-controlled-access-cell",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VaultRowLeaseBadgeComponent],
  template: `<app-pam-vault-row-lease-badge [cipher]="cipher()" />`,
})
export class ControlledAccessCellComponent {
  readonly cipher = input.required<CipherViewLike>();
}
