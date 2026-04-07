import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationApiKeyType } from "@bitwarden/common/admin-console/enums";
import { OrganizationApiKeyRequest } from "@bitwarden/common/admin-console/models/request/organization-api-key.request";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { ApiKeyResponse } from "@bitwarden/common/auth/models/response/api-key.response";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ScimApiKeyDialogComponent, ScimApiKeyDialogData } from "./scim-api-key-dialog.component";

describe("ScimApiKeyDialogComponent", () => {
  const orgId = "org-id-123";
  const testAccess = (comp: ScimApiKeyDialogComponent) => comp as any;

  let dialogRef: MockProxy<DialogRef>;
  let userVerificationService: MockProxy<UserVerificationService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;

  function setupTestBed(data: ScimApiKeyDialogData) {
    dialogRef = mock<DialogRef>();
    userVerificationService = mock<UserVerificationService>();
    organizationApiService = mock<OrganizationApiServiceAbstraction>();

    const i18nPipe = mock<I18nPipe>();
    i18nPipe.transform.mockImplementation((key: string) => key);

    return TestBed.configureTestingModule({
      imports: [ScimApiKeyDialogComponent],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: data },
        { provide: UserVerificationService, useValue: userVerificationService },
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: I18nPipe, useValue: i18nPipe },
      ],
    }).compileComponents();
  }

  function setVerificationAndMockRequest(): OrganizationApiKeyRequest {
    const verification = { type: 0, secret: "password" } as unknown as Verification;
    component.formGroup.controls.verification.setValue(verification);

    const mockRequest = new OrganizationApiKeyRequest();
    userVerificationService.buildRequest.mockResolvedValue(mockRequest);
    return mockRequest;
  }

  let component: ScimApiKeyDialogComponent;
  let fixture: ComponentFixture<ScimApiKeyDialogComponent>;

  describe("non-rotation mode", () => {
    beforeEach(async () => {
      await setupTestBed({ organizationId: orgId, isRotation: false });
      fixture = TestBed.createComponent(ScimApiKeyDialogComponent);
      component = fixture.componentInstance;
    });

    it("isRotation returns false", () => {
      expect(component.isRotation).toBe(false);
    });

    it("marks form as touched and returns when form is invalid", async () => {
      const markSpy = jest.spyOn(component.formGroup, "markAllAsTouched");

      await component.submit();

      expect(markSpy).toHaveBeenCalled();
      expect(userVerificationService.buildRequest).not.toHaveBeenCalled();
    });

    it("calls getOrCreateApiKey and sets clientSecret", async () => {
      const mockRequest = setVerificationAndMockRequest();
      organizationApiService.getOrCreateApiKey.mockResolvedValue({
        apiKey: "test-api-key",
      } as ApiKeyResponse);

      await component.submit();

      expect(userVerificationService.buildRequest).toHaveBeenCalledWith(
        component.formGroup.controls.verification.value,
        OrganizationApiKeyRequest,
      );
      expect(mockRequest.type).toBe(OrganizationApiKeyType.Scim);
      expect(organizationApiService.getOrCreateApiKey).toHaveBeenCalledWith(orgId, mockRequest);
      expect(testAccess(component).clientSecret()).toBe("test-api-key");
    });

    it("closes with undefined when no clientSecret is set", () => {
      component.close();

      expect(dialogRef.close).toHaveBeenCalledWith(undefined);
    });

    it("closes with apiKey when clientSecret is set", async () => {
      setVerificationAndMockRequest();
      organizationApiService.getOrCreateApiKey.mockResolvedValue({
        apiKey: "test-key",
      } as ApiKeyResponse);

      await component.submit();
      component.close();

      expect(dialogRef.close).toHaveBeenCalledWith({ apiKey: "test-key" });
    });
  });

  describe("rotation mode", () => {
    beforeEach(async () => {
      await setupTestBed({ organizationId: orgId, isRotation: true });
      fixture = TestBed.createComponent(ScimApiKeyDialogComponent);
      component = fixture.componentInstance;
    });

    it("isRotation returns true", () => {
      expect(component.isRotation).toBe(true);
    });

    it("calls rotateApiKey and sets clientSecret", async () => {
      const mockRequest = setVerificationAndMockRequest();
      organizationApiService.rotateApiKey.mockResolvedValue({
        apiKey: "rotated-api-key",
      } as ApiKeyResponse);

      await component.submit();

      expect(organizationApiService.rotateApiKey).toHaveBeenCalledWith(orgId, mockRequest);
      expect(organizationApiService.getOrCreateApiKey).not.toHaveBeenCalled();
      expect(testAccess(component).clientSecret()).toBe("rotated-api-key");
    });
  });

  describe("open", () => {
    it("calls dialogService.open with correct arguments", () => {
      const service = mock<DialogService>();
      const data: ScimApiKeyDialogData = { organizationId: orgId, isRotation: true };

      ScimApiKeyDialogComponent.open(service, data);

      expect(service.open).toHaveBeenCalledWith(ScimApiKeyDialogComponent, { data });
    });
  });
});
