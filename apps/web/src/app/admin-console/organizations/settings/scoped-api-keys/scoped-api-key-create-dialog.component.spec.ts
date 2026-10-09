import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationScopedApiKeyCreateRequest } from "@bitwarden/common/admin-console/models/request/organization-scoped-api-key-create.request";
import { OrganizationScopedApiKeyCreatedResponse } from "@bitwarden/common/admin-console/models/response/organization-scoped-api-key-created.response";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { ScopedApiKeyCreateDialogComponent } from "./scoped-api-key-create-dialog.component";

const organizationId = "org-id";

describe("ScopedApiKeyCreateDialogComponent", () => {
  let component: ScopedApiKeyCreateDialogComponent;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let userVerificationService: MockProxy<UserVerificationService>;
  let dialogRef: MockProxy<DialogRef<OrganizationScopedApiKeyCreatedResponse>>;

  const form = () => component["formGroup"];

  const fillValidForm = () =>
    form().patchValue({
      name: "Directory sync",
      scopes: { membersWrite: true, groupsRead: true },
      verification: { type: VerificationType.MasterPassword, secret: "master-password" },
    });

  beforeEach(async () => {
    organizationApiService = mock<OrganizationApiServiceAbstraction>();
    userVerificationService = mock<UserVerificationService>();
    dialogRef = mock<DialogRef<OrganizationScopedApiKeyCreatedResponse>>();

    userVerificationService.buildRequest.mockImplementation(async () => {
      const request = new OrganizationScopedApiKeyCreateRequest();
      request.masterPasswordHash = "hash";
      return request;
    });

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ScopedApiKeyCreateDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { organizationId } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: OrganizationApiServiceAbstraction, useValue: organizationApiService },
        { provide: UserVerificationService, useValue: userVerificationService },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(ScopedApiKeyCreateDialogComponent, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    component = TestBed.createComponent(ScopedApiKeyCreateDialogComponent).componentInstance;
  });

  it("sends the selected scopes, name and verification to the server", async () => {
    fillValidForm();

    await component.submit();

    expect(organizationApiService.createScopedApiKey).toHaveBeenCalledWith(
      organizationId,
      expect.objectContaining({
        name: "Directory sync",
        scopes: ["api.organization.members.write", "api.organization.groups.read"],
        expireAt: undefined,
        masterPasswordHash: "hash",
      }),
    );
  });

  it("sends the expiration as an ISO timestamp", async () => {
    fillValidForm();
    form().patchValue({ expireAt: "2099-01-31T09:30" });

    await component.submit();

    expect(organizationApiService.createScopedApiKey.mock.calls[0][1].expireAt).toBe(
      new Date("2099-01-31T09:30").toISOString(),
    );
  });

  it("closes with the created key so the caller can show its secret", async () => {
    const created = new OrganizationScopedApiKeyCreatedResponse({ clientSecret: "secret" });
    organizationApiService.createScopedApiKey.mockResolvedValue(created);
    fillValidForm();

    await component.submit();

    expect(dialogRef.close).toHaveBeenCalledWith(created);
  });

  it("doesn't create a key when no scope is selected", async () => {
    fillValidForm();
    form().patchValue({ scopes: { membersWrite: false, groupsRead: false } });

    await component.submit();

    expect(organizationApiService.createScopedApiKey).not.toHaveBeenCalled();
  });

  it("doesn't create a key that has already expired", async () => {
    fillValidForm();
    form().patchValue({ expireAt: "2000-01-01T00:00" });

    await component.submit();

    expect(organizationApiService.createScopedApiKey).not.toHaveBeenCalled();
  });
});
