import { Pipe, PipeTransform } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { ProductType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ConfirmationDetailsComponent } from "./confirmation-details.component";

@Pipe({ name: "i18n", standalone: false })
class MockI18nPipe implements PipeTransform {
  transform(key: string, ...args: (string | number)[]): string {
    return [key, ...args].join(":");
  }
}

describe("ConfirmationDetailsComponent", () => {
  let component: ConfirmationDetailsComponent;
  let fixture: ComponentFixture<ConfirmationDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmationDetailsComponent, MockI18nPipe],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmationDetailsComponent);
    component = fixture.componentInstance;
    component.email = "test@example.com";
    component.orgLabel = "Teams";
    component.product = ProductType.PasswordManager;
  });

  describe("when trialLength is 0", () => {
    it("should not render the trial paid info message", () => {
      component.trialLength = 0;
      fixture.detectChanges();

      const listItems = fixture.debugElement.queryAll(By.css("li"));
      expect(listItems.length).toBe(1);
    });
  });

  describe("when trialLength is greater than 0", () => {
    it("should render the trial paid info message li", () => {
      component.trialLength = 7;
      fixture.detectChanges();

      const listItems = fixture.debugElement.queryAll(By.css("li"));
      expect(listItems.length).toBe(2);
    });

    it("should pass orgLabel and trialLength to the i18n pipe for trialPaidInfoMessageSpecificTrialLength", () => {
      component.trialLength = 14;
      fixture.detectChanges();

      const liText = fixture.debugElement
        .queryAll(By.css("li"))[1]
        .nativeElement.textContent.trim();
      expect(liText).toBe("trialPaidInfoMessageSpecificTrialLength:Teams:14");
    });

    it("should render the correct dynamic copy for trialLength = 30", () => {
      component.trialLength = 30;
      fixture.detectChanges();

      const liText = fixture.debugElement
        .queryAll(By.css("li"))[1]
        .nativeElement.textContent.trim();
      expect(liText).toBe("trialPaidInfoMessageSpecificTrialLength:Teams:30");
    });
  });
});
