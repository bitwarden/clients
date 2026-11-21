import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { provideRouter, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
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
  let navigate: jest.SpyInstance;

  const realMatchMedia = window.matchMedia;

  /** Drives `isAtOrLargerThanBreakpointSignal`, which the component reads to pick its dialog shell. */
  const setViewportMatchesBreakpoint = (matches: boolean) => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;
  };

  const buildComponent = async (cipherIds: string[], clientType = ClientType.Browser) => {
    const params: DecryptionFailureDialogParams = { cipherIds: cipherIds as CipherId[] };

    dialogRef = mock<DialogRef>();
    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(clientType);

    const environmentService = mock<EnvironmentService>();
    // A plain object, not `mock<Environment>()`: the mock proxy exposes `then`, so awaiting it hangs
    environmentService.environment$ = of({
      getWebVaultUrl: () => "https://vault.example.com",
    } as Environment);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [DecryptionFailureDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: EnvironmentService, useValue: environmentService },
        provideRouter([]),
        { provide: ToastService, useValue: mock<ToastService>() },
      ],
    }).compileComponents();

    navigate = jest.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);

    fixture = TestBed.createComponent(DecryptionFailureDialogComponent);
    fixture.detectChanges();
  };

  const textContent = () => fixture.nativeElement.textContent as string;

  const buttonWithText = (text: string) =>
    Array.from(fixture.nativeElement.querySelectorAll("button") as NodeListOf<HTMLButtonElement>)
      // The i18n mock renders keys, so the button text is the message key
      .find((button) => button.textContent?.trim() === text);

  /** The copy action is an icon button with no visible text. */
  const copyButton = () =>
    fixture.nativeElement.querySelector(
      "#decryption-failure-dialog_button_copy-ids",
    ) as HTMLButtonElement;

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
      expect(textContent()).toContain("couldNotDecryptVaultItemUseDataRecovery");
      expect(textContent()).not.toContain("couldNotDecryptVaultItemsUseDataRecovery");
      expect(textContent()).toContain("itemId");
    });

    it("lists the item id", () => {
      expect(textContent()).toContain("cipher-1");
    });

    it("copies the single id", () => {
      expect(copyButton().getAttribute("aria-label")).toBe("copyId");

      copyButton().click();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("cipher-1");
    });
  });

  describe("multiple failed items", () => {
    beforeEach(async () => {
      await buildComponent(["cipher-1", "cipher-2"]);
    });

    it("shows the plural description and label", () => {
      expect(textContent()).toContain("couldNotDecryptVaultItemsUseDataRecovery");
      expect(textContent()).toContain("itemIds");
    });

    it("copies every id, newline separated", () => {
      expect(copyButton().getAttribute("aria-label")).toBe("copyAllIds");

      copyButton().click();

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

  describe("data recovery call to action", () => {
    const callToAction = () => buttonWithText("goToDataRecoveryTool");

    it.each([
      ["standard", true],
      ["simple", false],
    ])("is the primary button in the %s dialog", async (_, matchesBreakpoint) => {
      setViewportMatchesBreakpoint(matchesBreakpoint);

      await buildComponent(["cipher-1"]);

      expect(callToAction()).toBeDefined();
      expect(callToAction()!.getAttribute("buttontype")).toBe("primary");
      expect(copyButton()).not.toBeNull();
      expect(buttonWithText("copyId")).toBeUndefined();
    });

    it.each([ClientType.Browser, ClientType.Desktop])(
      "opens the web vault's data recovery page from %s",
      async (clientType) => {
        await buildComponent(["cipher-1"], clientType);

        callToAction()!.click();
        // Let the handler resolve the environment before asserting
        await new Promise(process.nextTick);

        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
          "https://vault.example.com/#/settings/data-recovery",
        );
        expect(dialogRef.close).toHaveBeenCalledWith(false);
        expect(navigate).not.toHaveBeenCalled();
      },
    );

    it("navigates to the data recovery page in place on web, keeping the current session", async () => {
      await buildComponent(["cipher-1"], ClientType.Web);

      callToAction()!.click();
      await new Promise(process.nextTick);

      expect(dialogRef.close).toHaveBeenCalledWith(false);
      expect(navigate).toHaveBeenCalledWith(["/settings/data-recovery"]);
      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
    });
  });

  it("closes the dialog", async () => {
    await buildComponent(["cipher-1"]);

    buttonWithText("close")!.click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
