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
  /** Null when this admin's collection read did not name it; the link still works. */
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
 * Warns, on the rule admin page, that this rule is not actually protecting some of the credentials
 * it governs — and names the collections letting them through.
 *
 * Gating is a union: a cipher is withheld only when EVERY collection it can be reached through is
 * governed by an enabled rule. So a credential sitting in both a governed collection and an ordinary
 * one is not protected at all — whoever can reach the ordinary collection reads it in full, no lease
 * required. That is a real bypass rather than a bug, and an admin who cannot see it has no reason to
 * doubt the rule they just wrote.
 *
 * Names the COLLECTIONS, not the affected ciphers, deliberately. A cipher name can only be decrypted
 * from the caller's own vault, and an admin outside the collection — precisely the admin being
 * warned — has none of those ciphers there, so a cipher list is blank for the person who needs it.
 * Collections resolve for any admin (see `resolveGaps`) and are what remediation acts on. An admin
 * who wants item-level detail follows the link.
 *
 * Informational, never a gate: a failed read hides the callout rather than blocking the form, the
 * same way `CollectionAccessRuleCalloutComponent` treats its own read. It renders nothing while the
 * rule is unsaved (no id yet), so the create page is quiet until there is a rule to assess.
 *
 * The determination is the server's — see `AccessRuleSdkService.listBypassGaps`. This component
 * decides only how to say it.
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

  /** True once there is something to warn about — a gap is only ever an exposed cipher's gap. */
  protected readonly warn = computed(() => this.gaps().length > 0);

  constructor() {
    // Deliberately deferred to after the host page's first render, rather than read reactively off
    // the inputs.
    //
    // Starting the read during initial change detection leaves Angular's zone unstable through the
    // form's first paint, and `AutofocusDirective` keys off exactly that: it focuses synchronously
    // when the zone is stable and defers to `onStable` when it is not. The deferred path loses the
    // rename flow's focus-and-select on the name field. Warning about someone else's
    // misconfiguration must not cost the page its focus behaviour.
    //
    // The guard for that lives in ANOTHER file — "selects the prefilled name so typing replaces it"
    // in `access-rule-edit.component.spec.ts`. If that test starts failing after a change here, this
    // is why.
    //
    // A one-shot read is also all this page needs: both inputs come from the route snapshot and
    // never change while it is mounted. If a future caller binds changing inputs, this needs an
    // effect — not a second call site, and not without re-checking the focus interaction above.
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
      // The service has already logged it. Staying hidden is the right failure here: this is a
      // warning about a misconfiguration, not something the page it sits on depends on.
    }
  }

  /**
   * Puts names to the gaps using the ADMIN collection read, not local vault state.
   *
   * That is what makes this half reliable: `collectionAdminViews$` goes to the organization-scoped
   * admin endpoint, which returns EVERY collection to a caller authorized for `ReadAllWithAccess`
   * (Admin/Owner — anyone who can reach this page). So a gap names itself even for an admin assigned
   * to none of these collections, exactly the case where a cipher name would resolve to nothing. A
   * gap whose name still cannot be resolved renders as a link anyway, since the link is the
   * actionable part.
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
      // Names are a nicety; the links still work without them.
      // Annotated, not inferred: this file is not on the strict list, and under the app build's
      // tsconfig (noImplicitAny without strictNullChecks) a bare `name: null` is an implicit `any`.
      return sortForDisplay(ungatedCollectionIds.map((id): Gap => ({ id, name: null })));
    }
  }
}
