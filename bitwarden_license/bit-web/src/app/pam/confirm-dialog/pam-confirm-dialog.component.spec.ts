import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

import { PamConfirmDialogComponent, PamConfirmDialogParams } from "./pam-confirm-dialog.component";

const params: PamConfirmDialogParams = {
  title: { key: "confirmTitle" },
  content: { key: "confirmContent", placeholders: ["Prod database"] },
  acceptButtonText: { key: "delete" },
  cancelButtonText: { key: "cancel" },
  icon: "bwi-clear",
  iconClass: "tw-text-danger",
  acceptButtonType: "primary",
};

describe("PamConfirmDialogComponent", () => {
  let fixture: ComponentFixture<PamConfirmDialogComponent>;
  const close = jest.fn();

  async function create(overrides: Partial<PamConfirmDialogParams> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [PamConfirmDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { ...params, ...overrides } },
        { provide: DialogRef, useValue: { close } },
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PamConfirmDialogComponent);
    fixture.detectChanges();
  }

  function button(id: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`#${id}`);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it("renders the glyph in the colour the params ask for, not one derived from the button", async () => {
    await create();

    const icon: HTMLElement = fixture.nativeElement.querySelector("[bitDialogIcon]");
    expect(icon.classList).toContain("bwi");
    expect(icon.classList).toContain("bwi-clear");
    expect(icon.classList).toContain("tw-text-danger");
    expect(icon.classList).toContain("tw-text-3xl");
  });

  it("renders a primary accept button beside that danger glyph", async () => {
    await create();

    const accept = button("pam-confirm-dialog_button_accept");
    expect(accept.classList).toContain("tw-bg-bg-brand");
    expect(accept.classList).not.toContain("tw-bg-bg-danger");
  });

  it("localizes the title and content, passing the content placeholders through", async () => {
    await create();

    expect(fixture.nativeElement.textContent).toContain("confirmTitle");
    expect(fixture.nativeElement.textContent).toContain("confirmContent Prod database");
  });

  it("closes with true when accepted and false when cancelled", async () => {
    await create();

    button("pam-confirm-dialog_button_accept").click();
    expect(close).toHaveBeenCalledWith(true);

    close.mockClear();
    button("pam-confirm-dialog_button_cancel").click();
    expect(close).toHaveBeenCalledWith(false);
  });

  describe("open", () => {
    function dialogService(closed: boolean | undefined): DialogService {
      return {
        open: jest.fn().mockReturnValue({ closed: of(closed) }),
      } as unknown as DialogService;
    }

    it("resolves true when the dialog closes with true", async () => {
      await expect(PamConfirmDialogComponent.open(dialogService(true), params)).resolves.toBe(true);
    });

    it("resolves false when the dialog closes with false", async () => {
      await expect(PamConfirmDialogComponent.open(dialogService(false), params)).resolves.toBe(
        false,
      );
    });

    it("resolves false when the dialog is dismissed without an answer", async () => {
      await expect(PamConfirmDialogComponent.open(dialogService(undefined), params)).resolves.toBe(
        false,
      );
    });
  });
});
