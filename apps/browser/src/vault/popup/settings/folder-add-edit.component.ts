import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { FolderAddEditComponent as BaseFolderAddEditComponent } from "@bitwarden/angular/vault/components/folder-add-edit.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-folder-add-edit",
  templateUrl: "folder-add-edit.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class FolderAddEditComponent extends BaseFolderAddEditComponent implements OnInit {
  constructor(
    folderService: FolderService,
    folderApiService: FolderApiServiceAbstraction,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private router: Router,
    private route: ActivatedRoute,
    logService: LogService,
    dialogService: DialogService,
    formBuilder: FormBuilder,
  ) {
    super(
      folderService,
      folderApiService,
      i18nService,
      platformUtilsService,
      logService,
      dialogService,
      formBuilder,
    );
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (params) => {
      if (params.folderId) {
        this.folderId = params.folderId;
      }
      await this.init();
    });
  }

  async submit(): Promise<boolean> {
    if (await super.submit()) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/folders"]);
      return true;
    }

    return false;
  }

  async delete(): Promise<boolean> {
    const confirmed = await super.delete();
    if (confirmed) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/folders"]);
    }
    return confirmed;
  }
}
