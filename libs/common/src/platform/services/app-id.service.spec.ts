import { FakeGlobalStateProvider } from "../../../spec";
import { Utils } from "../misc/utils";

import { ANONYMOUS_APP_ID_KEY, APP_ID_KEY, AppIdService } from "./app-id.service";

describe("AppIdService", () => {
  const globalStateProvider = new FakeGlobalStateProvider();
  const appIdState = globalStateProvider.getFake(APP_ID_KEY);
  const anonymousAppIdState = globalStateProvider.getFake(ANONYMOUS_APP_ID_KEY);
  let sut: AppIdService;

  beforeEach(() => {
    sut = new AppIdService(globalStateProvider);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getAppId", () => {
    it("returns the existing appId when it exists", async () => {
      appIdState.stateSubject.next("existingAppId");

      const appId = await sut.getAppId();

      expect(appId).toBe("existingAppId");
    });

    it.each([null, undefined])(
      "uses the util function to create a new id when it AppId does not exist",
      async (value) => {
        appIdState.stateSubject.next(value);
        const spy = jest.spyOn(Utils, "newGuid");

        await sut.getAppId();

        expect(spy).toHaveBeenCalledTimes(1);
      },
    );

    it.each([null, undefined])("returns a new appId when it does not exist", async (value) => {
      appIdState.stateSubject.next(value);

      const appId = await sut.getAppId();

      expect(appId).toMatch(Utils.guidRegex);
    });

    it.each([null, undefined])(
      "stores the new guid when it an existing one is not found",
      async (value) => {
        appIdState.stateSubject.next(value);

        const appId = await sut.getAppId();

        expect(appIdState.nextMock).toHaveBeenCalledWith(appId);
      },
    );
  });

  describe("getAnonymousAppId", () => {
    it("returns the existing appId when it exists", async () => {
      anonymousAppIdState.stateSubject.next("existingAppId");

      const appId = await sut.getAnonymousAppId();

      expect(appId).toBe("existingAppId");
    });

    it.each([null, undefined])(
      "uses the util function to create a new id when it AppId does not exist",
      async (value) => {
        anonymousAppIdState.stateSubject.next(value);
        const spy = jest.spyOn(Utils, "newGuid");

        await sut.getAnonymousAppId();

        expect(spy).toHaveBeenCalledTimes(1);
      },
    );

    it.each([null, undefined])("returns a new appId when it does not exist", async (value) => {
      anonymousAppIdState.stateSubject.next(value);

      const appId = await sut.getAnonymousAppId();

      expect(appId).toMatch(Utils.guidRegex);
    });

    it.each([null, undefined])(
      "stores the new guid when it an existing one is not found",
      async (value) => {
        anonymousAppIdState.stateSubject.next(value);

        const appId = await sut.getAnonymousAppId();

        expect(anonymousAppIdState.nextMock).toHaveBeenCalledWith(appId);
      },
    );
  });
});
