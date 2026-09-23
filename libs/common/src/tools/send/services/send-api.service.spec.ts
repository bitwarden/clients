import { mock, MockProxy } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { EncArrayBuffer } from "@bitwarden/legacy-crypto";

import { ApiService } from "../../../abstractions/api.service";
import { FileUploadService } from "../../../platform/abstractions/file-upload/file-upload.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { FileUploadType } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { Send } from "../models/domain/send";
import { SendView } from "../models/view/send.view";
import { SendType } from "../types/send-type";

import { SendApiService } from "./send-api.service";
import { InternalSendService } from "./send.service.abstraction";

describe("SendApiService", () => {
  const mockUserId = Utils.newGuid() as UserId;

  let apiService: MockProxy<ApiService>;
  let fileUploadService: MockProxy<FileUploadService>;
  let sendService: MockProxy<InternalSendService>;
  let logService: MockProxy<LogService>;
  let service: SendApiService;

  beforeEach(() => {
    apiService = mock<ApiService>();
    fileUploadService = mock<FileUploadService>();
    sendService = mock<InternalSendService>();
    logService = mock<LogService>();
    service = new SendApiService(apiService, fileUploadService, sendService, logService);
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

      const result = await service.saveView(view, file, "hunter2", undefined, mockUserId);

      expect(sendService.encrypt).toHaveBeenCalledWith(view, file, "hunter2");
      expect(saveSpy).toHaveBeenCalledWith([send, encBuffer], "hunter2", mockUserId, undefined);
      expect(result).toBe(send);
    });

    it("forwards an undefined plaintext password unchanged, e.g. when preserving an existing password", async () => {
      const view = new SendView();
      const send = new Send();
      const encBuffer = mock<EncArrayBuffer>();
      sendService.encrypt.mockResolvedValue([send, encBuffer]);
      const saveSpy = jest.spyOn(service, "save").mockResolvedValue(send);

      await service.saveView(view, null, undefined, undefined, mockUserId);

      expect(sendService.encrypt).toHaveBeenCalledWith(view, null, undefined);
      expect(saveSpy).toHaveBeenCalledWith([send, encBuffer], undefined, mockUserId, undefined);
    });

    it("forwards the abort signal to save", async () => {
      const view = new SendView();
      const send = new Send();
      const encBuffer = mock<EncArrayBuffer>();
      sendService.encrypt.mockResolvedValue([send, encBuffer]);
      const saveSpy = jest.spyOn(service, "save").mockResolvedValue(send);
      const controller = new AbortController();

      await service.saveView(view, null, undefined, controller.signal, mockUserId);

      expect(saveSpy).toHaveBeenCalledWith(
        [send, encBuffer],
        undefined,
        mockUserId,
        controller.signal,
      );
    });
  });

  describe("save", () => {
    // Regression guard for PM-42963: cancelling the Send dialog used to just close it, leaving
    // whatever the in-flight upload produced (even a corrupted file) as a permanent send, since
    // nothing threw for the existing rollback (on a thrown upload error) to react to.
    const fileSendData = (): [Send, EncArrayBuffer] => {
      const send = new Send();
      send.type = SendType.File;
      send.file = { fileName: "notes.txt" } as any;
      return [send, mock<EncArrayBuffer>()];
    };

    it("bails before doing any network work when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.save(fileSendData(), undefined, mockUserId, controller.signal),
      ).rejects.toMatchObject({ name: "AbortError" });

      expect(apiService.send).not.toHaveBeenCalled();
      expect(fileUploadService.upload).not.toHaveBeenCalled();
    });

    describe("file send creation, when the caller aborts after a successful upload", () => {
      // The signal must still be unaborted when `save()` starts — otherwise the early bail
      // added for PM-42963 would intercept it before the upload ever runs, which is a
      // different scenario (covered above). Aborting from inside the upload mock simulates
      // the user cancelling while the upload is genuinely in flight.
      let controller: AbortController;

      beforeEach(() => {
        controller = new AbortController();
        apiService.send.mockResolvedValueOnce({
          fileUploadType: FileUploadType.Direct,
          url: null,
          sendResponse: { id: "server-id", accessId: "access-id", file: { id: "file-id" } },
        });
        fileUploadService.upload.mockImplementation(async () => {
          controller.abort();
        });
      });

      it("rolls back the created send and throws an AbortError instead of returning it", async () => {
        await expect(
          service.save(fileSendData(), undefined, mockUserId, controller.signal),
        ).rejects.toMatchObject({ name: "AbortError" });

        expect(apiService.send).toHaveBeenCalledWith(
          "DELETE",
          "/sends/server-id",
          null,
          mockUserId,
          false,
        );
      });

      it("does not roll back or throw when the signal was never aborted", async () => {
        fileUploadService.upload.mockImplementation(async () => {
          // No abort — the upload just completes normally.
        });

        await expect(
          service.save(fileSendData(), undefined, mockUserId, controller.signal),
        ).resolves.toBeInstanceOf(Send);

        // Only the initial POST to create the send — no follow-up DELETE rollback call.
        expect(apiService.send).toHaveBeenCalledTimes(1);
      });

      it("still throws an AbortError, not the rollback's error, when the rollback itself fails", async () => {
        apiService.send.mockRejectedValueOnce(new Error("rollback failed"));

        await expect(
          service.save(fileSendData(), undefined, mockUserId, controller.signal),
        ).rejects.toMatchObject({ name: "AbortError" });

        expect(logService.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to roll back file send after a cancelled upload"),
        );
      });
    });
  });
});
