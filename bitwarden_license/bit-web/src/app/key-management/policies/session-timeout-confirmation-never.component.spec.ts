import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { SessionTimeoutConfirmationNeverComponent } from "./session-timeout-confirmation-never.component";

describe("SessionTimeoutConfirmationNeverComponent", () => {
  let component: SessionTimeoutConfirmationNeverComponent;
  let fixture: ComponentFixture<SessionTimeoutConfirmationNeverComponent>;
  let mockDialogRef: jest.Mocked<DialogRef>;

  const mockI18nService = mock<I18nService>();
  const mockDialogService = mock<DialogService>();

  beforeEach(async () => {
    mockDialogRef = mock<DialogRef>();
    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    await TestBed.configureTestingModule({
      imports: [SessionTimeoutConfirmationNeverComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionTimeoutConfirmationNeverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("open", () => {
    it("should call dialogService.open with correct parameters", () => {
      const mockResult = mock<DialogRef>();
      mockDialogService.open.mockReturnValue(mockResult);

      const result = SessionTimeoutConfirmationNeverComponent.open(mockDialogService);

      expect(mockDialogService.open).toHaveBeenCalledWith(
        SessionTimeoutConfirmationNeverComponent,
        {
          disableClose: true,
        },
      );
      expect(result).toBe(mockResult);
    });
  });

  describe("button clicks", () => {
    it("should close dialog with true when Yes button is clicked", () => {
      const yesButton = fixture.nativeElement.querySelector(
        'button[buttonType="primary"]',
      ) as HTMLButtonElement;

      yesButton.click();

      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
      expect(yesButton.textContent?.trim()).toBe("yes-used-i18n");
    });

    it("should close dialog with false when No button is clicked", () => {
      const noButton = fixture.nativeElement.querySelector(
        'button[buttonType="secondary"]',
      ) as HTMLButtonElement;

      noButton.click();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
      expect(noButton.textContent?.trim()).toBe("no-used-i18n");
    });
  });
});
