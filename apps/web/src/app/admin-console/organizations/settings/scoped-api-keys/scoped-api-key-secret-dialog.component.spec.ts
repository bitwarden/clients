import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { ScopedApiKeySecretDialogComponent } from "./scoped-api-key-secret-dialog.component";

describe("ScopedApiKeySecretDialogComponent", () => {
  const inputValue = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | null)?.value;

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [ScopedApiKeySecretDialogComponent],
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            name: "SIEM",
            clientId: "organization.org-id.key-id",
            clientSecret: "the-client-secret",
            scope: "api.organization.events.read api.organization.members.read",
          },
        },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScopedApiKeySecretDialogComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the client credentials needed to request a token", () => {
    expect(inputValue("scoped-api-key-secret-dialog_input_client-id")).toBe(
      "organization.org-id.key-id",
    );
    expect(inputValue("scoped-api-key-secret-dialog_input_client-secret")).toBe(
      "the-client-secret",
    );
    expect(inputValue("scoped-api-key-secret-dialog_input_scope")).toBe(
      "api.organization.events.read api.organization.members.read",
    );
    expect(inputValue("scoped-api-key-secret-dialog_input_grant-type")).toBe("client_credentials");
  });
});
