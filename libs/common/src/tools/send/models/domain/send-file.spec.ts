import { of } from "rxjs";

import mock from "@bitwarden/common/platform/spec/mock-deep";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { makeSymmetricCryptoKey, mockContainerService, mockEnc } from "../../../../../spec";
import { EncryptService } from "../../../../key-management/crypto/abstractions/encrypt.service";
import { ContainerService } from "../../../../platform/services/container.service";
import { SendFileData } from "../data/send-file.data";

import { SendFile } from "./send-file";

describe("SendFile", () => {
  let data: SendFileData;

  beforeEach(() => {
    data = {
      id: "id",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: "encFileName",
    };
  });

  it("Convert from empty", () => {
    const data = new SendFileData();
    const sendFile = new SendFile(data);

    expect(sendFile).toEqual({
      fileName: null,
      id: null,
      size: undefined,
      sizeName: null,
    });
  });

  it("Convert", () => {
    const sendFile = new SendFile(data);

    expect(sendFile).toEqual({
      id: "id",
      size: "1100",
      sizeName: "1.1 KB",
      fileName: { encryptedString: "encFileName", encryptionType: 0 },
    });
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService.getKeyService().userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64)));
    containerService.getEncryptService()
      .decryptString.mockResolvedValue("fileName");

    const sendFile = new SendFile();
    sendFile.id = "id";
    sendFile.size = "1100";
    sendFile.sizeName = "1.1 KB";
    sendFile.fileName = mockEnc("fileName");

    const view = await sendFile.decrypt(null, null);

    expect(view).toEqual({
      fileName: "fileName",
      id: "id",
      size: "1100",
      sizeName: "1.1 KB",
    });
  });
});
