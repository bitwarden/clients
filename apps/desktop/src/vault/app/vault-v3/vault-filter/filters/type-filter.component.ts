import { CommonModule } from "@angular/common";
import { Component, input, inject } from "@angular/core";
import { combineLatest, map, shareReplay } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultFilter, CipherTypeFilter } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-type-filter",
  templateUrl: "type-filter.component.html",
  imports: [CommonModule, A11yTitleDirective, NavigationModule, I18nPipe],
})
export class TypeFilterComponent {
  private restrictedItemTypesService: RestrictedItemTypesService = inject(
    RestrictedItemTypesService,
  );
  private configService: ConfigService = inject(ConfigService);

  protected readonly cipherTypes = input.required<TreeNode<CipherTypeFilter>>();
  protected readonly activeFilter = input<VaultFilter>();

  protected applyTypeFilter(event: Event, cipherType: TreeNode<CipherTypeFilter>) {
    event.stopPropagation();
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCipherTypeNode = cipherType;
    }
  }

  protected applyAllItemsFilter(event: Event) {
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCipherTypeNode = this.cipherTypes();
    }
  }

  protected typeFilters$ = combineLatest([
    this.restrictedItemTypesService.restricted$,
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
  ]).pipe(
    map(([restrictedItemTypes, canCreateBankAccount]) =>
      // Filter out restricted item types and feature-flagged types from the typeFilters array
      this.cipherTypes().children.filter((type) => {
        if (!canCreateBankAccount && type.node.type === CipherType.BankAccount) {
          return false;
        }
        return !restrictedItemTypes.some(
          (restrictedType) =>
            restrictedType.allowViewOrgIds.length === 0 &&
            restrictedType.cipherType === type.node.type,
        );
      }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
