import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { LeasedPillComponent, formatRemaining } from "./leased-pill.component";

function i18nMock() {
  return new I18nMockService({
    leasedPillActiveLabel: "Leased — expires in __$1__",
    leasedPillActiveTooltip: "Active lease — expires in __$1__. Click to request extension.",
    leasedPillExtensionPendingLabel: "Extension pending",
    leasedPillExtensionPendingTooltip: "Extension request submitted. Awaiting approval.",
  });
}

describe("LeasedPillComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeasedPillComponent],
      providers: [{ provide: I18nService, useFactory: i18nMock }],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const create = (
    notAfter: string,
    extensionPending = false,
  ): ComponentFixture<LeasedPillComponent> => {
    const fixture = TestBed.createComponent(LeasedPillComponent);
    fixture.componentRef.setInput("notAfter", notAfter);
    fixture.componentRef.setInput("extensionPending", extensionPending);
    fixture.detectChanges();
    return fixture;
  };

  const countdown = (fixture: ComponentFixture<LeasedPillComponent>): string =>
    (
      fixture.debugElement.query(By.css('[data-testid="leased-pill-countdown"]'))
        ?.nativeElement as HTMLElement
    )?.textContent?.trim() ?? "";

  it("renders the countdown when active", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fixture = create("2026-01-01T00:10:00Z");

    expect(countdown(fixture)).toBe("10m");
  });

  it("renders 'extension pending' label when extensionPending is true", () => {
    const fixture = create(new Date(Date.now() + 5 * 60 * 1000).toISOString(), true);

    const pending = fixture.debugElement.query(
      By.css('[data-testid="leased-pill-extension-pending"]'),
    );
    expect(pending).not.toBeNull();
    expect(pending.nativeElement.textContent.trim()).toBe("Extension pending");
  });

  it("ticks the countdown at 1-second resolution", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fixture = create("2026-01-01T00:00:30Z");
    expect(countdown(fixture)).toBe("30s");

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(countdown(fixture)).toBe("29s");

    jest.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(countdown(fixture)).toBe("24s");
  });

  it("re-syncs the clock on visibilitychange when tab becomes visible", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fixture = create("2026-01-01T00:01:00Z");
    expect(countdown(fixture)).toBe("1m");

    // Advance system time but NOT via fake-timer tick, simulating a
    // background-throttled tab that missed ticks.
    jest.setSystemTime(new Date("2026-01-01T00:00:45Z"));

    // Simulate the tab becoming visible.
    document.dispatchEvent(new Event("visibilitychange"));
    fixture.detectChanges();

    expect(countdown(fixture)).toBe("15s");
  });

  it("does not update after the component is destroyed", () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(window, "clearInterval");

    const fixture = create(new Date(Date.now() + 60_000).toISOString());
    fixture.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("emits openExtension when the pill is clicked", () => {
    const fixture = create(new Date(Date.now() + 60_000).toISOString());
    const emitted: void[] = [];
    fixture.componentInstance.openExtension.subscribe(() => emitted.push());

    const btn = fixture.debugElement.query(By.css('[data-testid="leased-pill"]'));
    btn.nativeElement.click();

    expect(emitted).toHaveLength(1);
  });
});

describe("formatRemaining", () => {
  it("renders seconds when under a minute", () => {
    expect(formatRemaining(15_000)).toBe("15s");
    expect(formatRemaining(0)).toBe("0s");
    expect(formatRemaining(-5_000)).toBe("0s");
  });

  it("ceils to the next minute between 1 and 59 minutes", () => {
    expect(formatRemaining(60_000)).toBe("1m");
    expect(formatRemaining(60_500)).toBe("2m");
    expect(formatRemaining(46 * 60 * 1000 + 30_000)).toBe("47m");
  });

  it("renders hours and remainder minutes from 1 hour", () => {
    expect(formatRemaining(60 * 60 * 1000)).toBe("1h");
    expect(formatRemaining(75 * 60 * 1000)).toBe("1h 15m");
    expect(formatRemaining(125 * 60 * 1000)).toBe("2h 5m");
  });
});
