import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
  DIALOG_DATA,
} from "@bitwarden/components";

import { OnboardingService } from "./services/onboarding.service";
import { WelcomeModalDialogComponent } from "./welcome-modal-dialog.component";

const mockOrganizationId = "test-org-id" as OrganizationId;

const mockDialogRef = {
  close: jest.fn().mockResolvedValue(undefined),
  afterClosed: jest.fn().mockReturnValue(of(undefined)),
  closed: of(undefined),
} as unknown as DialogRef<any, any>;

const mockDialogService = {
  open: jest.fn().mockReturnValue(mockDialogRef),
};

const mockOnboardingService = {
  setWelcomeDialogAcknowledged: jest.fn().mockResolvedValue(undefined),
  isWelcomeDialogAcknowledged: jest.fn().mockResolvedValue(false),
};

describe("WelcomeModalDialogComponent", () => {
  let component: WelcomeModalDialogComponent;
  let fixture: ComponentFixture<WelcomeModalDialogComponent>;

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [WelcomeModalDialogComponent, TypographyModule, ButtonModule, DialogModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeModalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("onSkip", () => {
    it("calls setWelcomeDialogAcknowledged and closes the dialog", async () => {
      await component["onSkip"]();
      expect(mockOnboardingService.setWelcomeDialogAcknowledged).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
