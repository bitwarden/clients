import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendDecryptionService } from "@bitwarden/common/tools/send/services/send-decryption.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { AuthType } from "@bitwarden/common/tools/send/types/auth-type";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, ToastService } from "@bitwarden/components";

import { SendPolicyService } from "../../services/send-policy.service";
import { SendFormConfig } from "../abstractions/send-form-config.service";

import { DefaultSendFormService } from "./default-send-form.service";

describe("DefaultSendFormService", () => {
  let service: DefaultSendFormService;
  let sendApiService: MockProxy<SendApiService>;
  let sendDecryptionService: MockProxy<SendDecryptionService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let sendService: MockProxy<SendService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    sendApiService = mock<SendApiService>();
    sendDecryptionService = mock<SendDecryptionService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    sendService = mock<SendService>();
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      providers: [
        DefaultSendFormService,
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-id" }) } },
        { provide: SendApiService, useValue: sendApiService },
        { provide: SendService, useValue: sendService },
        { provide: I18nService, useValue: i18nService },
        {
          provide: SendPolicyService,
          useValue: { whoCanAccess$: of(WhoCanAccessType.Any), disableHideEmail$: of(false) },
        },
        { provide: SendDecryptionService, useValue: sendDecryptionService },
      ],
    }).compileComponents();

    service = TestBed.inject(DefaultSendFormService);
    await service.initializeSendForm({
      mode: "add",
      sendType: SendType.File,
      areSendsAllowed: true,
    } as SendFormConfig);
  });

  describe("submitSendForm", () => {
    // Regression guard for PM-42963: cancelling the Send dialog used to just close it, leaving
    // whatever the in-flight upload produced (even a corrupted file) as a permanent send, since
    // nothing threw for the existing rollback (on a thrown upload error) to react to.
    it("resolves to undefined without throwing when aborted mid-submission, instead of surfacing an error", async () => {
      sendApiService.saveView.mockImplementation(async (_view, _file, _password, signal) => {
        service.abortPendingSubmission();
        expect(signal?.aborted).toBe(true);
        throw new DOMException("Send creation was cancelled", "AbortError");
      });

      const result = await service.submitSendForm();

      expect(result).toBeUndefined();
    });

    it("surfaces non-abort errors from the API service", async () => {
      sendApiService.saveView.mockRejectedValue(new Error("network error"));

      await expect(service.submitSendForm()).rejects.toThrow("network error");
    });

    it("passes an unaborted signal through to the API service on a normal submission", async () => {
      const send = new Send();
      sendApiService.saveView.mockResolvedValue(send);
      sendDecryptionService.decryptSend.mockResolvedValue(new SendView());

      await service.submitSendForm();

      const signal = sendApiService.saveView.mock.calls[0][3];
      expect(signal?.aborted).toBe(false);
    });
  });

  describe("removeSendAuth", () => {
    async function editSendWithAuthType(authType: AuthType | null) {
      const originalSendView = new SendView();
      originalSendView.id = "send-id";
      // Legacy Sends can have a null authType even though the field isn't typed as nullable.
      originalSendView.authType = authType as AuthType;
      sendDecryptionService.decryptSend.mockResolvedValue(originalSendView);
      sendService.get$.mockReturnValue(of(new Send()));

      await service.initializeSendForm({
        mode: "edit",
        sendType: SendType.Text,
        areSendsAllowed: true,
        originalSend: new Send(),
      } as SendFormConfig);
    }

    it.each([
      [
        "password",
        AuthType.Password,
        "removePassword",
        "removeSendPasswordConfirmation",
        "removedPassword",
      ],
      [
        "email verification",
        AuthType.Email,
        "removeEmailVerification",
        "removeSendEmailVerificationConfirmation",
        "removedEmailVerification",
      ],
      ["unknown", null, "removeAuth", "removeAuthConfirmation", "removedAuth"],
    ])(
      "uses %s-specific dialog and toast text",
      async (_, authType, title, content, removedMessage) => {
        await editSendWithAuthType(authType);
        dialogService.openSimpleDialog.mockResolvedValue(true);

        const result = await service.removeSendAuth();

        expect(result).toBe(true);
        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({ title: { key: title }, content: { key: content } }),
        );
        expect(sendApiService.removeAuth).toHaveBeenCalledWith("send-id");
        expect(toastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "success", message: removedMessage }),
        );
      },
    );

    it("does not remove authentication when the user cancels", async () => {
      await editSendWithAuthType(AuthType.Email);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.removeSendAuth();

      expect(result).toBe(false);
      expect(sendApiService.removeAuth).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("abortPendingSubmission", () => {
    it("is a no-op when no submission is in flight", () => {
      expect(() => service.abortPendingSubmission()).not.toThrow();
    });
  });
});
