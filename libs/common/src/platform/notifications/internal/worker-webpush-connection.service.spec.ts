import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import {
  awaitAsync,
  FakeGlobalState,
  FakeStateProvider,
  mockAccountServiceWith,
} from "../../../../spec";
import { PushTechnology } from "../../../enums/push-technology.enum";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { ServerConfig } from "../../abstractions/config/server-config";
import { Supported } from "../../misc/support-status";
import { Utils } from "../../misc/utils";
import { ServerConfigData } from "../../models/data/server-config.data";
import { PushSettingsConfigResponse } from "../../models/response/server-config.response";
import { KeyDefinition } from "../../state";

import { WebPushNotificationsApiService } from "./web-push-notifications-api.service";
import { WebPushConnector } from "./webpush-connection.service";
import {
  WEB_PUSH_SUBSCRIPTION_USERS,
  WorkerWebPushConnectionService,
} from "./worker-webpush-connection.service";

const mockUser1 = "testUser1" as UserId;

const createSub = (key: string) => {
  return {
    options: { applicationServerKey: Utils.fromUrlB64ToArray(key), userVisibleOnly: true },
    endpoint: `web.push.endpoint/?${Utils.newGuid()}`,
    expirationTime: 5,
    getKey: () => null,
    toJSON: () => ({ endpoint: "something", keys: {}, expirationTime: 5 }),
    unsubscribe: () => Promise.resolve(true),
  } satisfies PushSubscription;
};

describe("WorkerWebpushConnectionService", () => {
  let configService: MockProxy<ConfigService>;
  let webPushApiService: MockProxy<WebPushNotificationsApiService>;
  let stateProvider: FakeStateProvider;
  let pushManager: MockProxy<PushManager>;
  const userId = "testUser1" as UserId;

  let sut: WorkerWebPushConnectionService;

  beforeEach(() => {
    configService = mock();
    webPushApiService = mock();
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    pushManager = mock();

    sut = new WorkerWebPushConnectionService(
      configService,
      webPushApiService,
      mock<ServiceWorkerRegistration>({ pushManager: pushManager }),
      stateProvider,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });
  type ExtractKeyDefinitionType<T> = T extends KeyDefinition<infer U> ? U : never;
  describe("supportStatus$", () => {
    let fakeGlobalState: FakeGlobalState<
      ExtractKeyDefinitionType<typeof WEB_PUSH_SUBSCRIPTION_USERS>
    >;

    beforeEach(() => {
      fakeGlobalState = stateProvider.getGlobal(WEB_PUSH_SUBSCRIPTION_USERS) as FakeGlobalState<
        ExtractKeyDefinitionType<typeof WEB_PUSH_SUBSCRIPTION_USERS>
      >;
    });

    test("when web push is supported, have an existing subscription, and we've already registered the user, should not call API", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );
      const existingSubscription = createSub("dGVzdA");
      await fakeGlobalState.nextState({ [existingSubscription.endpoint]: [userId] });

      pushManager.getSubscription.mockResolvedValue(existingSubscription);

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(0);

      expect(fakeGlobalState.nextMock).toHaveBeenCalledTimes(0);

      notificationsSub.unsubscribe();
    });

    test("when web push is supported, have an existing subscription, and we haven't registered the user, should call API", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );
      const existingSubscription = createSub("dGVzdA");
      await fakeGlobalState.nextState({
        [existingSubscription.endpoint]: ["otherUserId" as UserId],
      });

      pushManager.getSubscription.mockResolvedValue(existingSubscription);

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      expect(fakeGlobalState.nextMock).toHaveBeenCalledTimes(1);
      expect(fakeGlobalState.nextMock).toHaveBeenCalledWith({
        [existingSubscription.endpoint]: ["otherUserId", mockUser1],
      });

      notificationsSub.unsubscribe();
    });

    test("when web push is supported, have an existing subscription, but it isn't in state, should call API and add to state", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );
      const existingSubscription = createSub("dGVzdA");
      await fakeGlobalState.nextState({
        [existingSubscription.endpoint]: null!,
      });

      pushManager.getSubscription.mockResolvedValue(existingSubscription);

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      expect(fakeGlobalState.nextMock).toHaveBeenCalledTimes(1);
      expect(fakeGlobalState.nextMock).toHaveBeenCalledWith({
        [existingSubscription.endpoint]: [mockUser1],
      });

      notificationsSub.unsubscribe();
    });

    test("when web push is supported, have an existing subscription, but state array is null, should call API and add to state", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );
      const existingSubscription = createSub("dGVzdA");
      await fakeGlobalState.nextState({});

      pushManager.getSubscription.mockResolvedValue(existingSubscription);

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      expect(fakeGlobalState.nextMock).toHaveBeenCalledTimes(1);
      expect(fakeGlobalState.nextMock).toHaveBeenCalledWith({
        [existingSubscription.endpoint]: [mockUser1],
      });

      notificationsSub.unsubscribe();
    });

    test("when web push is supported, but we don't have an existing subscription, should call the api and wipe out existing state", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );
      const existingState = createSub("dGVzdA");
      await fakeGlobalState.nextState({ [existingState.endpoint]: [userId] });

      pushManager.getSubscription.mockResolvedValue(null);
      const newSubscription = createSub("dGVzdA");
      pushManager.subscribe.mockResolvedValue(newSubscription);

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      expect(fakeGlobalState.nextMock).toHaveBeenCalledTimes(1);
      expect(fakeGlobalState.nextMock).toHaveBeenCalledWith({
        [newSubscription.endpoint]: [mockUser1],
      });

      notificationsSub.unsubscribe();
    });

    test("when web push is supported and no existing subscription, should call API", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );

      pushManager.getSubscription.mockResolvedValue(null);
      pushManager.subscribe.mockResolvedValue(createSub("dGVzdA"));

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      notificationsSub.unsubscribe();
    });

    test("when web push is supported and existing subscription with different key, should call API", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );

      pushManager.getSubscription.mockResolvedValue(createSub("dGVzdF9hbHQ"));

      pushManager.subscribe.mockResolvedValue(createSub("dGVzdA"));

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      notificationsSub.unsubscribe();
    });

    test("when server config emits multiple times quickly while api call takes a long time will only call API once", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: "dGVzdA",
            }),
          }),
        ),
      );

      pushManager.getSubscription.mockResolvedValue(createSub("dGVzdF9hbHQ"));

      pushManager.subscribe.mockResolvedValue(createSub("dGVzdA"));

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("supported");
      const service = (supportStatus as Supported<WebPushConnector>).service;
      expect(service).not.toBeFalsy();

      const notificationsSub = service.notifications$.subscribe();

      await awaitAsync(2);

      expect(pushManager.getSubscription).toHaveBeenCalledTimes(1);
      expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
      expect(webPushApiService.putSubscription).toHaveBeenCalledTimes(1);

      notificationsSub.unsubscribe();
    });

    it("server config shows SignalR support should return not-supported", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.SignalR,
            }),
          }),
        ),
      );

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("not-supported");
    });

    it("server config shows web push but no public key support should return not-supported", async () => {
      configService.serverConfig$ = of(
        new ServerConfig(
          new ServerConfigData({
            push: new PushSettingsConfigResponse({
              pushTechnology: PushTechnology.WebPush,
              vapidPublicKey: null,
            }),
          }),
        ),
      );

      const supportStatus = await firstValueFrom(sut.supportStatus$(mockUser1));
      expect(supportStatus.type).toBe("not-supported");
    });
  });
});
