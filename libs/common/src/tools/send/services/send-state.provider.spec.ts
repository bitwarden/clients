import {
  FakeAccountService,
  FakeStateProvider,
  awaitAsync,
  mockAccountServiceWith,
} from "../../../../spec";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";

import { SendStateProvider } from "./send-state.provider";
import { testSendData, testSendViewData } from "./test-data/send-tests.data";

describe("Send State Provider", () => {
  let stateProvider: FakeStateProvider;
  let accountService: FakeAccountService;
  let sendStateProvider: SendStateProvider;

  const mockUserId = Utils.newGuid() as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);

    sendStateProvider = new SendStateProvider(stateProvider);
  });

  describe("Encrypted Sends", () => {
    it("should return SendData", async () => {
      const sendData = { "1": testSendData("1", "Test Send Data") };
      await sendStateProvider.setEncryptedSends(sendData, mockUserId);
      await awaitAsync();

      const actual = await sendStateProvider.getEncryptedSends();
      expect(actual).toStrictEqual([mockUserId, sendData]);
    });
  });

  describe("Decrypted Sends", () => {
    it("should return SendView", async () => {
      const state = [testSendViewData("1", "Test")];
      await sendStateProvider.setDecryptedSends(state);
      await awaitAsync();

      const actual = await sendStateProvider.getDecryptedSends();
      expect(actual).toStrictEqual(state);
    });
  });
});
