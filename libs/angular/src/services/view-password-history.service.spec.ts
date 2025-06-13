import { Overlay } from "@angular/cdk/overlay";
import { TestBed } from "@angular/core/testing";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { openPasswordHistoryDialog } from "@bitwarden/vault";

import { VaultViewPasswordHistoryService } from "./view-password-history.service";

jest.mock("@bitwarden/vault", () => ({
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
