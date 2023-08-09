import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap, takeUntil } from "rxjs/operators";

import { DialogServiceAbstraction, SimpleDialogType } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction } from "@bitwarden/importer";

import { ImportComponent } from "../../../../tools/import-export/import.component";

@Component({
  selector: "app-org-import",
  templateUrl: "../../../../tools/import-export/import.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class OrganizationImportComponent extends ImportComponent {
  organization: Organization;

  protected get importBlockedByPolicy(): boolean {
    return false;
  }

  constructor(
    i18nService: I18nService,
    importService: ImportServiceAbstraction,
    router: Router,
    private route: ActivatedRoute,
    platformUtilsService: PlatformUtilsService,
    policyService: PolicyService,
    organizationService: OrganizationService,
    logService: LogService,
    modalService: ModalService,
    syncService: SyncService,
    dialogService: DialogServiceAbstraction,
    folderService: FolderService,
    collectionService: CollectionService,
    formBuilder: FormBuilder
  ) {
    super(
      i18nService,
      importService,
      router,
      platformUtilsService,
      policyService,
      logService,
      modalService,
      syncService,
      dialogService,
      folderService,
      collectionService,
      organizationService,
      formBuilder
    );
  }

  ngOnInit() {
    this.route.params
      .pipe(
        switchMap((params) => this.organizationService.get$(params.organizationId)),
        takeUntil(this.destroy$)
      )
      .subscribe((organization) => {
        this.organizationId = organization.id;
        this.organization = organization;
      });
    super.ngOnInit();
  }

  protected async onSuccessfulImport(): Promise<void> {
    if (canAccessVaultTab(this.organization)) {
      await this.router.navigate(["organizations", this.organizationId, "vault"]);
    } else {
      this.fileSelected = null;
    }
  }

  protected async performImport() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "warning" },
      content: { key: "importWarning", placeholders: [this.organization.name] },
      type: SimpleDialogType.WARNING,
    });

    if (!confirmed) {
      return;
    }
    await super.performImport();
  }
}
