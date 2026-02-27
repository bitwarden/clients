import { mock } from "jest-mock-extended";

import { FakeStorageService } from "../../../spec";
import { LogService } from "../abstractions/log.service";
import { Utils } from "../misc/utils";

import { ANONYMOUS_APP_ID_KEY, APP_ID_KEY, AppIdService } from "./app-id.service";

describe("AppIdService", () => {
  let fakeStorageService: FakeStorageService;
  let sut: AppIdService;

  beforeEach(() => {
    fakeStorageService = new FakeStorageService();
    sut = new AppIdService(fakeStorageService, mock<LogService>());
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getAppId", () => {
    it("returns the existing appId when it exists", async () => {
      fakeStorageService.internalUpdateStore({ [APP_ID_KEY]: "existingAppId" });

      const appId = await sut.getAppId();

      expect(appId).toBe("existingAppId");
    });

    it("creates a new appId only once", async () => {
      fakeStorageService.internalUpdateStore({ [APP_ID_KEY]: null });

      const appIds: string[] = [];
      const promises = [async () => appIds.push(await sut.getAppId())];
      promises.push(async () => appIds.push(await sut.getAppId()));
      await Promise.all(promises);

      expect(appIds[0]).toBe(appIds[1]);
    });

    it.each([null, undefined])("returns a new appId when %s", async (value) => {
      fakeStorageService.internalUpdateStore({ [APP_ID_KEY]: value });

      const appId = await sut.getAppId();

      expect(appId).toMatch(Utils.guidRegex);
    });

    it.each([null, undefined])("stores the new guid when %s", async (value) => {
      fakeStorageService.internalUpdateStore({ [APP_ID_KEY]: value });

      const appId = await sut.getAppId();

      expect(fakeStorageService.mock.save).toHaveBeenCalledWith(APP_ID_KEY, appId, undefined);
    });
  });

  describe("getAnonymousAppId", () => {
    it("returns the existing appId when it exists", async () => {
      fakeStorageService.internalUpdateStore({ [ANONYMOUS_APP_ID_KEY]: "existingAppId" });

      const appId = await sut.getAnonymousAppId();

      expect(appId).toBe("existingAppId");
    });

    it("creates a new anonymousAppId only once", async () => {
      fakeStorageService.internalUpdateStore({ [ANONYMOUS_APP_ID_KEY]: null });

      const appIds: string[] = [];
      const promises = [async () => appIds.push(await sut.getAnonymousAppId())];
      promises.push(async () => appIds.push(await sut.getAnonymousAppId()));
      await Promise.all(promises);

      expect(appIds[0]).toBe(appIds[1]);
    });

    it.each([null, undefined])("returns a new appId when it does not exist", async (value) => {
      fakeStorageService.internalUpdateStore({ [ANONYMOUS_APP_ID_KEY]: value });

      const appId = await sut.getAnonymousAppId();

      expect(appId).toMatch(Utils.guidRegex);
    });

    it.each([null, undefined])(
      "stores the new guid when it an existing one is not found",
      async (value) => {
        fakeStorageService.internalUpdateStore({ [ANONYMOUS_APP_ID_KEY]: value });

        const appId = await sut.getAnonymousAppId();

        expect(fakeStorageService.mock.save).toHaveBeenCalledWith(
          ANONYMOUS_APP_ID_KEY,
          appId,
          undefined,
        );
      },
    );
  });
});
