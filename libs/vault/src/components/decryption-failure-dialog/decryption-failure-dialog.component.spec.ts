import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import {
  DecryptionFailureDialogComponent,
  DecryptionFailureDialogParams,
} from "./decryption-failure-dialog.component";

describe("DecryptionFailureDialogComponent", () => {
  let fixture: ComponentFixture<DecryptionFailureDialogComponent>;
  let dialogRef: MockProxy<DialogRef>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;

  const realMatchMedia = window.matchMedia;

  /** Drives `isAtOrLargerThanBreakpointSignal`, which the component reads to pick its dialog shell. */
  const setViewportMatchesBreakpoint = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  };

  const buildComponent = async (cipherIds: string[]) => {
    const params: DecryptionFailureDialogParams = { cipherIds: cipherIds as CipherId[] };

    dialogRef = mock<DialogRef>();
    platformUtilsService = mock<PlatformUtilsService>();

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [DecryptionFailureDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DecryptionFailureDialogComponent);
    fixture.detectChanges();
  };

  const textContent = () => fixture.nativeElement.textContent as string;

  const buttonWithText = (text: string) =>
    Array.from(fixture.nativeElement.querySelectorAll("button") as NodeListOf<HTMLButtonElement>)
      // The i18n mock renders keys, so the button text is the message key
      .find((button) => button.textContent?.trim() === text);

  beforeEach(() => {
    setViewportMatchesBreakpoint(true);
  });

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    TestBed.resetTestingModule();
  });

  describe("a single failed item", () => {
    beforeEach(async () => {
      await buildComponent(["cipher-1"]);
    });

    it("shows the singular description and label", () => {
      expect(textContent()).toContain("couldNotDecryptVaultItem");
      expect(textContent()).not.toContain("couldNotDecryptVaultItems");
      expect(textContent()).toContain("itemId");
    });

    it("lists the item id", () => {
      expect(textContent()).toContain("cipher-1");
    });

    it("copies the single id", () => {
      buttonWithText("copyId")!.click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("cipher-1");
    });
  });

  describe("multiple failed items", () => {
    beforeEach(async () => {
      await buildComponent(["cipher-1", "cipher-2"]);
    });

    it("shows the plural description and label", () => {
      expect(textContent()).toContain("couldNotDecryptVaultItems");
      expect(textContent()).toContain("itemIds");
    });

    it("copies every id, newline separated", () => {
      buttonWithText("copyAllIds")!.click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("cipher-1\ncipher-2");
    });
  });

  it("associates the item id list with its label", async () => {
    await buildComponent(["cipher-1"]);

    const label = fixture.nativeElement.querySelector("[id^='decryption-failure-item-ids-']");
    const list = fixture.nativeElement.querySelector("[role='group']");

    expect(label).not.toBeNull();
    expect(list.getAttribute("aria-labelledby")).toBe(label.id);
  });

  describe("dialog shell", () => {
    it("uses the standard dialog at or above the md breakpoint", async () => {
      setViewportMatchesBreakpoint(true);

      await buildComponent(["cipher-1"]);

      expect(fixture.nativeElement.querySelector("bit-dialog")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-simple-dialog")).toBeNull();
    });

    it("uses the simple dialog below the md breakpoint, where the standard dialog would be too wide", async () => {
      setViewportMatchesBreakpoint(false);

      await buildComponent(["cipher-1"]);

      expect(fixture.nativeElement.querySelector("bit-simple-dialog")).not.toBeNull();
      expect(fixture.nativeElement.querySelector("bit-dialog")).toBeNull();
    });
  });

  it("closes the dialog", async () => {
    await buildComponent(["cipher-1"]);

    buttonWithText("close")!.click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
