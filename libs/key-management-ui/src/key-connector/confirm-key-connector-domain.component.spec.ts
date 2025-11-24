import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { KeyConnectorApiService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector-api.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { KeyConnectorDomainConfirmation } from "@bitwarden/common/key-management/key-connector/models/key-connector-domain-confirmation";
import { KeyConnectorConfirmationDetailsResponse } from "@bitwarden/common/key-management/key-connector/models/response/key-connector-confirmation-details.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { ConfirmKeyConnectorDomainComponent } from "./confirm-key-connector-domain.component";

describe("ConfirmKeyConnectorDomainComponent", () => {
  let component: ConfirmKeyConnectorDomainComponent;

  const userId = "test-user-id" as UserId;
  const expectedHostName = "key-connector-url.com";
  const confirmation: KeyConnectorDomainConfirmation = {
    keyConnectorUrl: "https://key-connector-url.com",
    organizationSsoIdentifier: "org-sso-identifier",
  };

  const mockRouter = mock<Router>();
  const mockSyncService = mock<SyncService>();
  const mockKeyConnectorService = mock<KeyConnectorService>();
  const mockLogService = mock<LogService>();
  const mockMessagingService = mock<MessagingService>();
  const mockKeyConnectorApiService = mock<KeyConnectorApiService>();
  let mockAccountService = mockAccountServiceWith(userId);
  const onBeforeNavigation = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAccountService = mockAccountServiceWith(userId);

    component = new ConfirmKeyConnectorDomainComponent(
      mockRouter,
      mockLogService,
      mockKeyConnectorService,
      mockMessagingService,
      mockSyncService,
      mockAccountService,
      mockKeyConnectorApiService,
    );

    jest.spyOn(component, "onBeforeNavigation").mockImplementation(onBeforeNavigation);

    // Mock key connector service to return data from state
    mockKeyConnectorService.requiresDomainConfirmation$.mockReturnValue(of(confirmation));
  });

  describe("ngOnInit", () => {
    it("should logout when no active account", async () => {
      mockAccountService.activeAccount$ = of(null);

      await component.ngOnInit();

      expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
      expect(component.loading).toEqual(true);
    });

    it("should logout when confirmation is null", async () => {
      mockKeyConnectorService.requiresDomainConfirmation$.mockReturnValue(of(null));

      await component.ngOnInit();

      expect(mockMessagingService.send).toHaveBeenCalledWith("logout");
      expect(component.loading).toEqual(true);
    });

    it("sets organization name to undefined when getOrganizationName throws error", async () => {
      mockKeyConnectorApiService.getConfirmationDetails.mockRejectedValue(new Error("API error"));

      await component.ngOnInit();

      expect(component.organizationName).toBeUndefined();
      expect(component.userId).toEqual(userId);
      expect(component.keyConnectorUrl).toEqual(confirmation.keyConnectorUrl);
      expect(component.keyConnectorHostName).toEqual(expectedHostName);
      expect(component.loading).toEqual(false);
    });

    it("should set component properties correctly", async () => {
      const expectedOrgName = "Test Organization";
      mockKeyConnectorApiService.getConfirmationDetails.mockResolvedValue({
        organizationName: expectedOrgName,
      } as KeyConnectorConfirmationDetailsResponse);

      await component.ngOnInit();

      expect(component.userId).toEqual(userId);
      expect(component.organizationName).toEqual(expectedOrgName);
      expect(component.keyConnectorUrl).toEqual(confirmation.keyConnectorUrl);
      expect(component.keyConnectorHostName).toEqual(expectedHostName);
      expect(component.loading).toEqual(false);
    });
  });

  describe("confirm", () => {
    it("should call keyConnectorService.convertNewSsoUserToKeyConnector with full sync and navigation to home page", async () => {
      await component.ngOnInit();

      await component.confirm();

      expect(mockKeyConnectorService.convertNewSsoUserToKeyConnector).toHaveBeenCalledWith(userId);
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(true);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
      expect(mockMessagingService.send).toHaveBeenCalledWith("loggedIn");
      expect(onBeforeNavigation).toHaveBeenCalled();

      expect(
        mockKeyConnectorService.convertNewSsoUserToKeyConnector.mock.invocationCallOrder[0],
      ).toBeLessThan(mockSyncService.fullSync.mock.invocationCallOrder[0]);
      expect(mockSyncService.fullSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockMessagingService.send.mock.invocationCallOrder[0],
      );
      expect(mockMessagingService.send.mock.invocationCallOrder[0]).toBeLessThan(
        onBeforeNavigation.mock.invocationCallOrder[0],
      );
      expect(onBeforeNavigation.mock.invocationCallOrder[0]).toBeLessThan(
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
});
