import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { ImportResult } from "../../models";

import {
  ImportSuccessDialogComponent,
  ImportSuccessDialogData,
} from "./import-success-dialog.component";

const mockImportResult: ImportResult = Object.assign(new ImportResult(), {
  success: true,
  ciphers: [],
  folders: [],
  collections: [],
});

describe("ImportSuccessDialogComponent", () => {
  let fixture: ComponentFixture<ImportSuccessDialogComponent>;
  let mockRouter: ReturnType<typeof mock<Router>>;
  let mockDialogRef: ReturnType<typeof mock<DialogRef>>;

  async function setup(data: ImportSuccessDialogData) {
    mockRouter = mock<Router>();
    mockDialogRef = mock<DialogRef>();

    await TestBed.configureTestingModule({
      imports: [ImportSuccessDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: data },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: Router, useValue: mockRouter },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportSuccessDialogComponent);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  describe("when returnUrl and returnLabel are absent", () => {
    beforeEach(async () => {
      await setup({ importResult: mockImportResult });
    });

    it("shows OK button", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='ok-button']");
      expect(button).toBeTruthy();
    });

    it("does not show the return navigation button", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='return-button']");
      expect(button).toBeFalsy();
    });
  });

  describe("when returnUrl and returnLabel are both present", () => {
    beforeEach(async () => {
      await setup({
        importResult: mockImportResult,
        returnUrl: "/organizations/org-1/access-intelligence",
        returnLabel: "Go to Access Intelligence",
      });
    });

    it("shows the return button with the caller-supplied label", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='return-button']");
      expect(button).toBeTruthy();
      expect(button.textContent.trim()).toBe("Go to Access Intelligence");
    });

    it("does not show the OK button", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='ok-button']");
      expect(button).toBeFalsy();
    });

    it("closes the dialog then navigates on button click", async () => {
      const button = fixture.nativeElement.querySelector("[data-testid='return-button']");
      button.click();
      fixture.detectChanges();

      expect(mockDialogRef.close).toHaveBeenCalled();
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith(
        "/organizations/org-1/access-intelligence",
      );
    });
  });

  describe("when only returnUrl is present (no returnLabel)", () => {
    beforeEach(async () => {
      await setup({
        importResult: mockImportResult,
        returnUrl: "/organizations/org-1/access-intelligence",
      });
    });

    it("falls back to OK button", () => {
      const button = fixture.nativeElement.querySelector("[data-testid='ok-button']");
      expect(button).toBeTruthy();
    });
  });
});
