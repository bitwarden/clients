import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessRuleId, AccessRuleSdkService } from "../../..";

/** A collection an admin can open to close the gap. */
type Gap = {
  id: CollectionId;
  /** Null when this admin's collection read didn't name it; the link still works. */
  name: string | null;
};

/**
 * Gaps in a stable, readable order.
 *
 * The server answers from an unordered read, so without this the links reshuffle between refreshes
 * for unchanged data. Sorted by name with the unnameable ones last, since a name is what an admin
 * scans for and an opaque entry is the least useful thing to lead with.
 */
function sortForDisplay(gaps: Gap[]): Gap[] {
  return [...gaps].sort((a, b) => {
    if (a.name == null || b.name == null) {
      return a.name == null ? (b.name == null ? 0 : 1) : -1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Warns, on the rule admin page, that this rule isn't actually protecting some credentials it
 * governs, and names the collections letting them through.
 *
 * Gating is a union: a cipher is withheld only when EVERY collection reaching it is governed by
 * an enabled rule, so one also sitting in an ordinary collection is a real bypass, not a bug.
 * Names collections, not ciphers, since a cipher name only decrypts from the caller's own vault,
 * which this admin lacks.
 *
 * Informational, never a gate — a failed read hides the callout rather than blocking the form.
 */
@Component({
  selector: "app-pam-rule-bypassable-ciphers-callout",
  templateUrl: "./rule-bypassable-ciphers-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CalloutModule, LinkModule, I18nPipe],
})
export class RuleBypassableCiphersCalloutComponent {
  readonly organizationId = input.required<OrganizationId>();
  /** Undefined while the rule is unsaved — there is nothing to assess yet. */
  readonly accessRuleId = input<AccessRuleId | undefined>(undefined);

  private readonly pamApi = inject(AccessRuleSdkService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly accountService = inject(AccountService);

  private readonly loaded = signal<Gap[]>([]);

  protected readonly gaps = this.loaded.asReadonly();

  /** True whenever there's something to warn about — a gap is only an exposed cipher's gap. */
  protected readonly warn = computed(() => this.gaps().length > 0);

  constructor() {
    // Deferred to after first render: starting during initial change detection leaves the zone
    // unstable and breaks `AutofocusDirective`'s rename-flow focus-and-select.
    //
    // A one-shot read is enough since both inputs come from the route snapshot and never change
    // while mounted.
    afterNextRender(() => void this.refresh());
  }

  private async refresh(): Promise<void> {
    const organizationId = this.organizationId();
    const accessRuleId = this.accessRuleId();
    if (organizationId == null || accessRuleId == null) {
      return;
    }

    try {
      const ungatedCollectionIds = await this.pamApi.listBypassGaps(organizationId, accessRuleId);
      if (ungatedCollectionIds.length === 0) {
        return;
      }

      this.loaded.set(await this.resolveGaps(organizationId, ungatedCollectionIds));
    } catch {
      // Already logged by the service. Staying hidden is right: this warns about a
      // misconfiguration, not something the page depends on.
    }
  }

  /**
   * Puts names to the gaps using the ADMIN collection read, not local vault state.
   *
   * `collectionAdminViews$` returns EVERY collection to a `ReadAllWithAccess` caller, so a gap
   * names itself even for an admin assigned to none of them. An unresolved name still renders as
   * a link, since the link is the actionable part.
   */
  private async resolveGaps(
    organizationId: OrganizationId,
    ungatedCollectionIds: readonly CollectionId[],
  ): Promise<Gap[]> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(organizationId, userId),
      );
      const nameById = new Map(collections.map((collection) => [collection.id, collection.name]));
      return sortForDisplay(
        ungatedCollectionIds.map((id): Gap => ({ id, name: nameById.get(id) ?? null })),
      );
    } catch {
      // Names are a nicety; links still work without them. Annotated since this file isn't strict-mode.
      return sortForDisplay(ungatedCollectionIds.map((id): Gap => ({ id, name: null })));
    }
  }
}
