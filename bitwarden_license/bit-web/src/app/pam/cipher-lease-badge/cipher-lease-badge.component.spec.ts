import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, TooltipDirective } from "@bitwarden/components";

import { CipherLeaseBadgeComponent } from "./cipher-lease-badge.component";

describe("CipherLeaseBadgeComponent", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CipherLeaseBadgeComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            cipherLeaseRequiresApproval: "Requires approval to view",
            cipherLeaseExpiresIn: "Leased — expires in __$1__",
          }),
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const create = (
    state: "unleased" | "gated_no_lease" | "gated_active_lease",
    leaseExpiresAt: Date | null = null,
  ): ComponentFixture<CipherLeaseBadgeComponent> => {
    const fixture = TestBed.createComponent(CipherLeaseBadgeComponent);
    fixture.componentRef.setInput("state", state);
    fixture.componentRef.setInput("leaseExpiresAt", leaseExpiresAt);
    fixture.detectChanges();
    return fixture;
  };

  const tooltipContent = (fixture: ComponentFixture<CipherLeaseBadgeComponent>): string =>
    fixture.debugElement
      .query(By.directive(TooltipDirective))
      .injector.get(TooltipDirective)
      .tooltipContent();

  it("renders nothing when state is 'unleased'", () => {
    const fixture = create("unleased");
    expect(fixture.nativeElement.textContent.trim()).toBe("");
  });

  it("renders the gated badge with clock icon and approval tooltip", () => {
    const fixture = create("gated_no_lease");

    const host = fixture.nativeElement.querySelector(
      '[data-testid="cipher-lease-badge-gated"]',
    ) as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.querySelector(".bwi-lock")).not.toBeNull();
    expect(host.querySelector(".bwi-clock")).not.toBeNull();
    expect(tooltipContent(fixture)).toBe("Requires approval to view");
  });

  it("renders the active badge with the countdown tooltip and label when state is 'gated_active_lease'", () => {
    const fixture = create("gated_active_lease", new Date(Date.now() + 47 * 60 * 1000));

    const host = fixture.nativeElement.querySelector(
      '[data-testid="cipher-lease-badge-active"]',
    ) as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.querySelector(".bwi-unlock")).not.toBeNull();

    const countdown = host.querySelector('[data-testid="cipher-lease-countdown"]') as HTMLElement;
    expect(countdown.textContent?.trim()).toBe("47m");
    expect(tooltipContent(fixture)).toBe("Leased — expires in 47m");
  });

  it("ticks the countdown each second while active", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const fixture = create("gated_active_lease", new Date("2026-01-01T00:00:10Z"));

    const countdown = (): string =>
      fixture.nativeElement
        .querySelector('[data-testid="cipher-lease-countdown"]')
        .textContent.trim();
    expect(countdown()).toBe("10s");

    jest.advanceTimersByTime(1000);
    fixture.detectChanges();
    expect(countdown()).toBe("9s");

    jest.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect(countdown()).toBe("4s");
  });

  it("does not register a ticker when state is not active", () => {
    const setIntervalSpy = jest.spyOn(window, "setInterval");
    create("gated_no_lease");
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it("clears the ticker on destroy", () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(window, "clearInterval");

    const fixture = create("gated_active_lease", new Date(Date.now() + 60000));
    fixture.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
