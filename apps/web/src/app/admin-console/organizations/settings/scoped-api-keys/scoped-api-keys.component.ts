import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  from,
  lastValueFrom,
  map,
  Observable,
  of,
  switchMap,
} from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationScopedApiKeyResponse } from "@bitwarden/common/admin-console/models/response/organization-scoped-api-key.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../../shared";

import { ScopedApiKeyCreateDialogComponent } from "./scoped-api-key-create-dialog.component";
import { ScopedApiKeyScopeGroups } from "./scoped-api-key-scopes";
import { ScopedApiKeySecretDialogComponent } from "./scoped-api-key-secret-dialog.component";

type ScopedApiKeyRow = OrganizationScopedApiKeyResponse & {
  scopeLabels: string[];
  expired: boolean;
};

@Component({
  selector: "app-org-scoped-api-keys",
  templateUrl: "scoped-api-keys.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class ScopedApiKeysComponent {
  readonly organizationId = input.required<string>();

  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly configService = inject(ConfigService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly validationService = inject(ValidationService);

  private readonly enabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.ScopedOrganizationApiKeys,
  );
  private readonly reload$ = new BehaviorSubject<void>(undefined);

  protected readonly enabled = toSignal(this.enabled$, { initialValue: false });

  protected readonly keys = toSignal(
    combineLatest([toObservable(this.organizationId), this.enabled$, this.reload$]).pipe(
      switchMap(([organizationId, enabled]) =>
        enabled ? this.loadKeys(organizationId) : of(undefined),
      ),
    ),
  );

  protected readonly create = async () => {
    const created = await lastValueFrom(
      ScopedApiKeyCreateDialogComponent.open(this.dialogService, {
        data: { organizationId: this.organizationId() },
      }).closed,
    );
    if (created == null) {
      return;
    }

    this.reload$.next();
    await lastValueFrom(
      ScopedApiKeySecretDialogComponent.open(this.dialogService, {
        data: {
          name: created.name,
          clientId: created.clientId,
          clientSecret: created.clientSecret,
          scope: created.scopes.join(" "),
        },
      }).closed,
    );
  };

  protected async revoke(key: ScopedApiKeyRow) {
    const revoked = await this.dialogService.openSimpleDialog({
      title: { key: "revokeScopedApiKey" },
      content: { key: "revokeScopedApiKeyConfirmation", placeholders: [key.name] },
      acceptButtonText: { key: "revoke" },
      type: "warning",
      acceptAction: () =>
        this.organizationApiService.revokeScopedApiKey(this.organizationId(), key.id),
    });
    if (!revoked) {
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("scopedApiKeyRevoked"),
    });
    this.reload$.next();
  }

  private loadKeys(organizationId: string): Observable<ScopedApiKeyRow[]> {
    return from(this.organizationApiService.getScopedApiKeys(organizationId)).pipe(
      map((response) => response.data.map((key) => this.toRow(key))),
      catchError((e: unknown) => {
        this.validationService.showError(e);
        return of([]);
      }),
    );
  }

  private toRow(key: OrganizationScopedApiKeyResponse): ScopedApiKeyRow {
    const scopeLabels = key.scopes.map((value) => {
      for (const group of ScopedApiKeyScopeGroups) {
        const scope = group.scopes.find((s) => s.value === value);
        if (scope != null) {
          return this.i18nService.t(
            "scopedApiKeyScopeLabel",
            this.i18nService.t(group.labelKey),
            this.i18nService.t(scope.labelKey),
          );
        }
      }
      return value;
    });
    const expired = key.expireAt != null && new Date(key.expireAt).getTime() <= Date.now();
    return Object.assign(key, { scopeLabels, expired });
  }
}
