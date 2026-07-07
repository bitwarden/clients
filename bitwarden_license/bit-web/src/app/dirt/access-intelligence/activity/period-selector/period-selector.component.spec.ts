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
        past3Months: "Past 3 months",
        past6Months: "Past 6 months",
        pastYear: "Past year",
        allTime: "All time",
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
      TimePeriod.Past3Months,
      TimePeriod.Past6Months,
      TimePeriod.PastYear,
      TimePeriod.AllTime,
    ]);
    expect(options[0].label).toBe("Past month");
    expect(options[4].label).toBe("All time");
  });

  it("should update selected period and emit change", () => {
    const emitSpy = jest.fn();
    component.selectedPeriodChange.subscribe(emitSpy);

    component["selectPeriod"](TimePeriod.Past6Months);

    expect(component.selectedPeriod()).toBe(TimePeriod.Past6Months);
    expect(emitSpy).toHaveBeenCalledWith(TimePeriod.Past6Months);
  });

  it("should update selected label when period changes", () => {
    expect(component["selectedLabel"]()).toBe("Past month");

    component["selectPeriod"](TimePeriod.AllTime);
    expect(component["selectedLabel"]()).toBe("All time");
  });
});
