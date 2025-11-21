import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import mock, { MockProxy } from "jest-mock-extended/lib/Mock";
import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorProviderResponse } from "@bitwarden/common/auth/models/response/two-factor-provider.response";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { ChangeEmailComponent } from "@bitwarden/web-vault/app/auth/settings/account/change-email.component";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

describe("ChangeEmailComponent", () => {
  let component: ChangeEmailComponent;
  let fixture: ComponentFixture<ChangeEmailComponent>;

  let apiService: MockProxy<ApiService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let accountService: FakeAccountService;
  let keyService: MockProxy<KeyService>;
  let kdfConfigService: MockProxy<KdfConfigService>;

  beforeEach(async () => {
    apiService = mock<ApiService>();
    twoFactorService = mock<TwoFactorService>();
    keyService = mock<KeyService>();
    kdfConfigService = mock<KdfConfigService>();
    accountService = mockAccountServiceWith("UserId" as UserId);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, SharedModule, ChangeEmailComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: ApiService, useValue: apiService },
        { provide: TwoFactorService, useValue: twoFactorService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: KeyService, useValue: keyService },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: KdfConfigService, useValue: kdfConfigService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: FormBuilder, useClass: FormBuilder },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangeEmailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates component", () => {
    expect(component).toBeTruthy();
  });

  describe("ngOnInit", () => {
    beforeEach(() => {
      twoFactorService.getEnabledTwoFactorProviders.mockResolvedValue({
        data: [{ type: TwoFactorProviderType.Email, enabled: true } as TwoFactorProviderResponse],
      } as ListResponse<TwoFactorProviderResponse>);
    });

    it("initializes userId", async () => {
      await component.ngOnInit();
      expect(component.userId).toBe("UserId");
    });

    it("errors if there is no active user", async () => {
      // clear active account
      await firstValueFrom(accountService.activeAccount$);
      accountService.activeAccountSubject.next(null);

      await expect(() => component.ngOnInit()).rejects.toThrow("Null or undefined account");
    });

    it("initializes showTwoFactorEmailWarning", async () => {
      await component.ngOnInit();
      expect(component.showTwoFactorEmailWarning).toBe(true);
    });
  });

  describe("submit", () => {
    beforeEach(() => {
      component.formGroup.controls.step1.setValue({
        masterPassword: "password",
        newEmail: "test@example.com",
      });

      keyService.getOrDeriveMasterKey
        .calledWith("password", "UserId" as UserId)
        .mockResolvedValue("getOrDeriveMasterKey" as any);
      keyService.hashMasterKey
        .calledWith("password", "getOrDeriveMasterKey" as any)
        .mockResolvedValue("existingHash");
    });

    it("throws if userId is null on submit", async () => {
      component.userId = undefined;

      await expect(component.submit()).rejects.toThrow("Can't find user");
    });

    describe("step 1", () => {
      it("does not submit if step 1 is invalid", async () => {
        component.formGroup.controls.step1.setValue({
          masterPassword: "",
          newEmail: "",
        });

        await component.submit();

        expect(apiService.postEmailToken).not.toHaveBeenCalled();
      });

      it("sends email token in step 1 if tokenSent is false", async () => {
        await component.submit();

        expect(apiService.postEmailToken).toHaveBeenCalledWith({
          newEmail: "test@example.com",
          masterPasswordHash: "existingHash",
        });
        // should activate step 2
        expect(component.tokenSent).toBe(true);
        expect(component.formGroup.controls.step1.disabled).toBe(true);
        expect(component.formGroup.controls.token.enabled).toBe(true);
      });
    });

    describe("step 2", () => {
      beforeEach(() => {
        component.tokenSent = true;
        component.formGroup.controls.step1.disable();
        component.formGroup.controls.token.enable();
        component.formGroup.controls.token.setValue("token");

        kdfConfigService.getKdfConfig$
          .calledWith("UserId" as any)
          .mockReturnValue(of("kdfConfig" as any));
        keyService.userKey$.calledWith("UserId" as any).mockReturnValue(of("userKey" as any));

        keyService.makeMasterKey
          .calledWith("password", "test@example.com", "kdfConfig" as any)
          .mockResolvedValue("newMasterKey" as any);
        keyService.hashMasterKey
          .calledWith("password", "newMasterKey" as any)
          .mockResolvedValue("newMasterKeyHash");

        // Important: make sure this is called with new master key, not existing
        keyService.encryptUserKeyWithMasterKey
          .calledWith("newMasterKey" as any, "userKey" as any)
          .mockResolvedValue(["userKey" as any, { encryptedString: "newEncryptedUserKey" } as any]);
      });

      it("does not post email if token is missing on submit", async () => {
        component.formGroup.controls.token.setValue("");

        await component.submit();

        expect(apiService.postEmail).not.toHaveBeenCalled();
      });

      it("throws if kdfConfig is missing on submit", async () => {
        kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

        await expect(component.submit()).rejects.toThrow("Missing kdf config");
      });

      it("throws if userKey can't be found", async () => {
        keyService.userKey$.mockReturnValue(of(null));

        await expect(component.submit()).rejects.toThrow("Can't find UserKey");
      });

      it("throws if encryptedUserKey is missing", async () => {
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue(["userKey" as any, null as any]);

        await expect(component.submit()).rejects.toThrow("Missing Encrypted User Key");
      });

      it("submits if step 2 is valid", async () => {
        await component.submit();

        // validate that hashes are correct
        expect(apiService.postEmail).toHaveBeenCalledWith({
          masterPasswordHash: "existingHash",
          newMasterPasswordHash: "newMasterKeyHash",
          token: "token",
          newEmail: "test@example.com",
          key: "newEncryptedUserKey",
        });
      });
    });
  });
});
