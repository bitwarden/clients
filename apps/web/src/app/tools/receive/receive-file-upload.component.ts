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
  readonly fileName = signal<string>("");
  readonly showUploadFileButton = signal<boolean>(false);
  private readonly receiveId: string;
  private readonly secretB64: string;
  private readonly sharedContentEncryptionKeyB64: string;
  private readonly file = signal<File | null>(null);
  private readonly fileSelectorRef = viewChild<ElementRef<HTMLInputElement>>("fileSelector");
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  constructor(route: ActivatedRoute) {
    const params = route.snapshot.paramMap;
    this.receiveId = params.get("receiveId") ?? "";
    this.secretB64 = params.get("secretB64") ?? "";
    this.sharedContentEncryptionKeyB64 = params.get("sharedContentEncryptionKeyB64") ?? "";
  }

  ngOnInit() {
    void this.loadContent();
  }

  private loadContent() {
    // 1. Call api server with receive id and secret
    // 2. Update content on page (e.g. receive name + email of owner)
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
    if (!file) {
      return;
    }
    try {
      // const arrayBuff = await file.arrayBuffer();
      // 1. Encrypt file
      // 2. Call api server with enough info to obtain upload URL
      // 3. Upload file
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("fileReadError"),
      });
    }
  }
}
