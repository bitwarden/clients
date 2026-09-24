import { Overlay } from "@angular/cdk/overlay";
import { TestBed } from "@angular/core/testing";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { openPasswordHistoryDialog } from "../components/password-history/password-history.component";

import { VaultViewPasswordHistoryService } from "./view-password-history.service";

jest.mock("../components/password-history/password-history.component", () => ({
  openPasswordHistoryDialog: jest.fn(),
}));

describe("VaultViewPasswordHistoryService", () => {
  let service: VaultViewPasswordHistoryService;
  let dialogService: DialogService;

  beforeEach(async () => {
    const mockDialogService = {
      open: jest.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        VaultViewPasswordHistoryService,
        { provide: DialogService, useValue: mockDialogService },
        Overlay,
      ],
    }).compileComponents();

    service = TestBed.inject(VaultViewPasswordHistoryService);
    dialogService = TestBed.inject(DialogService);
  });

  describe("viewPasswordHistory", () => {
    it("calls openPasswordHistoryDialog with the correct parameters", async () => {
      const mockCipher = { id: "cipher-id" } as CipherView;
      await service.viewPasswordHistory(mockCipher);
      expect(openPasswordHistoryDialog).toHaveBeenCalledWith(dialogService, {
        data: { cipher: mockCipher },
      });
    });
  });
});
