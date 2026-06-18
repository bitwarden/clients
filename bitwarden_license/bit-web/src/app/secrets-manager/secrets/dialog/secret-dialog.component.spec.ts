import { ChangeDetectorRef } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import { ProjectService } from "../../projects/project.service";
import { AccessPolicySelectorService } from "../../shared/access-policies/access-policy-selector/access-policy-selector.service";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { SecretService } from "../secret.service";

import { OperationType, SecretDialogComponent, SecretOperation } from "./secret-dialog.component";

describe("SecretDialogComponent", () => {
  let component: SecretDialogComponent;

  beforeEach(() => {
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(false));

    // Instantiate via DI (not createComponent) so `toSignal` has an injection
    // context, without compiling the dialog's heavy template.
    TestBed.configureTestingModule({
      providers: [
        SecretDialogComponent,
        { provide: DialogRef, useValue: mock<DialogRef>() },
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            operation: OperationType.Add,
            organizationEnabled: true,
          } as SecretOperation,
        },
        { provide: SecretService, useValue: mock<SecretService>() },
        { provide: ChangeDetectorRef, useValue: mock<ChangeDetectorRef>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ProjectService, useValue: mock<ProjectService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: AccessPolicyService, useValue: mock<AccessPolicyService>() },
        { provide: AccessPolicySelectorService, useValue: mock<AccessPolicySelectorService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: ConfigService, useValue: configService },
      ],
    });

    component = TestBed.inject(SecretDialogComponent);
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("onValueGenerated writes the value into the form and marks it dirty", () => {
    const valueControl = component["formGroup"].get("value")!;
    expect(valueControl.value).toBe("");
    expect(valueControl.dirty).toBe(false);

    component.onValueGenerated("generated-secret-value");

    expect(valueControl.value).toBe("generated-secret-value");
    expect(valueControl.dirty).toBe(true);
  });
});
