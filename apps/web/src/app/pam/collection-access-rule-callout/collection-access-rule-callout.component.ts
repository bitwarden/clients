import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { catchError, combineLatest, from, map, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule, LinkModule } from "@bitwarden/components";
import { AccessRuleResponse, PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * PAM slot for the collection edit dialog. Given the collection being edited,
 * surfaces a callout naming the enabled access rule(s) that govern it, with a
 * link to manage them. Renders nothing when the PAM feature flag is off, the
 * dialog is creating a new collection (no `collectionId`), or no enabled rule
 * targets the collection — so the host dialog can mount it unconditionally with
 * a single tag and carry no PAM-specific logic.
 */
@Component({
  selector: "pam-collection-access-rule-callout",
  templateUrl: "./collection-access-rule-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CalloutModule, LinkModule, I18nPipe],
})
export class CollectionAccessRuleCalloutComponent {
  readonly organizationId = input<OrganizationId | undefined>(undefined);
  readonly collectionId = input<CollectionId | undefined>(undefined);

  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);
  private readonly logService = inject(LogService);

  /**
   * Enabled access rules targeting this collection. Empty whenever the feature
   * flag is off or either id is missing, so the template renders nothing and no
   * needless `listAccessRules` call is made. A failed fetch degrades to empty —
   * the callout is informational, not a gate, so a transient error just hides it.
   */
  protected readonly rules = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      toObservable(this.organizationId),
      toObservable(this.collectionId),
    ]).pipe(
      switchMap(([enabled, organizationId, collectionId]) => {
        if (!enabled || !organizationId || !collectionId) {
          return of<AccessRuleResponse[]>([]);
        }
        return from(this.pamApiService.listAccessRules(organizationId)).pipe(
          map((response) =>
            response.data.filter((rule) => rule.enabled && rule.collections.includes(collectionId)),
          ),
          catchError((e: unknown) => {
            this.logService.error(e);
            return of<AccessRuleResponse[]>([]);
          }),
        );
      }),
    ),
    { initialValue: [] as AccessRuleResponse[] },
  );
}
