import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { BadgeListModule } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { resolveCollectionNames } from "..";

/** Collections shown before the rest collapse into a "+N more" badge. */
const MAX_VISIBLE_COLLECTIONS = 3;

/**
 * Renders the collections a rule governs as name badges, resolving the rule's collection
 * ids against the org's loaded collections. Shows a muted placeholder when the rule
 * targets none, and collapses long lists via `bit-badge-list`'s "+N more".
 */
@Component({
  selector: "pam-access-rule-collection-badges",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeListModule, I18nPipe],
  template: `
    @if (names().length === 0) {
      <span class="tw-text-muted">{{ "pamAccessRuleCollectionsNone" | i18n }}</span>
    } @else {
      <bit-badge-list [items]="names()" variant="primary" [maxItems]="maxItems" />
    }
  `,
})
export class AccessRuleCollectionBadgesComponent {
  readonly collectionIds = input.required<CollectionId[]>();
  readonly collections = input.required<CollectionAdminView[]>();

  protected readonly maxItems = MAX_VISIBLE_COLLECTIONS;
  protected readonly names = computed(() =>
    resolveCollectionNames(this.collectionIds().map(uuidAsString), this.collections()),
  );
}
