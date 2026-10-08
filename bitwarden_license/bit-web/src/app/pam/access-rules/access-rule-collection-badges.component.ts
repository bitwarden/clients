import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { BadgeModule } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { resolveCollectionNames } from "..";

/**
 * One count badge for a rule's collections, with their names as its tooltip so the column stays
 * narrow.
 */
@Component({
  selector: "pam-access-rule-collection-badges",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeModule, I18nPipe],
  template: `
    @if (names().length === 0) {
      <span class="tw-text-muted">{{ "pamAccessRuleCollectionsNone" | i18n }}</span>
    } @else {
      <span bitBadge variant="primary" startIcon="bwi-collection-shared" [title]="tooltip()">{{
        label()
      }}</span>
    }
  `,
})
export class AccessRuleCollectionBadgesComponent {
  readonly collectionIds = input.required<CollectionId[]>();
  readonly collections = input.required<CollectionAdminView[]>();

  private readonly i18nService = inject(I18nService);

  protected readonly names = computed(() =>
    resolveCollectionNames(this.collectionIds().map(uuidAsString), this.collections()),
  );

  protected readonly label = computed(() => {
    const count = this.names().length;
    return count === 1
      ? this.i18nService.t("pamAccessRuleCollectionCountSingular")
      : this.i18nService.t("pamAccessRuleCollectionCount", count);
  });

  protected readonly tooltip = computed(() => this.names().join(", "));
}
