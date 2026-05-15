import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, DialogModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { WelcomeModalDialogComponent } from "./welcome-modal-dialog.components";

describe("WelcomeModalDialogComponent", () => {
  let component: WelcomeModalDialogComponent;
  let fixture: ComponentFixture<WelcomeModalDialogComponent>;

  beforeEach(async () => {
    const mockI18nService = {
      t: jest.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [WelcomeModalDialogComponent, TypographyModule, ButtonModule, DialogModule],
      providers: [{ provide: I18nService, useValue: mockI18nService }, I18nPipe],
    }).compileComponents();

    fixture = TestBed.createComponent(WelcomeModalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
