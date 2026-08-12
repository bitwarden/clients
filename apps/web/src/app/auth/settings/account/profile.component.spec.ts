import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { ProfileComponent } from "./profile.component";

describe("ProfileComponent", () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let apiService: ReturnType<typeof mock<ApiService>>;
  let toastService: ReturnType<typeof mock<ToastService>>;
  let accountService: FakeAccountService;

  const userId = "user-id" as UserId;

  function buildProfile(emailVerified: boolean): ProfileResponse {
    return new ProfileResponse({
      Id: userId,
      Name: "Test User",
      Email: "test@bitwarden.com",
      EmailVerified: emailVerified,
    });
  }

  beforeEach(async () => {
    apiService = mock<ApiService>();
    toastService = mock<ToastService>();
    accountService = mockAccountServiceWith(userId);

    apiService.getProfile.mockResolvedValue(buildProfile(false));

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: ApiService, useValue: apiService },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>({ organizations$: () => of([]) }),
        },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: ToastService, useValue: toastService },
        { provide: KeyService, useValue: mock<KeyService>({ userPublicKey$: () => of(null) }) },
        { provide: AvatarService, useValue: mock<AvatarService>({ avatarColor$: of(null) }) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
  });

  describe("email verification indicator", () => {
    it("shows the verified badge when the email is verified", async () => {
      apiService.getProfile.mockResolvedValue(buildProfile(true));

      await component.ngOnInit();
      fixture.detectChanges();

      const badge = fixture.debugElement.nativeElement.querySelector("[bitbadge]");
      const verifyButton = fixture.debugElement.nativeElement.querySelector(
        "#profile_button_verifyEmail",
      );

      expect(badge).not.toBeNull();
      expect(verifyButton).toBeNull();
    });

    it("shows the verify email button when the email is not verified", async () => {
      apiService.getProfile.mockResolvedValue(buildProfile(false));

      await component.ngOnInit();
      fixture.detectChanges();

      const badge = fixture.debugElement.nativeElement.querySelector("[bitbadge]");
      const verifyButton = fixture.debugElement.nativeElement.querySelector(
        "#profile_button_verifyEmail",
      );

      expect(badge).toBeNull();
      expect(verifyButton).not.toBeNull();
    });
  });

  describe("verifyEmail", () => {
    it("sends the verification email and shows a success toast", async () => {
      await component["verifyEmail"]();

      expect(apiService.postAccountVerifyEmail).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "checkInboxForVerification",
      });
    });
  });
});
