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
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { DialogService, ToastService } from "@bitwarden/components";

import { SendPolicyService } from "../../services/send-policy.service";
import { SendFormConfig } from "../abstractions/send-form-config.service";

import { DefaultSendFormService } from "./default-send-form.service";

describe("DefaultSendFormService", () => {
  let service: DefaultSendFormService;
  let sendApiService: MockProxy<SendApiService>;
  let sendDecryptionService: MockProxy<SendDecryptionService>;

  beforeEach(async () => {
    sendApiService = mock<SendApiService>();
    sendDecryptionService = mock<SendDecryptionService>();

    await TestBed.configureTestingModule({
      providers: [
        DefaultSendFormService,
        { provide: FormBuilder, useValue: new FormBuilder() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-id" }) } },
        { provide: SendApiService, useValue: sendApiService },
        { provide: SendService, useValue: mock<SendService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
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

  describe("abortPendingSubmission", () => {
    it("is a no-op when no submission is in flight", () => {
      expect(() => service.abortPendingSubmission()).not.toThrow();
    });
  });
});
