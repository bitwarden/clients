import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AccessBadgeState } from "./access-badge-state";
import { AccessStateBadgeComponent } from "./access-state-badge.component";

describe("AccessStateBadgeComponent", () => {
  let fixture: ComponentFixture<AccessStateBadgeComponent>;
  let component: AccessStateBadgeComponent;

  function create(state: AccessBadgeState | null): void {
    fixture = TestBed.createComponent(AccessStateBadgeComponent);
    fixture.componentRef.setInput("state", state);
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
  });

  it("renders no placeholder text when there is no state, so the cipher-view modal stays empty", () => {
    create(null);
    expect(fixture.nativeElement.textContent.trim()).toBe("");
    expect(fixture.nativeElement.innerHTML).not.toContain("\u2014");
  });

  it.each([
    ["privileged", "primary", "bwi-key", "pamAccessBadgePrivileged"],
    ["pending", "warning", "bwi-clock", "pamAccessBadgePending"],
    ["unavailable", "subtle", "bwi-lock", "pamAccessBadgeUnavailable"],
    ["ready", "success", "bwi-check", "pamAccessBadgeReady"],
    ["expired", "subtle", "bwi-lock", "pamAccessBadgeSessionEnded"],
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

  it("escalates to the danger 'Ending soon' badge at or below 5 minutes", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() + 3 * 60_000) });

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe("danger");
    expect(recipe.icon).toBe("bwi-exclamation-triangle");
    expect(recipe.label).toContain("pamAccessBadgeEndingSoon");
  });

  it("shows the expired badge once an active lease has lapsed", () => {
    create({ kind: "active", expiresAt: new Date(Date.now() - 1_000) });

    const recipe = component["recipe"]()!;
    expect(recipe.variant).toBe("subtle");
    expect(recipe.label).toBe("pamAccessBadgeSessionEnded");
  });
});
