import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogModule, DialogRef, TypographyModule } from "@bitwarden/components";

import { OnboardingService } from "./services/onboarding.service";
import { WelcomeModalDialogComponent } from "./welcome-modal-dialog.component";

const mockDialogRef = {
  close: jest.fn(),
  afterClosed: jest.fn().mockReturnValue(of(undefined)),
  closed: of(undefined),
} as unknown as import("@bitwarden/components").DialogRef<any, any>;

describe("WelcomeModalDialogComponent", () => {
  let component: WelcomeModalDialogComponent;
  let fixture: ComponentFixture<WelcomeModalDialogComponent>;

  beforeEach(async () => {
    const mockI18nService = {
      t: jest.fn((key: string) => key),
    };
    const mockOnboardingService = {
      setWelcomeDialogAcknowledged: jest.fn().mockResolvedValue(undefined),
      isWelcomeDialogAcknowledged: jest.fn().mockResolvedValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [WelcomeModalDialogComponent, TypographyModule, ButtonModule, DialogModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: DialogRef, useValue: mockDialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeModalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
