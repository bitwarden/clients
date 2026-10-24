import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FileUploadService } from "@bitwarden/common/platform/abstractions/file-upload/file-upload.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService as SendApiServiceConcrete } from "@bitwarden/common/tools/send/services/send-api.service";
import { SendApiService as SendApiServiceAbstraction } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
import {
  InternalSendService,
  SendService,
} from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogCloseRef, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { SendFormConfig } from "../send-form/abstractions/send-form-config.service";
import { SendFormService } from "../send-form/abstractions/send-form.service";
import { DefaultSendFormService } from "../send-form/services/default-send-form.service";
import { SendPolicyService } from "../services/send-policy.service";

import {
  SendAddEditDialogComponent,
  SendItemDialogParams,
  SendItemDialogResult,
} from "./send-add-edit-dialog.component";

/**
 * A faithful stand-in for `CdkDialogRef`/`DrawerRef`, mirroring their real `close()` contract
 * (`libs/components/src/dialog/dialog-ref.ts`): run `closePredicate` first, and only actually
 * close if it resolves `true`. This lets the test drive "the user hit Escape/the X/Cancel" the
 * same way the real dialog does, without needing Angular's CDK overlay machinery.
 */
class FakeDialogRef implements DialogRef<SendItemDialogResult> {
  readonly isDrawer = false;
  disableClose: boolean | undefined = false;
  componentInstance: unknown = null;
  closePredicate?: (result?: SendItemDialogResult) => Promise<boolean>;
  closeCallCount = 0;
  private readonly closedSubject = new Subject<SendItemDialogResult | undefined>();
  readonly closed = this.closedSubject.asObservable();

  async close(result?: SendItemDialogResult): Promise<DialogCloseRef> {
    if (this.closePredicate) {
      const canClose = await this.closePredicate(result);
      if (!canClose) {
        return { closed: false };
      }
    }
    this.closeCallCount++;
    this.closedSubject.next(result);
    return { closed: true };
  }
}

