import { ActivatedRoute, ActivatedRouteSnapshot, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { KdfType } from "@bitwarden/key-management";

import { ConfirmKeyConnectorDomainComponent } from "./confirm-key-connector-domain.component";

describe("ConfirmKeyConnectorDomainComponent", () => {
  let component: ConfirmKeyConnectorDomainComponent;

  const userId = "test-user-id" as UserId;
  const organizationId = "test-organization-id";
  const keyConnectorUrl = "https://key-connector-url.com";
  const kdfType = KdfType.Argon2id;
  const kdfIterations = 10;
  const kdfMemory = 64;
  const kdfParallelism = 4;

  const mockRoute = mock<ActivatedRoute>();
  const mockRouter = mock<Router>();
  const mockSyncService = mock<SyncService>();
  const mockKeyConnectorService = mock<KeyConnectorService>();
  const mockLogService = mock<LogService>();
  const mockMessagingService = mock<MessagingService>();
  const beforeNavigationConfirmCallback = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    component = new ConfirmKeyConnectorDomainComponent(
      mockRoute,
      mockRouter,
      mockLogService,
      mockKeyConnectorService,
      mockMessagingService,
      mockSyncService,
    );

    jest
      .spyOn(component, "beforeNavigationConfirmCallback")
      .mockImplementation(beforeNavigationConfirmCallback);

    mockRoute.snapshot = mock<ActivatedRouteSnapshot>();
    mockRoute.snapshot.queryParamMap.get = jest.fn((key) => mockQueryParamMapGet(key));
  });

  describe("ngOnInit", () => {
    it.each([["userId"], ["organizationId"], ["keyConnectorUrl"], ["kdf"], ["kdfIterations"]])(
      "should logout when missing %s parameter",
      async (missingKey) => {
        mockRoute.snapshot.queryParamMap.get = jest.fn((key) => {
          if (key === missingKey) {
            return null;
          }
          return mockQueryParamMapGet(key);
        });

        await component.ngOnInit();

        expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
        expect(component.loading).toEqual(true);
      },
    );

    it("Should set component properties correctly", async () => {
      await component.ngOnInit();

      expect(component.userId).toEqual(userId);
      expect(component.organizationId).toEqual(organizationId);
      expect(component.keyConnectorUrl).toEqual(keyConnectorUrl);
      expect(component.kdf).toEqual(kdfType);
      expect(component.kdfIterations).toEqual(kdfIterations);
      expect(component.kdfMemory).toEqual(kdfMemory);
      expect(component.kdfParallelism).toEqual(kdfParallelism);
      expect(component.loading).toEqual(false);
    });
  });

  describe("confirm", () => {
    it("should call keyConnectorService.convertNewSsoUserToKeyConnector with full sync and navigation to home page", async () => {
      await component.ngOnInit();

      await component.confirm();

      expect(mockKeyConnectorService.convertNewSsoUserToKeyConnector).toHaveBeenCalledWith(
        organizationId,
        userId,
        keyConnectorUrl,
        kdfType,
        kdfIterations,
        kdfMemory,
        kdfParallelism,
      );
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
      expect(mockMessagingService.send).toHaveBeenCalledWith("loggedIn");
      expect(beforeNavigationConfirmCallback).toHaveBeenCalled();

      expect(
        mockKeyConnectorService.convertNewSsoUserToKeyConnector.mock.invocationCallOrder[0],
      ).toBeLessThan(mockSyncService.fullSync.mock.invocationCallOrder[0]);
      expect(mockSyncService.fullSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockMessagingService.send.mock.invocationCallOrder[0],
      );
      expect(mockMessagingService.send.mock.invocationCallOrder[0]).toBeLessThan(
        beforeNavigationConfirmCallback.mock.invocationCallOrder[0],
      );
      expect(beforeNavigationConfirmCallback.mock.invocationCallOrder[0]).toBeLessThan(
        mockRouter.navigate.mock.invocationCallOrder[0],
      );
    });
  });

  describe("cancel", () => {
    it("should logout", async () => {
      await component.ngOnInit();

      await component.cancel();

      expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
      expect(mockKeyConnectorService.convertNewSsoUserToKeyConnector).not.toHaveBeenCalled();
    });
  });

  function mockQueryParamMapGet(key: string) {
    switch (key) {
      case "userId":
        return userId;
      case "organizationId":
        return organizationId;
      case "keyConnectorUrl":
        return keyConnectorUrl;
      case "kdf":
        return kdfType.toString();
      case "kdfIterations":
        return kdfIterations.toString();
      case "kdfMemory":
        return kdfMemory.toString();
      case "kdfParallelism":
        return kdfParallelism.toString();
      default:
        return null;
    }
  }
});
