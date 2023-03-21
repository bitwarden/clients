import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/abstractions/log.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "@bitwarden/common/abstractions/storage.service";
import { SendType } from "@bitwarden/common/enums/sendType";
import { StateFactory } from "@bitwarden/common/factories/stateFactory";
import { GlobalState } from "@bitwarden/common/models/domain/global-state";
import { State } from "@bitwarden/common/models/domain/state";
import { SendView } from "@bitwarden/common/models/view/send.view";
import { StateMigrationService } from "@bitwarden/common/services/stateMigration.service";
import { EMPTY_GUID } from "@bitwarden/common/types/guid";

import { Account } from "../models/account";
import { BrowserComponentState } from "../models/browserComponentState";
import { BrowserGroupingsComponentState } from "../models/browserGroupingsComponentState";
import { BrowserSendComponentState } from "../models/browserSendComponentState";

import { BrowserStateService } from "./browser-state.service";

// disable session syncing to just test class
jest.mock("../decorators/session-sync-observable/");

describe("Browser State Service", () => {
  let secureStorageService: MockProxy<AbstractStorageService>;
  let diskStorageService: MockProxy<AbstractStorageService>;
  let logService: MockProxy<LogService>;
  let stateMigrationService: MockProxy<StateMigrationService>;
  let stateFactory: MockProxy<StateFactory<GlobalState, Account>>;
  let useAccountCache: boolean;

  let state: State<GlobalState, Account>;
  const userId = EMPTY_GUID;

  let sut: BrowserStateService;

  beforeEach(() => {
    secureStorageService = mock();
    diskStorageService = mock();
    logService = mock();
    stateMigrationService = mock();
    stateFactory = mock();
    useAccountCache = true;

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
        stateMigrationService,
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
