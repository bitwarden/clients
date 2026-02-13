import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  WebVaultExtensionPromptDialogComponent,
  WELCOME_EXTENSION_DIALOG_DISMISSED,
} from "./web-vault-extension-prompt-dialog.component";

describe("WebVaultExtensionPromptDialogComponent", () => {
  let component: WebVaultExtensionPromptDialogComponent;
  let fixture: ComponentFixture<WebVaultExtensionPromptDialogComponent>;
  let fakeStateProvider: FakeStateProvider;
  let mockDialogRef: MockProxy<DialogRef<void>>;

  const mockUserId = "test-user-id" as UserId;

  const getDevice = jest.fn(() => DeviceType.ChromeBrowser);

  beforeEach(async () => {
    const mockAccountService = mockAccountServiceWith(mockUserId);
    fakeStateProvider = new FakeStateProvider(mockAccountService);
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
        { provide: StateProvider, useValue: fakeStateProvider },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mock<DialogService>() },
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
    it("updates dismissed state to true", async () => {
      await component.dismissPrompt();

      const dismissedValue = await firstValueFrom(
        fakeStateProvider.getUser(mockUserId, WELCOME_EXTENSION_DIALOG_DISMISSED).state$,
      );
      expect(dismissedValue).toBe(true);
    });

    it("closes the dialog", async () => {
      await component.dismissPrompt();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
