// IntersectionObserver is not available in JSDOM; mock it so DialogComponent scroll detection doesn't throw.
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { CipherFormConfig } from "../cipher-form";

import {
  VaultItemDialogComponent,
  VaultItemDialogParams,
  VaultItemDialogResult,
} from "./vault-item-dialog.component";

describe("VaultItemDialogComponent", () => {
  let component: VaultItemDialogComponent;
  let fixture: ComponentFixture<VaultItemDialogComponent>;

  const close = jest.fn();
  const dialogRef = { close };

  const mockDialogService = {
    open: jest.fn(),
    openDrawer: jest.fn(),
    openSimpleDialog: jest.fn().mockResolvedValue(true),
  };

  const baseFormConfig: Partial<CipherFormConfig> = {
    mode: "edit",
    cipherType: CipherType.Login,
    collections: [],
    organizations: [],
    admin: false,
    originalCipher: null,
  };

  const baseParams: VaultItemDialogParams = {
    mode: "view",
    formConfig: baseFormConfig as CipherFormConfig,
    isAdminConsoleAction: false,
    restore: undefined,
  };

  beforeEach(async () => {
    close.mockClear();
    mockDialogService.open.mockClear();
    mockDialogService.openDrawer.mockClear();

    await TestBed.configureTestingModule({
      imports: [VaultItemDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { ...baseParams, formConfig: { ...baseFormConfig } } },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: MessagingService, useValue: { send: jest.fn() } },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "test-user-id" as any }) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)) },
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: { upgradeConfirmed$: of(false), promptForPremium: jest.fn() },
        },
        { provide: CipherAuthorizationService, useValue: mock<CipherAuthorizationService>() },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        {
          provide: CipherArchiveService,
          useValue: {
            hasArchiveFlagEnabled$: of(false),
            userCanArchive$: jest.fn().mockReturnValue(of(false)),
          },
        },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(VaultItemDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("closes the dialog on cancel in view mode", async () => {
    await component.cancel();

    expect(close).toHaveBeenCalledWith(undefined);
  });

  it("closes the dialog with Saved on cancel when cipher was modified", async () => {
    component["_cipherModified"] = true;

    await component.cancel();

    expect(close).toHaveBeenCalledWith(VaultItemDialogResult.Saved);
  });

  describe("static open()", () => {
    it("calls dialogService.open with VaultItemDialogComponent", () => {
      const fakeDialogService = { open: jest.fn() } as any;

      VaultItemDialogComponent.open(fakeDialogService, baseParams);

      expect(fakeDialogService.open).toHaveBeenCalledWith(VaultItemDialogComponent, {
        data: baseParams,
      });
    });
  });

  describe("static openDrawer()", () => {
    it("calls dialogService.openDrawer with VaultItemDialogComponent", () => {
      const fakeDialogService = { openDrawer: jest.fn() } as any;

      VaultItemDialogComponent.openDrawer(fakeDialogService, baseParams);

      expect(fakeDialogService.openDrawer).toHaveBeenCalledWith(VaultItemDialogComponent, {
        data: baseParams,
      });
    });
  });
});
