import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { combineLatest, map, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule, DialogRef, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessRuleView } from "..";
import { GovernedCollectionsService } from "../services/governed-collections.service";

import { accessRuleSummaryKeys, rulesGoverningCollection } from "./access-rule-summary";

/**
 * Names the rule gating a collection inside its edit dialog, where the member list alone isn't the
 * whole story. A failed read hides the callout rather than blocking the dialog.
 */
@Component({
  selector: "app-pam-collection-access-rule-callout",
  templateUrl: "./collection-access-rule-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CalloutModule, LinkModule, I18nPipe],
})
export class CollectionAccessRuleCalloutComponent {
  readonly organizationId = input<OrganizationId | undefined>(undefined);
  readonly collectionId = input<CollectionId | undefined>(undefined);

  private readonly governedCollections = inject(GovernedCollectionsService);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  /** Optional, since a story renders the callout without a dialog. */
  private readonly dialogRef = inject(DialogRef, { optional: true });

  private readonly rules = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      toObservable(this.organizationId),
      toObservable(this.collectionId),
    ]).pipe(
      switchMap(([enabled, organizationId, collectionId]) => {
        if (!enabled || organizationId == null || collectionId == null) {
          return of<AccessRuleView[]>([]);
        }
        // The shared per-org cached read resolves a failure to no rules, hiding the callout.
        return this.governedCollections
          .rules$(organizationId)
          .pipe(map((rules) => rulesGoverningCollection(rules, collectionId)));
      }),
    ),
    { initialValue: [] as AccessRuleView[] },
  );

  protected readonly governingRules = this.rules;

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
