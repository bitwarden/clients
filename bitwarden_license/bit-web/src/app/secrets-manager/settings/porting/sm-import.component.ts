import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";

import {
  SecretsManagerImportErrorDialogComponent,
  SecretsManagerImportErrorDialogOperation,
} from "../dialog/sm-import-error-dialog.component";
import { SecretsManagerImportError } from "../models/error/sm-import-error";
import { SecretsManagerPortingApiService } from "../services/sm-porting-api.service";

@Component({
  selector: "sm-import",
  templateUrl: "./sm-import.component.html",
})
export class SecretsManagerImportComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  protected orgId: string = null;
  protected selectedFile: File;
  protected formGroup = new FormGroup({
    pastedContents: new FormControl(""),
  });

  constructor(
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
    private platformUtilsService: PlatformUtilsService,
    protected fileDownloadService: FileDownloadService,
    private logService: LogService,
    private secretsManagerPortingApiService: SecretsManagerPortingApiService,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.orgId = params.organizationId;
    });
  }

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    const fileElement = document.getElementById("file") as HTMLInputElement;
    const importContents = await this.getImportContents(
      fileElement,
      this.formGroup.get("pastedContents").value.trim()
    );

    if (importContents == null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile")
      );
      return;
    }

    try {
      const error = await this.secretsManagerPortingApiService.import(this.orgId, importContents);

      if (error?.lines?.length > 0) {
        this.openImportErrorDialog(error);
        return;
      } else if (!Utils.isNullOrWhitespace(error?.message)) {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          error.message
        );
        return;
      } else if (error != null) {
        this.platformUtilsService.showToast(
          "error",
          this.i18nService.t("errorOccurred"),
          this.i18nService.t("errorReadingImportFile")
        );
        return;
      }

      this.platformUtilsService.showToast("success", null, this.i18nService.t("importSuccess"));
      this.clearForm();
    } catch (error) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("errorReadingImportFile")
      );
      this.logService.error(error);
    }
  };

  protected async getImportContents(
    fileElement: HTMLInputElement,
    pastedContents: string
  ): Promise<string> {
    const files = fileElement.files;

    if (
      (files == null || files.length === 0) &&
      (pastedContents == null || pastedContents === "")
    ) {
      return null;
    }

    let fileContents = pastedContents;
    if (files != null && files.length > 0) {
      try {
        const content = await this.getFileContents(files[0]);
        if (content != null) {
          fileContents = content;
        }
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (fileContents == null || fileContents === "") {
      return null;
    }

    return fileContents;
  }

  protected setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    const file = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
    this.selectedFile = file;
  }

  private clearForm() {
    (document.getElementById("file") as HTMLInputElement).value = "";
    this.selectedFile = null;
    this.formGroup.reset({
      pastedContents: "",
    });
  }

  private getFileContents(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file, "utf-8");
      reader.onload = (evt) => {
        resolve((evt.target as any).result);
      };
      reader.onerror = () => {
        reject();
      };
    });
  }

  private openImportErrorDialog(error: SecretsManagerImportError) {
    this.dialogService.open<unknown, SecretsManagerImportErrorDialogOperation>(
      SecretsManagerImportErrorDialogComponent,
      {
        data: {
          error: error,
        },
      }
    );
  }
}
