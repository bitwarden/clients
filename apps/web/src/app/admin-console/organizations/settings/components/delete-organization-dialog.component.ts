import { DIALOG_DATA, DialogConfig, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormControl, Validators } from "@angular/forms";
import { combineLatest, Subject, takeUntil } from "rxjs";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Verification } from "@bitwarden/common/types/verification";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { UserVerificationModule } from "../../../../auth/shared/components/user-verification";
import { SharedModule } from "../../../../shared/shared.module";

class CountBasedLocalizationKey {
  singular: string;
  plural: string;

  getKey(count: number) {
    return count == 1 ? this.singular : this.plural;
  }

  constructor(singular: string, plural: string) {
    this.singular = singular;
    this.plural = plural;
  }
}

class OrganizationContentSummaryItem {
  count: number;

  get localizationKey(): string {
    return this.localizationKeyOptions.getKey(this.count);
  }

  private localizationKeyOptions: CountBasedLocalizationKey;

  constructor(count: number, localizationKeyOptions: CountBasedLocalizationKey) {
    this.count = count;
    this.localizationKeyOptions = localizationKeyOptions;
  }
}

class OrganizationContentSummary {
  totalItemCount = 0;
  itemCountByType: OrganizationContentSummaryItem[] = [];
}

export interface DeleteOrganizationDialogParams {
  organizationId: string;

  requestType: "InvalidFamiliesForEnterprise" | "RegularDelete";
}

export enum DeleteOrganizationDialogResult {
  Deleted = "deleted",
  Canceled = "canceled",
}

@Component({
  selector: "app-delete-organization",
  standalone: true,
  imports: [SharedModule, UserVerificationModule],
  templateUrl: "delete-organization-dialog.component.html",
})
export class DeleteOrganizationDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loaded: boolean;
  deleteOrganizationRequestType: "InvalidFamiliesForEnterprise" | "RegularDelete" = "RegularDelete";
  organization: Organization;
  organizationContentSummary: OrganizationContentSummary = new OrganizationContentSummary();
  secret: Verification;

  protected formGroup = this.formBuilder.group({
    secret: new FormControl<Verification>(null, [Validators.required]),
  });
  formPromise: Promise<void>;

  constructor(
    @Inject(DIALOG_DATA) private params: DeleteOrganizationDialogParams,
    private dialogRef: DialogRef<DeleteOrganizationDialogResult>,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private userVerificationService: UserVerificationService,
    private cipherService: CipherService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit(): Promise<void> {
    this.deleteOrganizationRequestType = this.params.requestType;

    combineLatest([
      this.organizationService.get$(this.params.organizationId),
      this.cipherService.getAllFromApiForOrganization(this.params.organizationId),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([organization, ciphers]) => {
        this.organization = organization;
        this.organizationContentSummary = this.buildOrganizationContentSummary(ciphers);
        this.loaded = true;
      });
  }

  protected submit = async () => {
    await this.userVerificationService
      .buildRequest(this.formGroup.value.secret)
      .then((request) => this.organizationApiService.delete(this.organization.id, request));

    this.platformUtilsService.showToast(
      "success",
      this.i18nService.t("organizationDeleted"),
      this.i18nService.t("organizationDeletedDesc")
    );
    this.dialogRef.close(DeleteOrganizationDialogResult.Deleted);
  };

  private buildOrganizationContentSummary(ciphers: CipherView[]): OrganizationContentSummary {
    const organizationContentSummary = new OrganizationContentSummary();
    const organizationItems = ciphers.filter((item) => item.deletedDate == null);

    if (organizationItems.length < 1) {
      return organizationContentSummary;
    }

    organizationContentSummary.totalItemCount = organizationItems.length;
    for (const cipherType of Utils.iterateEnum(CipherType)) {
      const count = this.getOrganizationItemCountByType(organizationItems, cipherType);
      if (count > 0) {
        organizationContentSummary.itemCountByType.push(
          new OrganizationContentSummaryItem(
            count,
            this.getOrganizationItemLocalizationKeysByType(CipherType[cipherType])
          )
        );
      }
    }

    return organizationContentSummary;
  }

  private getOrganizationItemCountByType(items: CipherView[], type: CipherType) {
    return items.filter((item) => item.type == type).length;
  }

  private getOrganizationItemLocalizationKeysByType(type: string): CountBasedLocalizationKey {
    return new CountBasedLocalizationKey(`type${type}`, `type${type}Plural`);
  }
}

/**
 * Strongly typed helper to open a Delete Organization dialog
 * @param dialogService Instance of the dialog service that will be used to open the dialog
 * @param config Configuration for the dialog
 */
export function openDeleteOrganizationDialog(
  dialogService: DialogServiceAbstraction,
  config: DialogConfig<DeleteOrganizationDialogParams>
) {
  return dialogService.open<DeleteOrganizationDialogResult, DeleteOrganizationDialogParams>(
    DeleteOrganizationDialogComponent,
    config
  );
}
