import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  catchError,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  tap,
} from "rxjs";

import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderUpdateRequest } from "@bitwarden/common/admin-console/models/request/provider/provider-update.request";
import { ProviderResponse } from "@bitwarden/common/admin-console/models/response/provider/provider.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  AsyncActionsModule,
  AvatarComponent,
  ButtonModule,
  ContainerComponent,
  DialogService,
  FormFieldModule,
  SpinnerComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { DangerZoneComponent } from "@bitwarden/web-vault/app/auth/settings/account/danger-zone.component";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

@Component({
  selector: "provider-account",
  templateUrl: "account.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    HeaderModule,
    ContainerComponent,
    FormFieldModule,
    ButtonModule,
    AsyncActionsModule,
    AvatarComponent,
    DangerZoneComponent,
    SpinnerComponent,
    I18nPipe,
  ],
})
export class AccountComponent {
  private readonly apiService = inject(ApiService);
  private readonly i18nService = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly syncService = inject(SyncService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly providerApiService = inject(ProviderApiServiceAbstraction);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  protected readonly selfHosted = this.platformUtilsService.isSelfHost();
  protected readonly loading = signal(true);
  protected readonly provider = signal<ProviderResponse | undefined>(undefined);

  private readonly providerId$: Observable<string> = this.route.params.pipe(
    map((params): string => params.providerId),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  private readonly refresh$ = new Subject<void>();

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    providerName: [
      { value: "", disabled: this.selfHosted },
      [Validators.required, Validators.maxLength(50)],
    ],
    providerBillingEmail: [
      { value: "", disabled: this.selfHosted },
      [Validators.required, Validators.email, Validators.maxLength(256)],
    ],
  });

  constructor() {
    this.providerId$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap((providerId) =>
          this.refresh$.pipe(
            startWith(undefined),
            switchMap(() => this.loadProvider(providerId)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((provider) => {
        this.provider.set(provider);
        if (provider != null) {
          this.formGroup.patchValue({
            providerName: provider.name,
            providerBillingEmail: provider.billingEmail,
          });
        }
        this.loading.set(false);
      });
  }

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const providerId = await firstValueFrom(this.providerId$);
    const { providerName, providerBillingEmail } = this.formGroup.getRawValue();
    const request = new ProviderUpdateRequest({
      name: providerName,
      businessName: providerName,
      billingEmail: providerBillingEmail,
    });

    await this.providerApiService.putProvider(providerId, request);
    await this.syncService.fullSync(true);
    this.refresh$.next();
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("providerUpdated"),
    });
  };

  protected async deleteProvider(provider: ProviderResponse) {
    const providerClients = await this.apiService.getProviderClients(provider.id);
    if (providerClients.data.length > 0) {
      await this.dialogService.openSimpleDialog({
        title: { key: "deleteProviderName", placeholders: [provider.name] },
        content: { key: "deleteProviderWarningDescription", placeholders: [provider.name] },
        acceptButtonText: { key: "ok" },
        cancelButtonText: { key: "close" },
        type: "danger",
      });
      return;
    }

    const userVerified = await this.verifyUser();
    if (!userVerified) {
      return;
    }

    try {
      await this.providerApiService.deleteProvider(provider.id);
      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("providerDeleted"),
        message: this.i18nService.t("providerDeletedDesc"),
      });
    } catch (e) {
      this.logService.error(String(e));
    }
    await this.router.navigate(["/"]);
  }

  private loadProvider(providerId: string): Observable<ProviderResponse | undefined> {
    return from(this.providerApiService.getProvider(providerId)).pipe(
      catchError((e: unknown) => {
        this.logService.error(`Handled exception: ${String(e)}`);
        return of(undefined);
      }),
    );
  }

  private async verifyUser(): Promise<boolean> {
    const confirmDescription = "deleteProviderConfirmation";
    const result = await UserVerificationDialogComponent.open(this.dialogService, {
      title: "deleteProvider",
      bodyText: confirmDescription,
      confirmButtonOptions: {
        text: "deleteProvider",
        type: "danger",
      },
    });

    // Handle the result of the dialog based on user action and verification success
    if (result.userAction === "cancel") {
      // User cancelled the dialog
      return false;
    }

    // User confirmed the dialog so check verification success
    if (!result.verificationSuccess) {
      return false;
    }
    return true;
  }
}
