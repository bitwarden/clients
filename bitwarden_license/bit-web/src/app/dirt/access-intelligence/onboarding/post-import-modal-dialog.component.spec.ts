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
import { LogService } from "@bitwarden/logging";

import { PostImportModalDialogComponent } from "./post-import-modal-dialog.component";
import { OnboardingService } from "./services/onboarding.service";

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
  setPostImportDialogAcknowledged: jest.fn().mockResolvedValue(undefined),
  isPostImportDialogAcknowledged: jest.fn().mockResolvedValue(false),
};

const mockLogger = {
  error: jest.fn(),
};

describe("PostImportModalDialogComponent", () => {
  let component: PostImportModalDialogComponent;
  let fixture: ComponentFixture<PostImportModalDialogComponent>;

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PostImportModalDialogComponent, TypographyModule, ButtonModule, DialogModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: OnboardingService, useValue: mockOnboardingService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: DIALOG_DATA, useValue: { organizationId: mockOrganizationId } },
        { provide: LogService, useValue: mockLogger },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostImportModalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("onSkip", () => {
    it("calls setPostImportDialogAcknowledged and closes the dialog", async () => {
      await component["onSkip"]();
      expect(mockOnboardingService.setPostImportDialogAcknowledged).toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
