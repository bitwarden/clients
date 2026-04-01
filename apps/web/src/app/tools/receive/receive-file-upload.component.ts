import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  ElementRef,
  inject,
  signal,
  viewChild,
} from "@angular/core";
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
  FormFieldModule,
  SectionComponent,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-receive-upload",
  templateUrl: "receive-file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, FormFieldModule, I18nPipe, SectionComponent],
})
export class ReceiveFileUploadComponent implements OnInit {
  readonly receiveName = signal<string>("");
  readonly ownerEmail = signal<string>("");
  readonly fileName = signal<string>("");
  readonly showUploadFileButton = signal<boolean>(false);
  private readonly receiveId: ReceiveId;
  private readonly secretB64: string;
  private readonly sharedContentEncryptionKeyB64: string;
  private readonly file = signal<File | null>(null);
  private readonly publicKey = signal<Uint8Array>(new Uint8Array());
  private readonly fileSelectorRef = viewChild<ElementRef<HTMLInputElement>>("fileSelector");
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

  addFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    if (!this.isFileSizeValid(file)) {
      this.removeFile();
      return;
    }
    this.file.set(file);
    this.fileName.set(file.name);
    this.showUploadFileButton.set(true);
  }

  private isFileSizeValid(file: File) {
    const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
    if (file.size > MAX_SIZE_BYTES) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("maxFileSize"),
      });
      return false;
    }
    return true;
  }

  private getUrlData() {
    return {
      receiveId: this.receiveId,
      secretB64: this.secretB64,
      sharedContentEncryptionKeyB64: this.sharedContentEncryptionKeyB64,
    } as ReceiveUrlData;
  }

  removeFile() {
    this.file.set(null);
    this.fileName.set("");
    this.showUploadFileButton.set(false);
    const fileSelectorElem = this.fileSelectorRef()?.nativeElement;
    if (fileSelectorElem) {
      fileSelectorElem.value = "";
    }
  }

  async uploadFile() {
    const file = this.file();
    const publicKey = this.publicKey();
    if (!file || publicKey.byteLength == 0) {
      return;
    }
    try {
      const fileArrayBuff = await file.arrayBuffer();
      const input: ReceiveFileUploadInput = {
        unencryptedFileBuffer: fileArrayBuff,
        fileName: file.name,
        urlData: this.getUrlData(),
        publicKey: this.publicKey(),
      };
      await this.receiveFileService.uploadFile(input);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("fileUploadSuccess"),
      });
      this.removeFile();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("fileReadError"),
      });
    }
  }
}
