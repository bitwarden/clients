import { firstValueFrom } from "rxjs";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import {
  FakeAccountService,
  FakeSingleUserState,
  FakeStateProvider,
  mockAccountServiceWith,
} from "../../../common/spec";

import {
  NewDeviceVerificationNoticeService,
  NewDeviceVerificationNotice,
  NEW_DEVICE_VERIFICATION_NOTICE_KEY,
  SKIP_NEW_DEVICE_VERIFICATION_NOTICE,
} from "./new-device-verification-notice.service";

describe("New Device Verification Notice", () => {
  const sut = NEW_DEVICE_VERIFICATION_NOTICE_KEY;
  const userId = Utils.newGuid() as UserId;
  let newDeviceVerificationService: NewDeviceVerificationNoticeService;
  let mockNoticeState: FakeSingleUserState<NewDeviceVerificationNotice>;
  let mockSkipState: FakeSingleUserState<boolean>;
  let stateProvider: FakeStateProvider;
  let accountService: FakeAccountService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    mockNoticeState = stateProvider.singleUser.getFake(userId, NEW_DEVICE_VERIFICATION_NOTICE_KEY);
    mockSkipState = stateProvider.singleUser.getFake(userId, SKIP_NEW_DEVICE_VERIFICATION_NOTICE);
    newDeviceVerificationService = new NewDeviceVerificationNoticeService(stateProvider);
  });

  it("should deserialize newDeviceVerificationNotice values", async () => {
    const currentDate = new Date();
    const inputObj = {
      last_dismissal: currentDate,
      permanent_dismissal: false,
    };

    const expectedFolderData = {
      last_dismissal: currentDate.toJSON(),
      permanent_dismissal: false,
    };

    const result = sut.deserializer(JSON.parse(JSON.stringify(inputObj)));

    expect(result).toEqual(expectedFolderData);
  });

  describe("notice$", () => {
    it("emits new device verification notice state", async () => {
      const currentDate = new Date();
      const data = {
        last_dismissal: currentDate,
        permanent_dismissal: false,
      };
      await stateProvider.setUserState(NEW_DEVICE_VERIFICATION_NOTICE_KEY, data, userId);

      const result = await firstValueFrom(newDeviceVerificationService.noticeState$(userId));

      expect(result).toBe(data);
    });
  });

  describe("update notice state", () => {
    it("should update the date with a new value", async () => {
      const currentDate = new Date();
      const oldDate = new Date("11-11-2011");
      const oldState = {
        last_dismissal: oldDate,
        permanent_dismissal: false,
      };
      const newState = {
        last_dismissal: currentDate,
        permanent_dismissal: true,
      };
      mockNoticeState.nextState(oldState);
      await newDeviceVerificationService.updateNewDeviceVerificationNoticeState(userId, newState);

      const result = await firstValueFrom(newDeviceVerificationService.noticeState$(userId));
      expect(result).toEqual(newState);
    });
  });

  describe("skipNotice state", () => {
    it("emits skip notice state", async () => {
      const shouldSkip = true;
      await stateProvider.setUserState(SKIP_NEW_DEVICE_VERIFICATION_NOTICE, shouldSkip, userId);

      const result = await firstValueFrom(newDeviceVerificationService.skipState$(userId));

      expect(result).toBe(shouldSkip);
    });

    it("should update the skip notice state", async () => {
      const initialSkipState = false;
      const updatedSkipState = true;
      mockSkipState.nextState(initialSkipState);
      await newDeviceVerificationService.updateNewDeviceVerificationSkipNoticeState(
        userId,
        updatedSkipState,
      );

      const result = await firstValueFrom(newDeviceVerificationService.skipState$(userId));
      expect(result).toBe(updatedSkipState);
    });
  });
});
