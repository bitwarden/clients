import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationConnectionType } from "@bitwarden/common/admin-console/enums";
import { ScimConfigApi } from "@bitwarden/common/admin-console/models/api/scim-config.api";
import { OrganizationConnectionResponse } from "@bitwarden/common/admin-console/models/response/organization-connection.response";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { ScimApiKeyDialogComponent } from "./scim-api-key-dialog.component";
import { ScimV2Component } from "./scim-v2.component";

describe("ScimV2Component", () => {
  const ta = (comp: ScimV2Component) => comp as any;

  let component: ScimV2Component;
  let fixture: ComponentFixture<ScimV2Component>;

  let apiService: MockProxy<ApiService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let environmentService: MockProxy<EnvironmentService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let mockEnv: MockProxy<Environment>;
  let environment$: BehaviorSubject<Environment>;

  let openSpy: jest.SpyInstance;

  const orgId = "org-id-123";
  const scimUrl = "https://scim.example.com";

  function mockConnection(
    enabled: boolean,
    id: string | null = "connection-id",
  ): OrganizationConnectionResponse<ScimConfigApi> {
    if (!enabled && id === null) {
      return null as unknown as OrganizationConnectionResponse<ScimConfigApi>;
    }
    return {
      id,
      config: { enabled },
    } as OrganizationConnectionResponse<ScimConfigApi>;
  }

  beforeEach(async () => {
    apiService = mock<ApiService>();
    platformUtilsService = mock<PlatformUtilsService>();
    i18nService = mock<I18nService>();
    environmentService = mock<EnvironmentService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();

    mockEnv = mock<Environment>();
    mockEnv.getScimUrl.mockReturnValue(scimUrl);
    environment$ = new BehaviorSubject<Environment>(mockEnv);
    environmentService.environment$ = environment$;

    i18nService.t.mockImplementation((key: string) => key);

    openSpy = jest.spyOn(ScimApiKeyDialogComponent, "open");

    await TestBed.configureTestingModule({
      imports: [ScimV2Component],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
            params: of({ organizationId: orgId }),
          },
        },
        { provide: ApiService, useValue: apiService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  function initComponent(
    connection: OrganizationConnectionResponse<ScimConfigApi> = mockConnection(true),
  ) {
    apiService.getOrganizationConnection.mockResolvedValue(connection);
    fixture = TestBed.createComponent(ScimV2Component);
    component = fixture.componentInstance;
  }

  describe("load", () => {
    it("sets showScimSettings and masked clientSecret when connection is enabled", fakeAsync(() => {
      initComponent(mockConnection(true));

      void component.load();
      tick();

      expect(ta(component).showScimSettings()).toBe(true);
      expect(ta(component).enabled.value).toBe(true);
      expect(ta(component).formData.get("clientSecret").value).toBe("••••••••••••••••");
      expect(ta(component).loading()).toBe(false);
    }));

    it("hides SCIM settings when connection is disabled", fakeAsync(() => {
      initComponent(mockConnection(false));

      void component.load();
      tick();

      expect(ta(component).showScimSettings()).toBe(false);
      expect(ta(component).enabled.value).toBe(false);
      expect(ta(component).loading()).toBe(false);
    }));

    it("does not open dialog on load", fakeAsync(() => {
      initComponent(mockConnection(true));

      void component.load();
      tick();

      expect(openSpy).not.toHaveBeenCalled();
    }));
  });

  describe("loadApiKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("hides the key and sets masked value when showScimKey is already true", fakeAsync(() => {
      ta(component).showScimKey.set(true);

      void ta(component).loadApiKey();
      tick();

      expect(ta(component).showScimKey()).toBe(false);
      expect(ta(component).formData.get("clientSecret").value).toBe("••••••••••••••••");
      expect(openSpy).not.toHaveBeenCalled();
    }));

    it("opens the dialog when showScimKey is false", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of({ apiKey: "revealed-key" }) });

      void ta(component).loadApiKey();
      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        organizationId: orgId,
        titleKey: "viewScimApiKey",
        isRotation: false,
      });
      expect(ta(component).formData.get("clientSecret").value).toBe("revealed-key");
      expect(ta(component).showScimKey()).toBe(true);
    }));

    it("does not update form when dialog is dismissed", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of(undefined) });

      void ta(component).loadApiKey();
      tick();

      expect(ta(component).showScimKey()).toBe(false);
      expect(ta(component).formData.get("clientSecret").value).toBe("••••••••••••••••");
    }));
  });

  describe("rotateScimKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("opens the dialog with isRotation true and updates form on success", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of({ apiKey: "rotated-key" }) });

      void ta(component).rotateScimKey();
      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        organizationId: orgId,
        titleKey: "rotateScimKey",
        isRotation: true,
      });
      expect(ta(component).formData.get("clientSecret").value).toBe("rotated-key");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "scimApiKeyRotated",
      });
    }));

    it("does not update form or show toast when dialog is dismissed", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of(undefined) });

      void ta(component).rotateScimKey();
      tick();

      expect(toastService.showToast).not.toHaveBeenCalled();
    }));
  });

  describe("copyScimKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("opens dialog and copies key to clipboard when no cached key", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of({ apiKey: "revealed-key" }) });

      void ta(component).copyScimKey();
      tick();

      expect(openSpy).toHaveBeenCalledWith(expect.anything(), {
        organizationId: orgId,
        titleKey: "copyScimKey",
        isRotation: false,
      });
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("revealed-key");
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "valueCopied",
        variant: "success",
      });
    }));

    it("uses cached key without opening dialog", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of({ apiKey: "cached-key" }) });

      void ta(component).loadApiKey();
      tick();
      openSpy.mockClear();

      void ta(component).copyScimKey();
      tick();

      expect(openSpy).not.toHaveBeenCalled();
      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("cached-key");
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "valueCopied",
        variant: "success",
      });
    }));

    it("does not copy or show toast when dialog is dismissed", fakeAsync(() => {
      openSpy.mockReturnValue({ closed: of(undefined) });

      void ta(component).copyScimKey();
      tick();

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    }));
  });

  describe("copyScimUrl", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("copies the SCIM endpoint URL to clipboard and shows toast", fakeAsync(() => {
      void ta(component).copyScimUrl();
      tick();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(scimUrl + "/" + orgId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "valueCopied",
        variant: "success",
      });
    }));
  });

  describe("submit", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("creates a new connection when no existing connection id", fakeAsync(() => {
      ta(component).existingConnectionId.set(undefined);
      ta(component).enabled.setValue(true);
      apiService.createOrganizationConnection.mockResolvedValue(mockConnection(true));

      void ta(component).submit();
      tick();

      expect(apiService.createOrganizationConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          type: OrganizationConnectionType.Scim,
          enabled: true,
        }),
        ScimConfigApi,
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "scimSettingsSaved",
      });
    }));

    it("updates an existing connection when connection id exists", fakeAsync(() => {
      ta(component).existingConnectionId.set("connection-id");
      ta(component).enabled.setValue(false);
      apiService.updateOrganizationConnection.mockResolvedValue(mockConnection(false));

      void ta(component).submit();
      tick();

      expect(apiService.updateOrganizationConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          type: OrganizationConnectionType.Scim,
          enabled: true,
        }),
        ScimConfigApi,
        "connection-id",
      );
      expect(apiService.createOrganizationConnection).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "scimSettingsSaved",
      });
    }));
  });
});