describe("SendAddEditDialogComponent + DefaultSendFormService integration", () => {
  // Drives `dialogRef.close()` directly through the real `DefaultSendFormService`/`SendApiService`
  // stack — not just the Cancel button — to prove an in-flight file upload is aborted no matter
  // which close path (the header X, Escape, or Cancel) triggers it.
  // File creates go through the SDK, so the SDK client is the mocked boundary.

  let apiService: MockProxy<ApiService>;
  let sendService: MockProxy<InternalSendService>;
  let sendDecryptionService: MockProxy<SendDecryptionService>;
  let sendFormService: SendFormService;
  let sendsClient: { create_file_send: jest.Mock; upload_send_file: jest.Mock; delete: jest.Mock };
  let resolveUpload: () => void;

  const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    apiService = mock<ApiService>();
    // Read-back GET after the upload.
    apiService.send.mockResolvedValue({ id: "server-id" });
    sendService = mock<InternalSendService>();
    sendDecryptionService = mock<SendDecryptionService>();
    sendDecryptionService.decryptSend.mockResolvedValue(new SendView());

    sendsClient = {
      create_file_send: jest.fn().mockResolvedValue({
        send: { id: "server-id", accessId: "access-id" },
        url: null,
        fileUploadType: 0,
        fileId: "file-id",
        encryptedFileName: "2.encrypted-file-name",
        encryptedFileBuffer: new Uint8Array([1]),
      }),
      upload_send_file: jest.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        }),
      ),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const sdkService = mock<SdkService>();
    sdkService.userClient$.mockReturnValue(
      of({
        take: () => ({ value: { sends: () => sendsClient }, [Symbol.dispose]: jest.fn() }),
      } as any),
    );

    await TestBed.configureTestingModule({
      providers: [
        DefaultSendFormService,
        { provide: SendFormService, useExisting: DefaultSendFormService },
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-id" }) } },
        {
          provide: SendApiServiceAbstraction,
          useClass: SendApiServiceConcrete,
          deps: [
            ApiService,
            FileUploadService,
            InternalSendService,
            LogService,
            SdkService,
            AccountService,
            SendDecryptionService,
          ],
        },
        { provide: ApiService, useValue: apiService },
        { provide: FileUploadService, useValue: mock<FileUploadService>() },
        { provide: SdkService, useValue: sdkService },
        { provide: InternalSendService, useValue: sendService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: SendService, useValue: sendService },
        { provide: I18nService, useValue: mock<I18nService>() },
        {
          provide: SendPolicyService,
          useValue: { whoCanAccess$: of(WhoCanAccessType.Any), disableHideEmail$: of(false) },
        },
        { provide: SendDecryptionService, useValue: sendDecryptionService },
      ],
    }).compileComponents();

    sendFormService = TestBed.inject(SendFormService);
    await sendFormService.initializeSendForm({
      mode: "add",
      sendType: SendType.File,
      areSendsAllowed: true,
    } as SendFormConfig);
    // Normally set by child forms not rendered here; the SDK requires a deletion date.
    sendFormService.patchSend((view) =>
      Object.assign(view, {
        name: "a-file",
        deletionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );
    // jsdom's `File` lacks `arrayBuffer()`.
    sendFormService.setFile({
      name: "notes.txt",
      size: 5,
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5]).buffer),
    } as unknown as File);
  });

  const createDialog = (dialogRef: FakeDialogRef) => {
    const params: SendItemDialogParams = {
      formConfig: { mode: "add", sendType: SendType.File, areSendsAllowed: true } as SendFormConfig,
    };
    // `viewChild()` field initializers require a real Angular injection context — `new` alone
    // isn't enough — but the constructor args themselves are still passed through directly,
    // exercising the exact same constructor logic (the closePredicate wrapping) the real DI
    // path would run.
    return TestBed.runInInjectionContext(
      () =>
        new SendAddEditDialogComponent(
          params,
          dialogRef,
          mock<I18nService>(),
          mock<SendApiServiceAbstraction>(),
          mock<ToastService>(),
          mock<DialogService>(),
          sendFormService,
          mock<SendPolicyService>(),
        ),
    );
  };

  it("rolls back an in-flight file send when the dialog is closed via the X/Escape path (dialogRef.close() directly, not the Cancel button)", async () => {
    const dialogRef = new FakeDialogRef();
    // No closePredicate wired at open-time, matching a dialog opened without one.
    createDialog(dialogRef);

    const submitPromise = sendFormService.submitSendForm();
    await flushMicrotasks();
    // The upload is in flight — the send was already created server-side.
    expect(sendsClient.upload_send_file).toHaveBeenCalledTimes(1);

    // Simulate the user hitting Escape or the header X — both call dialogRef.close() directly,
    // never SendAddEditDialogComponent.cancelEditSend().
    const closeResult = await dialogRef.close();
    expect(closeResult.closed).toBe(true);

    resolveUpload();
    await flushMicrotasks();

    await expect(submitPromise).resolves.toBeUndefined();
    expect(sendsClient.delete).toHaveBeenCalledWith("server-id");
  });

  it("does not close, and does not abort, when the wired closePredicate vetoes the close", async () => {
    const dialogRef = new FakeDialogRef();
    // Simulates promptForUnsavedEdits() resolving `false` — user chose "keep editing".
    dialogRef.closePredicate = async () => false;
    createDialog(dialogRef);

    const submitPromise = sendFormService.submitSendForm();
    await flushMicrotasks();

    const closeResult = await dialogRef.close();
    expect(closeResult.closed).toBe(false);
    expect(dialogRef.closeCallCount).toBe(0);

    // The submission must NOT have been aborted by the vetoed close attempt.
    resolveUpload();
    await flushMicrotasks();

    await expect(submitPromise).resolves.toBeInstanceOf(SendView);
    expect(sendsClient.delete).not.toHaveBeenCalled();
  });
});
