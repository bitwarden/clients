import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { PamWelcomeDialogComponent, PamWelcomeDialogResult } from "./pam-welcome-dialog.component";

describe("PamWelcomeDialogComponent", () => {
  let fixture: ComponentFixture<PamWelcomeDialogComponent>;
  let close: jest.Mock;

  const q = (selector: string): HTMLElement =>
    fixture.nativeElement.querySelector(selector) as HTMLElement;

  beforeEach(async () => {
    close = jest.fn().mockResolvedValue({ closed: true });

    await TestBed.configureTestingModule({
      imports: [PamWelcomeDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PamWelcomeDialogComponent);
    fixture.detectChanges();
  });

  it("renders the title, a short description and the illustration, with no checklist", () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("pamWelcomeTitle");
    expect(q("#pam-welcome-dialog_description").textContent).toContain("pamWelcomeDescription");
    expect(q("bit-svg")).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll("li")).toHaveLength(0);
  });

  it("closes with StartTour from the primary button", () => {
    q("#pam-welcome-dialog_button_start-tour").click();
    expect(close).toHaveBeenCalledWith(PamWelcomeDialogResult.StartTour);
  });

  it("closes with Dismissed from the secondary button", () => {
    q("#pam-welcome-dialog_button_dismiss").click();
    expect(close).toHaveBeenCalledWith(PamWelcomeDialogResult.Dismissed);
  });

  it("labels the dialog with its title and renders both buttons with their copy", () => {
    expect(q("[data-testid=bit-dialog-title]").textContent).toContain("pamWelcomeTitle");
    expect(q("#pam-welcome-dialog_button_start-tour").textContent).toContain("pamWelcomeStartTour");
    expect(q("#pam-welcome-dialog_button_dismiss").textContent).toContain("pamWelcomeDismiss");
  });

  it("puts the primary button before the secondary one", () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll("[bitDialogFooter] button"));
    expect(buttons.map((b) => (b as HTMLElement).id)).toEqual([
      "pam-welcome-dialog_button_start-tour",
      "pam-welcome-dialog_button_dismiss",
    ]);
  });

  describe("open", () => {
    it("opens centered and hands back the dialog's own ref", () => {
      const ref = { closed: new Subject() } as unknown as DialogRef<PamWelcomeDialogResult>;
      const dialogService = { open: jest.fn().mockReturnValue(ref) } as unknown as DialogService;

      expect(PamWelcomeDialogComponent.open(dialogService)).toBe(ref);
      expect(dialogService.open).toHaveBeenCalledWith(
        PamWelcomeDialogComponent,
        expect.objectContaining({ positionStrategy: expect.anything() }),
      );
    });
  });
});
