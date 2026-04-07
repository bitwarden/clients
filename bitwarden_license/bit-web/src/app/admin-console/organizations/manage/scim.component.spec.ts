import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { UntypedFormBuilder } from "@angular/forms";
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
import { I18nPipe } from "@bitwarden/ui-common";

import { ScimApiKeyDialogComponent } from "./scim-api-key-dialog.component";
import { ScimComponent } from "./scim.component";

describe("ScimComponent", () => {
  const testAccess = (comp: ScimComponent) => comp as any;

  let component: ScimComponent;
  let fixture: ComponentFixture<ScimComponent>;

  let apiService: MockProxy<ApiService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let environmentService: MockProxy<EnvironmentService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let mockEnv: MockProxy<Environment>;
  let environment$: BehaviorSubject<Environment>;

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

    await TestBed.configureTestingModule({
      declarations: [ScimComponent],
      imports: [I18nPipe],
      providers: [
        UntypedFormBuilder,
        {
          provide: ActivatedRoute,
          useValue: { parent: { parent: { params: of({ organizationId: orgId }) } } },
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
    fixture = TestBed.createComponent(ScimComponent);
    component = fixture.componentInstance;
    component.organizationId = orgId;
  }

  describe("load", () => {
    it("sets showScimSettings and masked clientSecret when connection is enabled", fakeAsync(() => {
      initComponent(mockConnection(true));

      void component.load();
      tick();

      expect(component.showScimSettings).toBe(true);
      expect(component.enabled.value).toBe(true);
      expect(component.formData.get("clientSecret")!.value).toBe("••••••••••••••••");
      expect(component.loading).toBe(false);
    }));

    it("hides SCIM settings when connection is disabled", fakeAsync(() => {
      initComponent(mockConnection(false));

      void component.load();
      tick();

      expect(component.showScimSettings).toBe(false);
      expect(component.enabled.value).toBe(false);
      expect(component.loading).toBe(false);
    }));

    it("does not open dialog on load", fakeAsync(() => {
      initComponent(mockConnection(true));

      void component.load();
      tick();

      expect(dialogService.open).not.toHaveBeenCalled();
    }));
  });

  describe("loadApiKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("hides the key and sets masked value when showScimKey is already true", fakeAsync(() => {
      component.showScimKey = true;

      void component.loadApiKey();
      tick();

      expect(component.showScimKey).toBe(false);
      expect(component.formData.get("clientSecret")!.value).toBe("••••••••••••••••");
      expect(dialogService.open).not.toHaveBeenCalled();
    }));

    it("opens the dialog with isRotation false when showScimKey is false", fakeAsync(() => {
      const mockDialogRef = {
        closed: of({ apiKey: "revealed-key" }),
      } as unknown as ReturnType<typeof dialogService.open>;
      dialogService.open.mockReturnValue(mockDialogRef);

      void component.loadApiKey();
      tick();

      expect(dialogService.open).toHaveBeenCalledWith(ScimApiKeyDialogComponent, {
        data: { organizationId: orgId, isRotation: false },
      });
      expect(component.formData.get("clientSecret")!.value).toBe("revealed-key");
      expect(component.showScimKey).toBe(true);
    }));

    it("does not update form when dialog is dismissed", fakeAsync(() => {
      const mockDialogRef = {
        closed: of(undefined),
      } as unknown as ReturnType<typeof dialogService.open>;
      dialogService.open.mockReturnValue(mockDialogRef);

      void component.loadApiKey();
      tick();

      expect(component.showScimKey).toBe(false);
      expect(component.formData.get("clientSecret")!.value).toBe("••••••••••••••••");
    }));
  });

  describe("rotateScimKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("opens the dialog with isRotation true and updates form on success", fakeAsync(() => {
      const mockDialogRef = {
        closed: of({ apiKey: "rotated-key" }),
      } as ReturnType<typeof dialogService.open>;
      dialogService.open.mockReturnValue(mockDialogRef);

      void component.rotateScimKey();
      tick();

      expect(dialogService.open).toHaveBeenCalledWith(ScimApiKeyDialogComponent, {
        data: { organizationId: orgId, isRotation: true },
      });
      expect(component.formData.get("clientSecret")!.value).toBe("rotated-key");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: null,
        message: "scimApiKeyRotated",
      });
    }));

    it("does not update form or show toast when dialog is dismissed", fakeAsync(() => {
      const mockDialogRef = {
        closed: of(undefined),
      } as ReturnType<typeof dialogService.open>;
      dialogService.open.mockReturnValue(mockDialogRef);

      void component.rotateScimKey();
      tick();

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
      void component.copyScimUrl();
      tick();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(scimUrl + "/" + orgId);
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "valueCopied",
        variant: "success",
        title: null,
      });
    }));
  });

  describe("copyScimKey", () => {
    beforeEach(fakeAsync(() => {
      initComponent(mockConnection(true));
      void component.load();
      tick();
    }));

    it("copies the client secret value to clipboard and shows toast", fakeAsync(() => {
      component.formData.patchValue({ clientSecret: "my-secret-key" });

      void component.copyScimKey();
      tick();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("my-secret-key");
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "valueCopied",
        variant: "success",
        title: null,
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
      testAccess(component).existingConnectionId = null;
      component.enabled.setValue(true);
      apiService.createOrganizationConnection.mockResolvedValue(mockConnection(true));

      void component.submit();
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
        title: null,
        message: "scimSettingsSaved",
      });
    }));

    it("updates an existing connection when connection id exists", fakeAsync(() => {
      component.existingConnectionId = "connection-id";
      component.enabled.setValue(false);
      apiService.updateOrganizationConnection.mockResolvedValue(mockConnection(false));

      void component.submit();
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
        title: null,
        message: "scimSettingsSaved",
      });
    }));
  });
});
