import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PeriodSelectorComponent } from "./period-selector.component";
import { DEFAULT_TIME_PERIOD, TimePeriod } from "./period-selector.types";

describe("PeriodSelectorComponent", () => {
  let component: PeriodSelectorComponent;
  let fixture: ComponentFixture<PeriodSelectorComponent>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        pastMonth: "Past month",
        last3Months: "Last 3 months",
        last6Months: "Last 6 months",
        last12Months: "Last 12 months",
        all: "All",
        timePeriod: "Time period",
      };
      return translations[key] ?? key;
    });

    await TestBed.configureTestingModule({
      imports: [PeriodSelectorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(PeriodSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should default to PastMonth", () => {
    expect(component.selectedPeriod()).toBe(DEFAULT_TIME_PERIOD);
    expect(component.selectedPeriod()).toBe(TimePeriod.PastMonth);
  });

  it("should have 5 period options with pre-translated labels", () => {
    const options = component["periodOptions"];
    expect(options).toHaveLength(5);
    expect(options.map((o) => o.value)).toEqual([
      TimePeriod.PastMonth,
      TimePeriod.Last3Months,
      TimePeriod.Last6Months,
      TimePeriod.Last12Months,
      TimePeriod.All,
    ]);
    expect(options[0].label).toBe("Past month");
    expect(options[4].label).toBe("All");
  });

  it("should update selected period", () => {
    component["selectPeriod"](TimePeriod.Last6Months);
    expect(component.selectedPeriod()).toBe(TimePeriod.Last6Months);
  });

  it("should update selected label when period changes", () => {
    expect(component["selectedLabel"]()).toBe("Past month");

    component["selectPeriod"](TimePeriod.All);
    expect(component["selectedLabel"]()).toBe("All");
  });
});
