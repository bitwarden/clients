import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  resource,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";

import { ActiveSendIcon, NoSendsIcon, Party } from "@bitwarden/assets/svg";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ReceiveFileUploadInput } from "@bitwarden/common/tools/receive/models/receive-file-upload-input";
import { ReceiveUrlData } from "@bitwarden/common/tools/receive/models/receive-url-data";
import { ReceiveFileService } from "@bitwarden/common/tools/receive/services/receive-file.service";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
import { ReceiveId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  FileUploadComponent,
  LinkModule,
  NoItemsModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-receive-upload",
  templateUrl: "receive-file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    FileUploadComponent,
    I18nPipe,
    LinkModule,
    NoItemsModule,
    ReactiveFormsModule,
  ],
})
export class ReceiveFileUploadComponent {
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly receiveService = inject(ReceiveService);
  private readonly receiveFileService = inject(ReceiveFileService);
  private readonly route = inject(ActivatedRoute);
  private readonly anonLayoutWrapperDataService = inject(AnonLayoutWrapperDataService);

  private readonly params = toSignal(this.route.paramMap);
  private readonly urlData = computed<ReceiveUrlData>(() => {
    const params = this.params();
    return {
      receiveId: (params?.get("receiveId") ?? "") as ReceiveId,
      secretB64: params?.get("secretB64") ?? "",
      sharedContentEncryptionKeyB64: params?.get("sharedContentEncryptionKeyB64") ?? "",
    };
  });

  protected readonly sharedData = resource({
    params: () => ({ urlData: this.urlData() }),
    loader: async ({ params: { urlData } }) => {
      try {
        return await this.receiveService.getSharedData(urlData);
      } catch (e) {
        this.logService.error(e);
        if (e instanceof ErrorResponse && e.statusCode === 404) {
          this.errorState.set("expired");
        } else {
          this.errorState.set("badRequest");
        }
        return null;
      }
    },
  });

  protected readonly form = new FormGroup({});
  protected readonly hasError = signal<boolean>(false);
  protected readonly errorState = signal<"expired" | "badRequest" | null>(null);
  protected readonly expiredIcon = NoSendsIcon;
  protected readonly files = signal<File[]>([]);

  protected readonly showFileUploadResult = signal<boolean>(false);
  protected readonly filesUploaded = signal<number>(0);

  protected removeFiles() {
    this.files.set([]);
  }

  protected uploadMoreFiles() {
    this.files.set([]);
    this.showFileUploadResult.set(false);
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({ pageIcon: ActiveSendIcon });
  }

  protected readonly uploadFiles = async () => {
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
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({ pageIcon: Party });
  };

  private async uploadFile(file: File) {
    const publicKey = this.sharedData.value()?.publicKey;
    if (!file || !publicKey || publicKey.byteLength == 0) {
      return;
    }
    const fileArrayBuff = await file.arrayBuffer();
    const input: ReceiveFileUploadInput = {
      unencryptedFileBuffer: fileArrayBuff,
      fileName: file.name,
      urlData: this.urlData(),
      publicKey,
    };
    await this.receiveFileService.uploadFile(input);
  }
}
