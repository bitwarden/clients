import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { catchError, combineLatest, from, map, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule, DialogRef, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessRuleSdkService, AccessRuleView } from "..";

import { accessRuleSummaryKeys, rulesGoverningCollection } from "./access-rule-summary";

/**
 * Names the privileged-access rule governing a collection, inside the collection edit dialog.
 *
 * Someone editing who can reach a collection needs to know a rule may already be gating its items,
 * or the member list looks like the whole story. Informational, not a gate — so a failed read hides
 * the callout rather than blocking the dialog, and the flag being off skips the read entirely.
 *
 * Bound to `COLLECTION_ACCESS_RULE_CALLOUT` in `provide-pam.ts`; the host passes `organizationId` and
 * `collectionId` and knows nothing else about PAM.
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

  private readonly accessRuleSdkService = inject(AccessRuleSdkService);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  /**
   * Optional: the callout is normally inside the collection dialog and closes it on navigate, but it
   * also renders standalone (e.g. a story), where there is no dialog to close.
   */
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
        return from(this.accessRuleSdkService.listAccessRules(organizationId)).pipe(
          map((rules) => rulesGoverningCollection(rules, collectionId)),
          catchError((error: unknown) => {
            this.logService.error(error);
            return of<AccessRuleView[]>([]);
          }),
        );
      }),
    ),
    { initialValue: [] as AccessRuleView[] },
  );

  /**
   * Every enabled rule governing this collection, not just the first. A collection can be governed by
   * more than one, and naming only one would understate the gating an administrator is about to
   * change access to.
   */
  protected readonly governingRules = this.rules;

  /** The conditions a rule enforces, as one translated line. */
  protected summaryFor(rule: AccessRuleView): string {
    return accessRuleSummaryKeys(rule)
      .map((key) => this.i18nService.t(key))
      .join(" + ");
  }

  /**
   * Close the host dialog when following the link to the rule. Leaving it open would strand a modal
   * over the page just navigated to.
   */
  protected closeDialog(): void {
    void this.dialogRef?.close();
  }
}
