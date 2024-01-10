import { Component, OnInit } from "@angular/core";
import { UntypedFormBuilder } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { EventType } from "@bitwarden/common/enums";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";
import { VaultExportServiceAbstraction } from "@bitwarden/exporter/vault-export";

import { ExportComponent } from "../../../../tools/vault-export/export.component";

@Component({
  selector: "app-org-export",
  templateUrl: "../../../../tools/vault-export/export.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class OrganizationVaultExportComponent extends ExportComponent implements OnInit {
  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    exportService: VaultExportServiceAbstraction,
    eventCollectionService: EventCollectionService,
    private route: ActivatedRoute,
    policyService: PolicyService,
    logService: LogService,
    userVerificationService: UserVerificationService,
    formBuilder: UntypedFormBuilder,
    fileDownloadService: FileDownloadService,
    dialogService: DialogService,
    organizationService: OrganizationService,
    configService: ConfigServiceAbstraction,
  ) {
    super(
      i18nService,
      platformUtilsService,
      exportService,
      eventCollectionService,
      policyService,
      logService,
      userVerificationService,
      formBuilder,
      fileDownloadService,
      dialogService,
      organizationService,
      configService,
    );
  }

  protected get disabledByPolicy(): boolean {
    return false;
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.parent.params.subscribe(async (params) => {
      this.organizationId = params.organizationId;
    });
    await super.ngOnInit();
  }

  getExportData() {
    if (this.isFileEncryptedExport) {
      return this.exportService.getPasswordProtectedExport(this.filePassword, this.organizationId);
    } else {
      return this.exportService.getOrganizationExport(this.organizationId, this.format);
    }
  }

  getFileName() {
    return super.getFileName("org");
  }

  async collectEvent(): Promise<void> {
    await this.eventCollectionService.collect(
      EventType.Organization_ClientExportedVault,
      null,
      null,
      this.organizationId,
    );
  }
}
