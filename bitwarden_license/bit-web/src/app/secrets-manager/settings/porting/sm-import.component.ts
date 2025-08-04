// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  SecretsManagerImportErrorDialogComponent,
  SecretsManagerImportErrorDialogOperation,
} from "../dialog/sm-import-error-dialog.component";
import { SecretsManagerImportError } from "../models/error/sm-import-error";
import { SecretsManagerPortingApiService } from "../services/sm-porting-api.service";

@Component({
  selector: "sm-import",
  templateUrl: "./sm-import.component.html",
  standalone: false,
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
    private toastService: ToastService,
    protected fileDownloadService: FileDownloadService,
    private logService: LogService,
    private secretsManagerPortingApiService: SecretsManagerPortingApiService,
    private dialogService: DialogService,
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
      this.formGroup.get("pastedContents").value.trim(),
    );

    if (importContents == null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
      return;
    }

    try {
      await this.secretsManagerPortingApiService.import(this.orgId, importContents);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("importSuccess"),
      });
      this.clearForm();
    } catch (error: unknown) {
      if (error instanceof SecretsManagerImportError && error?.lines?.length > 0) {
        this.openImportErrorDialog(error);
      } else {
        let message;
        if (error instanceof Error && !Utils.isNullOrWhitespace(error?.message)) {
          message = error.message;
        } else {
          message = this.i18nService.t("errorReadingImportFile");
        }

        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message,
        });

        this.logService.error(error);
      }
    }
  };

  protected async getImportContents(
    fileElement: HTMLInputElement,
    pastedContents: string,
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
      },
    );
  }
}
