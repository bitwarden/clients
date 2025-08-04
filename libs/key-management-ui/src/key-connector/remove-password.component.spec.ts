import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { mockAccountServiceWith } from "../../../common/spec";

import { RemovePasswordComponent } from "./remove-password.component";

describe("RemovePasswordComponent", () => {
  let component: RemovePasswordComponent;

  const userId = "test-user-id" as UserId;
  const organization = {
    id: "test-organization-id",
    name: "test-organization-name",
    keyConnectorUrl: "https://key-connector-url.com",
  } as Organization;

  const accountService = mockAccountServiceWith(userId);

  const mockRouter = mock<Router>();
  const mockSyncService = mock<SyncService>();
  const mockI18nService = mock<I18nService>();
  const mockKeyConnectorService = mock<KeyConnectorService>();
  const mockOrganizationApiService = mock<OrganizationApiServiceAbstraction>();
  const mockDialogService = mock<DialogService>();
  const mockToastService = mock<ToastService>();

  beforeEach(async () => {
    jest.clearAllMocks();

    await accountService.switchAccount(userId);

    component = new RemovePasswordComponent(
      mock<LogService>(),
      mockRouter,
      accountService,
      mockSyncService,
      mockI18nService,
      mockKeyConnectorService,
      mockOrganizationApiService,
      mockDialogService,
      mockToastService,
    );
  });

  describe("ngOnInit", () => {
    it("should set activeUserId and organization", async () => {
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      await component.ngOnInit();

      expect(component["activeUserId"]).toBe("test-user-id");
      expect(component.organization).toEqual(organization);
      expect(component.loading).toEqual(false);

      expect(mockKeyConnectorService.getManagingOrganization).toHaveBeenCalledWith(userId);
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should redirect to login when no active account is found", async () => {
      await accountService.switchAccount(null as unknown as UserId);

      await component.ngOnInit();

      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should redirect to login when no organization is found", async () => {
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue(
        null as unknown as Organization,
      );

      await component.ngOnInit();

      expect(mockKeyConnectorService.getManagingOrganization).toHaveBeenCalledWith(userId);
      expect(mockSyncService.fullSync).toHaveBeenCalledWith(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });
  });

  describe("get action", () => {
    it.each([
      [true, false],
      [false, true],
      [true, true],
    ])(
      "should return true when continuing is $continuing and leaving is $leaving",
      (continuing, leaving) => {
        component.continuing = continuing;
        component.leaving = leaving;

        expect(component.action).toBe(true);
      },
    );

    it("should return false when continuing and leaving are both false", () => {
      component.continuing = false;
      component.leaving = false;

      expect(component.action).toBe(false);
    });
  });

  describe("convert", () => {
    beforeEach(async () => {
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      await component.ngOnInit();
    });

    it("should call migrateUser and show success toast", async () => {
      mockI18nService.t.mockReturnValue("removed master password");

      await component.convert();

      expect(component.continuing).toBe(true);
      expect(mockKeyConnectorService.migrateUser).toHaveBeenCalledWith(
        organization.keyConnectorUrl,
        userId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "removed master password",
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should handle errors and show error toast", async () => {
      const errorMessage = "Can't migrate user error";
      mockKeyConnectorService.migrateUser.mockRejectedValue(new Error(errorMessage));
      mockI18nService.t.mockReturnValue("error occurred");

      await component.convert();

      expect(component.continuing).toBe(false);
      expect(mockKeyConnectorService.migrateUser).toHaveBeenCalledWith(
        organization.keyConnectorUrl,
        userId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error occurred",
        message: errorMessage,
      });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should handle error response and show error toast", async () => {
      const errorMessage = "Can't migrate user error";
      mockKeyConnectorService.migrateUser.mockRejectedValue(
        new ErrorResponse(
          {
            message: errorMessage,
          },
          404,
        ),
      );
      mockI18nService.t.mockReturnValue("error occurred");

      await component.convert();

      expect(component.continuing).toBe(false);
      expect(mockKeyConnectorService.migrateUser).toHaveBeenCalledWith(
        organization.keyConnectorUrl,
        userId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error occurred",
        message: errorMessage,
      });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe("leave", () => {
    beforeEach(async () => {
      mockKeyConnectorService.getManagingOrganization.mockResolvedValue(organization);

      await component.ngOnInit();
    });

    it("should call leave and show success toast", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockI18nService.t.mockReturnValue("left organization");

      await component.leave();

      expect(component.leaving).toBe(true);
      expect(mockOrganizationApiService.leave).toHaveBeenCalledWith(organization.id);
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "left organization",
      });
      expect(mockRouter.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should handle error response and show error toast", async () => {
      const errorMessage = "Can't leave organization error";
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockOrganizationApiService.leave.mockRejectedValue(new Error(errorMessage));
      mockI18nService.t.mockReturnValue("error occurred");

      await component.leave();

      expect(component.leaving).toBe(false);
      expect(mockOrganizationApiService.leave).toHaveBeenCalledWith(organization.id);
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error occurred",
        message: errorMessage,
      });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should handle error response and show error toast", async () => {
      const errorMessage = "Can't leave organization error";
      mockDialogService.openSimpleDialog.mockResolvedValue(true);
      mockOrganizationApiService.leave.mockRejectedValue(
        new ErrorResponse(
          {
            message: errorMessage,
          },
          404,
        ),
      );
      mockI18nService.t.mockReturnValue("error occurred");

      await component.leave();

      expect(component.leaving).toBe(false);
      expect(mockOrganizationApiService.leave).toHaveBeenCalledWith(organization.id);
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error occurred",
        message: errorMessage,
      });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it("should not call leave when dialog is canceled", async () => {
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component.leave();

      expect(component.leaving).toBe(false);
      expect(mockOrganizationApiService.leave).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });
});
