import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  CipherFormConfigService,
  CipherFormGenerationService,
  VaultItemsTransferService,
} from "@bitwarden/vault";

import { VaultItemDrawerComponent, VaultItemDrawerParams } from "./vault-item-drawer.component";

describe("VaultItemDrawerComponent", () => {
  let component: VaultItemDrawerComponent;
  let mockDialogRef: { close: jest.Mock };
  let mockDialogService: MockProxy<DialogService>;

  const params: VaultItemDrawerParams = {
    mode: "edit",
    allCollections: [],
  };

  beforeEach(async () => {
    mockDialogRef = { close: jest.fn() };
    mockDialogService = mock<DialogService>();

    await TestBed.configureTestingModule({
      providers: [
        VaultItemDrawerComponent,
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: AccountService, useValue: { activeAccount$: of(null) } },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: {} },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        {
          provide: CipherFormConfigService,
          useValue: { buildConfig: jest.fn().mockResolvedValue({}) },
        },
        { provide: ChangeLoginPasswordService, useValue: mock<ChangeLoginPasswordService>() },
        { provide: ViewPasswordHistoryService, useValue: mock<ViewPasswordHistoryService>() },
        { provide: CipherFormGenerationService, useValue: mock<CipherFormGenerationService>() },
        { provide: VaultItemsTransferService, useValue: mock<VaultItemsTransferService>() },
      ],
    }).compileComponents();

    component = TestBed.inject(VaultItemDrawerComponent);
  });

  const setFormDirty = (dirty: boolean) => {
    (component as any)["cipherFormRef"] = () => ({ isDirty: dirty });
  };

  describe("cancelCipher", () => {
    it("does not prompt when form is not dirty", async () => {
      setFormDirty(false);

      await component["cancelCipher"]();

      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("prompts and stays when user declines to leave", async () => {
      setFormDirty(true);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component["cancelCipher"]();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("prompts and proceeds when user confirms leaving", async () => {
      setFormDirty(true);
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      await component["cancelCipher"]();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe("closeDrawer", () => {
    it("closes without prompt when form is not dirty", async () => {
      setFormDirty(false);

      await component["closeDrawer"]();

      expect(mockDialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it("prompts and stays when user declines to leave", async () => {
      setFormDirty(true);
      mockDialogService.openSimpleDialog.mockResolvedValue(false);

      await component["closeDrawer"]();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it("prompts and closes when user confirms leaving", async () => {
      setFormDirty(true);
      mockDialogService.openSimpleDialog.mockResolvedValue(true);

      await component["closeDrawer"]();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
