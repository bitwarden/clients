import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { distinctUntilChanged, map, Observable, of, switchMap } from "rxjs";

import { AccessRuleView } from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc/rxjs-operators";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule, DialogRef, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { CollectionAccessRuleCallout } from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/collection-dialog/collection-access-rule-callout.token";

import { GovernedCollectionsService } from "../services/governed-collections.service";

import { accessRuleSummaryKeys, rulesGoverningCollection } from "./access-rule-summary";

/** Structural, so this needn't import the host's collection model. */
type CalloutCollection = {
  id: CollectionId;
  organizationId: OrganizationId;
  hasEnabledAccessRule?: boolean;
};

/**
 * Flags a gated collection inside its edit dialog, where the member list alone isn't the whole
 * story. Whether the collection is gated comes from the server-derived `hasEnabledAccessRule`, like
 * the vault banner and the sidebar lock. A user who can manage access rules also sees each governing
 * rule, linked to its page. Everyone else, and a manager whose rule read fails or names no rule for
 * the collection, sees the sentence the banner and lock use.
 */
@Component({
  selector: "app-pam-collection-access-rule-callout",
  templateUrl: "./collection-access-rule-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CalloutModule, LinkModule, I18nPipe],
})
export class CollectionAccessRuleCalloutComponent implements CollectionAccessRuleCallout {
  readonly collection = input<CalloutCollection | undefined>(undefined);

  private readonly governedCollections = inject(GovernedCollectionsService);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  /** Optional, since a story renders the callout without a dialog. */
  private readonly dialogRef = inject(DialogRef, { optional: true });

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });

  private readonly gatedCollection = computed(() => {
    const collection = this.collection();
    return this.pamEnabled() && collection?.hasEnabledAccessRule === true ? collection : undefined;
  });

  /**
   * Undefined until known, so a manager's callout doesn't flash the generic sentence first. An
   * ungated collection is undefined too, since `gated()` turns true before this re-reads.
   */
  protected readonly governingRules = toSignal(
    toObservable(this.gatedCollection).pipe(
      switchMap((collection) =>
        collection == null ? of(undefined) : this.rulesShownFor$(collection),
      ),
    ),
    { initialValue: undefined },
  );

  protected readonly gated = computed(() => this.gatedCollection() != null);

  private rulesShownFor$({ id, organizationId }: CalloutCollection): Observable<AccessRuleView[]> {
    return this.canManageAccessRules$(organizationId).pipe(
      switchMap((canManage) =>
        canManage
          ? // The shared per-org cached read resolves a failure to no rules.
            this.governedCollections
              .rules$(organizationId)
              .pipe(map((rules) => rulesGoverningCollection(rules, id)))
          : of<AccessRuleView[]>([]),
      ),
    );
  }

  private canManageAccessRules$(organizationId: OrganizationId): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      getById(organizationId),
      map((organization) => organization?.canManageAccessRules === true),
      distinctUntilChanged(),
    );
  }

  protected summaryFor(rule: AccessRuleView): string {
    return accessRuleSummaryKeys(rule)
      .map((key) => this.i18nService.t(key))
      .join(" + ");
  }

  /** So the dialog isn't stranded over the rule page the link opens. */
  protected closeDialog(): void {
    void this.dialogRef?.close();
  }
}
