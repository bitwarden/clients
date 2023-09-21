import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { StateFactory } from "@bitwarden/common/platform/factories/state-factory";
import { GlobalState } from "@bitwarden/common/platform/models/domain/global-state";
import { State } from "@bitwarden/common/platform/models/domain/state";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { Account } from "../../models/account";
import { BrowserComponentState } from "../../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../../models/browserGroupingsComponentState";
import { BrowserSendComponentState } from "../../models/browserSendComponentState";

import { BrowserStateService } from "./browser-state.service";

// disable session syncing to just test class
jest.mock("../decorators/session-sync-observable/");

describe("Browser State Service", () => {
  let secureStorageService: MockProxy<AbstractStorageService>;
  let diskStorageService: MockProxy<AbstractStorageService>;
  let logService: MockProxy<LogService>;
  let stateFactory: MockProxy<StateFactory<GlobalState, Account>>;
  let useAccountCache: boolean;

  let state: State<GlobalState, Account>;
  const userId = "userId";

  let sut: BrowserStateService;

  beforeEach(() => {
    secureStorageService = mock();
    diskStorageService = mock();
    logService = mock();
    stateFactory = mock();
    // turn off account cache for tests
    useAccountCache = false;

    state = new State(new GlobalState());
    state.accounts[userId] = new Account({
      profile: { userId: userId },
    });
    state.activeUserId = userId;
  });

  describe("state methods", () => {
    let memoryStorageService: MockProxy<AbstractMemoryStorageService>;

    beforeEach(() => {
      memoryStorageService = mock();
      const stateGetter = (key: string) => Promise.resolve(state);
      memoryStorageService.get.mockImplementation(stateGetter);

      sut = new BrowserStateService(
        diskStorageService,
        secureStorageService,
        memoryStorageService,
        logService,
        stateFactory,
        useAccountCache
      );
    });

    describe("getBrowserGroupingComponentState", () => {
      it("should return a BrowserGroupingsComponentState", async () => {
        state.accounts[userId].groupings = new BrowserGroupingsComponentState();

        const actual = await sut.getBrowserGroupingComponentState();
        expect(actual).toBeInstanceOf(BrowserGroupingsComponentState);
      });
    });

    describe("getBrowserVaultItemsComponentState", () => {
      it("should return a BrowserComponentState", async () => {
        const componentState = new BrowserComponentState();
        componentState.scrollY = 0;
        componentState.searchText = "test";
        state.accounts[userId].ciphers = componentState;

        const actual = await sut.getBrowserVaultItemsComponentState();
        expect(actual).toStrictEqual(componentState);
      });
    });

    describe("getBrowserSendComponentState", () => {
      it("should return a BrowserSendComponentState", async () => {
        const sendState = new BrowserSendComponentState();
        sendState.sends = [new SendView(), new SendView()];
        sendState.typeCounts = new Map<SendType, number>([
          [SendType.File, 3],
          [SendType.Text, 5],
        ]);
        state.accounts[userId].send = sendState;
        (global as any)["watch"] = state;

        const actual = await sut.getBrowserSendComponentState();
        expect(actual).toBeInstanceOf(BrowserSendComponentState);
        expect(actual).toMatchObject(sendState);
      });
    });

    describe("getBrowserSendTypeComponentState", () => {
      it("should return a BrowserComponentState", async () => {
        const componentState = new BrowserComponentState();
        componentState.scrollY = 0;
        componentState.searchText = "test";
        state.accounts[userId].sendType = componentState;

        const actual = await sut.getBrowserSendTypeComponentState();
        expect(actual).toStrictEqual(componentState);
      });
    });
  });
});
