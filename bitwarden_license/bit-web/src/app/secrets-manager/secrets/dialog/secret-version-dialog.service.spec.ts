import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import { SecretView } from "../../models/view/secret.view";
import { SecretService } from "../secret.service";

import { SecretVersionDialogService } from "./secret-version-dialog.service";
import { SecretVersionDialogComponent } from "./secret-version.component";

const SomeOrganization = "da0eea55-8604-4307-8a24-b187015e3071" as OrganizationId;
const SomeSecretId = "9f1b60ac-0f6c-4b9a-9b1a-0a0f6c1b60ac";

function secretView(): SecretView {
  const secret = new SecretView();
  secret.id = SomeSecretId;
  secret.organizationId = SomeOrganization;
  secret.name = "Some secret";
  secret.value = "some value";
  secret.revisionDate = "2026-03-01T09:02:00.000Z";
  secret.write = true;
  return secret;
}

describe("SecretVersionDialogService", () => {
  let sut: SecretVersionDialogService;

  const dialogService = mock<DialogService>();
  const secretService = mock<SecretService>();
  const i18nService = mock<I18nService>();
  const logService = mock<LogService>();
  const toastService = mock<ToastService>();

  beforeEach(() => {
    jest.resetAllMocks();
    i18nService.t.mockImplementation((key) => key);

    TestBed.configureTestingModule({
      providers: [
        SecretVersionDialogService,
        { provide: DialogService, useValue: dialogService },
        { provide: SecretService, useValue: secretService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: ToastService, useValue: toastService },
      ],
    });

    sut = TestBed.inject(SecretVersionDialogService);
  });

  it("opens the drawer with the loaded secret", async () => {
    secretService.getBySecretId.mockResolvedValue(secretView());

    await sut.openVersionHistory(SomeOrganization, SomeSecretId);

    expect(secretService.getBySecretId).toHaveBeenCalledWith(SomeSecretId);
    expect(dialogService.openDrawer).toHaveBeenCalledWith(SecretVersionDialogComponent, {
      data: {
        organizationId: SomeOrganization,
        secretId: SomeSecretId,
        name: "Some secret",
        currentValue: "some value",
        revisionDate: "2026-03-01T09:02:00.000Z",
        canWrite: true,
      },
    });
  });

  it("shows an error toast and opens nothing when the secret cannot be loaded", async () => {
    const error = new Error("boom");
    secretService.getBySecretId.mockRejectedValue(error);

    await sut.openVersionHistory(SomeOrganization, SomeSecretId);

    expect(dialogService.openDrawer).not.toHaveBeenCalled();
    expect(logService.error).toHaveBeenCalledWith("Retrieving secret failed", error);
    expect(toastService.showToast).toHaveBeenCalledWith({
      variant: "error",
      message: "errorOccurred",
    });
  });
});
