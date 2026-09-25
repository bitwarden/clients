import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AccessBadgeState } from "@bitwarden/bit-common/pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AccessStateBadgeComponent, AccessStateBadgeDisplay } from "./access-state-badge.component";

describe("AccessStateBadgeComponent", () => {
  let fixture: ComponentFixture<AccessStateBadgeComponent>;
  let component: AccessStateBadgeComponent;

  function create(state: AccessBadgeState | null, display: AccessStateBadgeDisplay = "full"): void {
    fixture = TestBed.createComponent(AccessStateBadgeComponent);
    fixture.componentRef.setInput("state", state);
    fixture.componentRef.setInput("display", display);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AccessStateBadgeComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("renders nothing when there is no state", () => {
    create(null);
    expect(component["recipe"]()).toBeNull();
    expect(fixture.nativeElement.textContent.trim()).toBe("");
    expect(fixture.nativeElement.querySelector("bit-badge")).toBeNull();
  });

  it.each([
    ["privileged", "primary", "bwi-key", "pamAccessBadgePrivileged"],
    ["pending", "warning", "bwi-clock", "pamAccessBadgePending"],
    ["unavailable", "subtle", "bwi-lock", "pamAccessBadgeUnavailable"],
    ["ready", "success", "bwi-check", "pamAccessBadgeReady"],
    ["expired", "subtle", "bwi-lock", "pamAccessBadgeEnded"],
  ])("maps the %s state to its badge recipe", (kind, variant, icon, label) => {
    create({ kind } as AccessBadgeState);

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe(variant);
    expect(recipe.icon).toBe(icon);
    expect(recipe.label).toBe(label);
  });

  it("shows the accent countdown above the 5-minute threshold", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() + 18 * 60_000) });

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe("accent-primary");
    expect(recipe.icon).toBe("bwi-unlock");
    expect(recipe.label).toContain("pamAccessBadgeTimeLeft");
  });

  it("escalates to the danger 'Ending soon' badge below the threshold", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() + 3 * 60_000) });

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe("danger");
    expect(recipe.icon).toBe("bwi-exclamation-triangle");
    expect(recipe.label).toContain("pamAccessBadgeEndingSoon");
  });

  it("shows the expired badge once an active lease has lapsed, never a live countdown", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() - 1_000) });

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe("subtle");
    expect(recipe.label).toBe("pamAccessBadgeEnded");
  });

  it("shows the full countdown as its text, tooltip and accessible name by default", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() + (3 * 60 + 37) * 60_000) });

    const badge = fixture.nativeElement.querySelector("bit-badge") as HTMLElement;
    expect(badge.textContent.trim()).toBe("pamAccessBadgeTimeLeft 3h 37m");
    expect(badge.getAttribute("title")).toBe("pamAccessBadgeTimeLeft 3h 37m");
    expect(badge.getAttribute("aria-label")).toBe("pamAccessBadgeTimeLeft 3h 37m");
  });

  describe("compact display", () => {
    function badge(): HTMLElement {
      return fixture.nativeElement.querySelector("bit-badge") as HTMLElement;
    }

    it.each([
      ["over an hour", (3 * 60 + 37) * 60_000, "3h", "pamAccessBadgeTimeLeft 3h 37m"],
      ["on the hour", 2 * 60 * 60_000, "2h", "pamAccessBadgeTimeLeft 2h"],
      ["under an hour", 37 * 60_000, "37m", "pamAccessBadgeTimeLeft 37m"],
      ["under a minute", 30_000, "<1m", "pamAccessBadgeEndingSoon 30s"],
    ])("shows only the largest unit %s", (_, remainingMs, text, label) => {
      create({ kind: "active", expiresAt: new Date(Date.now() + remainingMs) }, "compact");

      expect(badge().textContent.trim()).toBe(text);
      expect(badge().getAttribute("title")).toBe(label);
      expect(badge().getAttribute("aria-label")).toBe(label);
    });

    it("keeps the unlock icon and accent variant above the threshold", () => {
      create({ kind: "active", expiresAt: new Date(Date.now() + 18 * 60_000) }, "compact");

      const recipe = component["recipe"]()!;
      expect(recipe.variant).toBe("accent-primary");
      expect(recipe.icon).toBe("bwi-unlock");
      expect(recipe.testId).toBe("access-state-badge-active");
    });

    it("keeps the ending-soon escalation below the threshold", () => {
      create({ kind: "active", expiresAt: new Date(Date.now() + 3 * 60_000) }, "compact");

      const recipe = component["recipe"]()!;
      expect(recipe.variant).toBe("danger");
      expect(recipe.icon).toBe("bwi-exclamation-triangle");
      expect(recipe.testId).toBe("access-state-badge-ending-soon");
      expect(badge().textContent.trim()).toBe("3m");
      expect(badge().getAttribute("aria-label")).toBe("pamAccessBadgeEndingSoon 3m");
    });

    it.each([
      ["privileged", "pamAccessBadgePrivileged"],
      ["pending", "pamAccessBadgePending"],
      ["unavailable", "pamAccessBadgeUnavailable"],
      ["ready", "pamAccessBadgeReady"],
      ["expired", "pamAccessBadgeEnded"],
    ])("keeps the %s label unchanged", (kind, label) => {
      create({ kind } as AccessBadgeState, "compact");

      expect(badge().textContent.trim()).toBe(label);
      expect(badge().getAttribute("aria-label")).toBe(label);
    });

    it("shows the ended pill once the lease lapses", () => {
      create({ kind: "active", expiresAt: new Date(Date.now() - 1_000) }, "compact");

      expect(badge().textContent.trim()).toBe("pamAccessBadgeEnded");
    });
  });
});

describe("AccessStateBadgeComponent timer sharing", () => {
  const fixtures: ComponentFixture<AccessStateBadgeComponent>[] = [];

  function createBadge(
    state: AccessBadgeState | null,
  ): ComponentFixture<AccessStateBadgeComponent> {
    const created = TestBed.createComponent(AccessStateBadgeComponent);
    created.componentRef.setInput("state", state);
    created.detectChanges();
    fixtures.push(created);
    return created;
  }

  function activeState(): AccessBadgeState {
    return { kind: "active", expiresAt: new Date(Date.now() + 30 * 60_000) };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [AccessStateBadgeComponent],
      providers: [
        {
          provide: I18nService,
          useValue: { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") },
        },
      ],
    });
  });

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()!.destroy();
    }
    jest.useRealTimers();
  });

  it("starts no timer when every badge is resting", () => {
    const setInterval = jest.spyOn(global, "setInterval");

    createBadge({ kind: "privileged" });
    createBadge({ kind: "pending" });
    createBadge(null);

    expect(setInterval).not.toHaveBeenCalled();
  });

  it("shares one timer across many active badges", () => {
    const setInterval = jest.spyOn(global, "setInterval");

    createBadge(activeState());
    createBadge(activeState());
    createBadge(activeState());

    expect(setInterval).toHaveBeenCalledTimes(1);
  });

  it("keeps the timer until the last active badge is gone", () => {
    const clearInterval = jest.spyOn(global, "clearInterval");
    const first = createBadge(activeState());
    const second = createBadge(activeState());

    first.destroy();
    fixtures.splice(fixtures.indexOf(first), 1);
    expect(clearInterval).not.toHaveBeenCalled();

    second.destroy();
    fixtures.splice(fixtures.indexOf(second), 1);
    expect(clearInterval).toHaveBeenCalled();
  });
});
