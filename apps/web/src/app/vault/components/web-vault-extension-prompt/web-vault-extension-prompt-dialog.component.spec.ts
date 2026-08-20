import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import { WebVaultExtensionPromptService } from "../../services/web-vault-extension-prompt.service";

import { WebVaultExtensionPromptDialogComponent } from "./web-vault-extension-prompt-dialog.component";

describe("WebVaultExtensionPromptDialogComponent", () => {
  let component: WebVaultExtensionPromptDialogComponent;
  let fixture: ComponentFixture<WebVaultExtensionPromptDialogComponent>;
  let mockDialogRef: MockProxy<DialogRef<void>>;

  const mockUserId = "test-user-id" as UserId;

  const getDevice = jest.fn(() => DeviceType.ChromeBrowser);
  const mockUpdate = jest.fn().mockResolvedValue(undefined);

  const getDialogDismissedState = jest.fn().mockReturnValue({
    update: mockUpdate,
  });

  beforeEach(async () => {
    const mockAccountService = mockAccountServiceWith(mockUserId);
    mockDialogRef = mock<DialogRef<void>>();

    await TestBed.configureTestingModule({
      imports: [WebVaultExtensionPromptDialogComponent],
      providers: [
        provideNoopAnimations(),
        {
          provide: PlatformUtilsService,
          useValue: { getDevice },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: WebVaultExtensionPromptService,
          useValue: { getDialogDismissedState },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WebVaultExtensionPromptDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("ngOnInit", () => {
    it("sets webStoreUrl", () => {
      expect(getDevice).toHaveBeenCalled();

      expect(component["webStoreUrl"]).toBe(
        "https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb",
      );
    });
  });

  describe("dismissPrompt", () => {
    it("calls webVaultExtensionPromptService.getDialogDismissedState and updates to true", async () => {
      await component.dismissPrompt();

      expect(getDialogDismissedState).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdate).toHaveBeenCalledWith(expect.any(Function));

      const updateFn = mockUpdate.mock.calls[0][0];
      expect(updateFn()).toBe(true);
    });

    it("closes the dialog", async () => {
      await component.dismissPrompt();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
