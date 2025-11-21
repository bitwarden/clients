import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import {
  FakeAccountService,
  FakeActiveUserState,
  FakeStateProvider,
  awaitAsync,
  mockAccountServiceWith,
} from "../../../../spec";
import { KeyGenerationService } from "../../../key-management/crypto";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "../../../platform/services/container.service";
import { SelfHostedEnvironment } from "../../../platform/services/default-environment.service";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { SendType } from "../enums/send-type";
import { SendFileApi } from "../models/api/send-file.api";
import { SendTextApi } from "../models/api/send-text.api";
import { SendFileData } from "../models/data/send-file.data";
import { SendTextData } from "../models/data/send-text.data";
import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

import { SEND_USER_DECRYPTED, SEND_USER_ENCRYPTED } from "./key-definitions";
import { SendStateProvider } from "./send-state.provider";
import { SendService } from "./send.service";
import {
  createSendData,
  testSend,
  testSendData,
  testSendViewData,
} from "./test-data/send-tests.data";

describe("SendService", () => {
  const keyService = mock<KeyService>();
  const i18nService = mock<I18nService>();
  const keyGenerationService = mock<KeyGenerationService>();
  const encryptService = mock<EncryptService>();
  const environmentService = mock<EnvironmentService>();

  let sendStateProvider: SendStateProvider;
  let sendService: SendService;

  let stateProvider: FakeStateProvider;
  let encryptedState: FakeActiveUserState<Record<string, SendData>>;
  let decryptedState: FakeActiveUserState<SendView[]>;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);
    sendStateProvider = new SendStateProvider(stateProvider);
    Object.defineProperty(environmentService, "environment$", {
      configurable: true,
      get: () => of(new SelfHostedEnvironment({ webVault: "https://example.com" })),
    });

    (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);

    accountService.activeAccountSubject.next({
      id: mockUserId,
      email: "email",
      emailVerified: false,
      name: "name",
    });

    // Initial encrypted state
    encryptedState = stateProvider.activeUser.getFake(SEND_USER_ENCRYPTED);
    encryptedState.nextState({
      "1": testSendData("1", "Test Send"),
    });
    // Initial decrypted state
    decryptedState = stateProvider.activeUser.getFake(SEND_USER_DECRYPTED);
    decryptedState.nextState([testSendViewData("1", "Test Send")]);

    sendService = new SendService(
      accountService,
      keyService,
      i18nService,
      keyGenerationService,
      sendStateProvider,
      encryptService,
    );
  });

  describe("get$", () => {
    it("exists", async () => {
      const result = await firstValueFrom(sendService.get$("1"));

      expect(result).toEqual(testSend("1", "Test Send"));
    });

    it("does not exist", async () => {
      const result = await firstValueFrom(sendService.get$("2"));

      expect(result).toBe(undefined);
    });

    it("updated observable", async () => {
      const singleSendObservable = sendService.get$("1");
      const result = await firstValueFrom(singleSendObservable);
      expect(result).toEqual(testSend("1", "Test Send"));

      await sendService.replace(
        {
          "1": testSendData("1", "Test Send Updated"),
        },
        mockUserId,
      );

      const result2 = await firstValueFrom(singleSendObservable);
      expect(result2).toEqual(testSend("1", "Test Send Updated"));
    });

    it("reports a change when name changes on a new send", async () => {
      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });
      const sendDataObject = testSendData("1", "Test Send 2");

      //it is immediately called when subscribed, we need to reset the value
      changed = false;
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("reports a change when notes changes on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      sendDataObject.notes = "New notes";
      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("reports a change when Text changes on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      sendDataObject.text.text = "new text";
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("reports a change when Text is set as null on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      sendDataObject.text = null;
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("Doesn't reports a change when File changes on a new send", async () => {
      const sendDataObject = createSendData({
        type: SendType.File,
        file: new SendFileData(new SendFileApi({ FileName: "name of file" })),
      }) as SendData;
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      sendDataObject.file = new SendFileData(new SendFileApi({ FileName: "updated name of file" }));
      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(false);
    });

    it("reports a change when key changes on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      sendDataObject.key = "newKey";
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("reports a change when revisionDate changes on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      sendDataObject.revisionDate = "2025-04-05";
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("reports a change when a property is set as null on a new send", async () => {
      const sendDataObject = createSendData() as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      sendDataObject.name = null;
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("does not reports a change when text's text is set as null on a new send and old send and reports a change then new send sets a text", async () => {
      const sendDataObject = createSendData({
        text: new SendTextData(new SendTextApi({ Text: null })),
      }) as SendData;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(false);

      sendDataObject.text.text = "Asdf";
      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });

    it("do not report a change when nothing changes on the observed send", async () => {
      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });

      const sendDataObject = testSendData("1", "Test Send");

      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      await sendService.replace(
        {
          "1": sendDataObject,
          "2": testSendData("3", "Test Send 3"),
        },
        mockUserId,
      );

      expect(changed).toEqual(false);
    });

    it("reports a change when the observed send is deleted", async () => {
      let changed = false;
      sendService.get$("1").subscribe(() => {
        changed = true;
      });
      //it is immediately called when subscribed, we need to reset the value
      changed = false;

      await sendService.replace(
        {
          "2": testSendData("2", "Test Send 2"),
        },
        mockUserId,
      );

      expect(changed).toEqual(true);
    });
  });

  it("getAll", async () => {
    const sends = await sendService.getAll();
    const send1 = sends[0];

    expect(sends).toHaveLength(1);
    expect(send1).toEqual(testSend("1", "Test Send"));
  });

  describe("getFromState", () => {
    it("exists", async () => {
      const result = await sendService.getFromState("1");

      expect(result).toEqual(testSend("1", "Test Send"));
    });
    it("does not exist", async () => {
      const result = await sendService.getFromState("2");

      expect(result).toBe(null);
    });
  });

  describe("getAllDecryptedFromState", () => {
    it("returns already decrypted sends in state", async () => {
      const sends = await sendService.getAllDecryptedFromState(mockUserId);

      expect(sends[0]).toMatchObject(testSendViewData("1", "Test Send"));
    });

    it("throws if no decrypted sends in state and there is no userKey", async () => {
      decryptedState.nextState(null);
      keyService.hasUserKey.mockResolvedValue(false);

      await expect(sendService.getAllDecryptedFromState(mockUserId)).rejects.toThrow(
        "No user key found.",
      );
    });
  });

  describe("getRotatedData", () => {
    const originalUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    const newUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
    let encryptedKey: EncString;

    beforeEach(() => {
      encryptService.decryptBytes.mockResolvedValue(new Uint8Array(16));
      encryptedKey = new EncString("Re-encrypted Send Key");
      encryptService.encryptBytes.mockResolvedValue(encryptedKey);
    });

    it("returns re-encrypted user sends", async () => {
      const result = await sendService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result).toMatchObject([{ id: "1", key: "Re-encrypted Send Key" }]);
    });

    it("returns empty array if there are no sends", async () => {
      await sendService.replace(null, mockUserId);

      await awaitAsync();

      const newUserKey = new SymmetricCryptoKey(new Uint8Array(32)) as UserKey;
      const result = await sendService.getRotatedData(originalUserKey, newUserKey, mockUserId);

      expect(result).toEqual([]);
    });

    it("throws if the original user key is null", async () => {
      await expect(sendService.getRotatedData(null, newUserKey, mockUserId)).rejects.toThrow(
        "Original user key is required for rotation.",
      );
    });

    it("throws if the new user key is null", async () => {
      await expect(sendService.getRotatedData(originalUserKey, null, mockUserId)).rejects.toThrow(
        "New user key is required for rotation.",
      );
    });
  });

  // InternalSendService

  it("upsert", async () => {
    await sendService.upsert(testSendData("2", "Test 2"));

    expect(await firstValueFrom(sendService.sends$)).toEqual([
      testSend("1", "Test Send"),
      testSend("2", "Test 2"),
    ]);
  });

  it("replace", async () => {
    await sendService.replace({ "2": testSendData("2", "test 2") }, mockUserId);

    expect(await firstValueFrom(sendService.sends$)).toEqual([testSend("2", "test 2")]);
  });

  describe("Delete", () => {
    it("Sends count should decrease after delete", async () => {
      const sendsBeforeDelete = await firstValueFrom(sendService.sends$);
      await sendService.delete(sendsBeforeDelete[0].id);

      const sendsAfterDelete = await firstValueFrom(sendService.sends$);
      expect(sendsAfterDelete.length).toBeLessThan(sendsBeforeDelete.length);
    });

    it("Intended send should be delete", async () => {
      const sendsBeforeDelete = await firstValueFrom(sendService.sends$);
      await sendService.delete(sendsBeforeDelete[0].id);
      const sendsAfterDelete = await firstValueFrom(sendService.sends$);
      expect(sendsAfterDelete[0]).not.toBe(sendsBeforeDelete[0]);
    });

    it("Deleting on an empty sends array should not throw", async () => {
      stateProvider.activeUser.getFake(SEND_USER_ENCRYPTED).nextState(null);
      await expect(sendService.delete("2")).resolves.not.toThrow();
    });

    it("Delete multiple sends", async () => {
      await sendService.upsert(testSendData("2", "send data 2"));
      await sendService.delete(["1", "2"]);
      const sendsAfterDelete = await firstValueFrom(sendService.sends$);
      expect(sendsAfterDelete.length).toBe(0);
    });
  });
});
