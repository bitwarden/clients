import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ReceiveFileUploadInput } from "@bitwarden/common/tools/receive/models/receive-file-upload-input";
import { ReceiveSharedData } from "@bitwarden/common/tools/receive/models/receive-shared-data";
import { ReceiveUrlData } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveFileService } from "@bitwarden/common/tools/receive/services/receive-file.service";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
import { ReceiveId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  FileUploadComponent,
  FormFieldModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-receive-upload",
  templateUrl: "receive-file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, FileUploadComponent, FormFieldModule, I18nPipe, LinkModule],
})
export class ReceiveFileUploadComponent implements OnInit {
  readonly multiple = true;
  readonly hasError = signal<boolean>(false);
  readonly maxFileSize = 500;
  readonly files = signal<File[]>([]);
  readonly receiveName = signal<string>("");
  readonly ownerEmail = signal<string>("");
  readonly showFileUploadResult = signal<boolean>(false);
  readonly filesUploaded = signal<number>(0);
  private readonly receiveId: ReceiveId;
  private readonly secretB64: string;
  private readonly sharedContentEncryptionKeyB64: string;
  private readonly publicKey = signal<Uint8Array>(new Uint8Array());
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly receiveService = inject(ReceiveService);
  private readonly receiveFileService = inject(ReceiveFileService);

  constructor(route: ActivatedRoute) {
    const params = route.snapshot.paramMap;
    this.receiveId = (params.get("receiveId") ?? "") as ReceiveId;
    this.secretB64 = params.get("secretB64") ?? "";
    this.sharedContentEncryptionKeyB64 = params.get("sharedContentEncryptionKeyB64") ?? "";
  }

  ngOnInit() {
    void this.loadContent();
  }

  private async loadContent() {
    try {
      const sharedData: ReceiveSharedData = await this.receiveService.getSharedData(
        this.getUrlData(),
      );
      this.receiveName.set(sharedData.name);
      this.publicKey.set(sharedData.publicKey);
      this.ownerEmail.set(sharedData.ownerEmail);
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("receiveLoadError"),
      });
    }
  }

  private getUrlData() {
    return {
      receiveId: this.receiveId,
      secretB64: this.secretB64,
      sharedContentEncryptionKeyB64: this.sharedContentEncryptionKeyB64,
    } as ReceiveUrlData;
  }

  removeFiles() {
    this.files.set([]);
  }

  uploadMoreFiles() {
    this.files.set([]);
    this.showFileUploadResult.set(false);
  }

  async uploadFiles() {
    let count = 0;
    for (const file of this.files()) {
      try {
        await this.uploadFile(file);
        count += 1;
      } catch (e) {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("fileUploadError", file.name),
        });
      }
    }
    this.filesUploaded.set(count);
    this.showFileUploadResult.set(true);
  }

  async uploadFile(file: File) {
    const publicKey = this.publicKey();
    if (!file || publicKey.byteLength == 0) {
      return;
    }
    const fileArrayBuff = await file.arrayBuffer();
    const input: ReceiveFileUploadInput = {
      unencryptedFileBuffer: fileArrayBuff,
      fileName: file.name,
      urlData: this.getUrlData(),
      publicKey: this.publicKey(),
    };
    await this.receiveFileService.uploadFile(input);
  }
}
