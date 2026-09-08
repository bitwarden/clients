import { mock, MockProxy } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { Send } from "../models/domain/send";
import { SendView } from "../models/view/send.view";

import { SendApiService } from "./send-api.service";
import { InternalSendService } from "./send.service.abstraction";

describe("SendApiService", () => {
  let apiService: MockProxy<ApiService>;
  let fileUploadService: MockProxy<FileUploadService>;
  let sendService: MockProxy<InternalSendService>;
  let service: SendApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    fileUploadService = mock<FileUploadService>();
    sendService = mock<InternalSendService>();
    service = new SendApiService(apiService, fileUploadService, sendService);
  });

  describe("saveView", () => {
    // Regression guard: callers (default-send-form.service.ts, the CLI send commands) used to
    // encrypt client-side and call `save` directly themselves; that sequencing now lives here so
    // the SDK path can take the plaintext instead. This locks in that the legacy path still does
    // exactly what callers used to do by hand.
    it("encrypts the view, then saves the result, forwarding the plaintext password to both steps", async () => {
      const view = new SendView();
      const file = new File(["hello"], "notes.txt");
      const send = new Send();
      const encBuffer = mock<EncArrayBuffer>();
      sendService.encrypt.mockResolvedValue([send, encBuffer]);
      const saveSpy = jest.spyOn(service, "save").mockResolvedValue(send);

      const result = await service.saveView(view, file, "hunter2");

      expect(sendService.encrypt).toHaveBeenCalledWith(view, file, "hunter2");
      expect(saveSpy).toHaveBeenCalledWith([send, encBuffer], "hunter2");
      expect(result).toBe(send);
    });

    it("forwards an undefined plaintext password unchanged, e.g. when preserving an existing password", async () => {
      const view = new SendView();
      const send = new Send();
      const encBuffer = mock<EncArrayBuffer>();
      sendService.encrypt.mockResolvedValue([send, encBuffer]);
      const saveSpy = jest.spyOn(service, "save").mockResolvedValue(send);

      await service.saveView(view, null, undefined);

      expect(sendService.encrypt).toHaveBeenCalledWith(view, null, undefined);
      expect(saveSpy).toHaveBeenCalledWith([send, encBuffer], undefined);
    });
  });
});
