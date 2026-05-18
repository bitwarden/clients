import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mock, MockProxy } from "jest-mock-extended";

import {
  ALL_CHILD_KINDS,
  ChildPolicyKind,
  CompositePolicyEditorComponent,
} from "./composite-policy-editor.component";

describe("CompositePolicyEditorComponent", () => {
  let i18nService: MockProxy<I18nService>;
  let fixture: ComponentFixture<CompositePolicyEditorComponent>;
  let component: CompositePolicyEditorComponent;

  beforeEach(async () => {
    i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [CompositePolicyEditorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CompositePolicyEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe("initial state", () => {
    it("starts with two child slots", () => {
      expect(component["slots"]().length).toBe(2);
    });

    it("assigns the first two unique kinds to the initial slots", () => {
      const kinds = component["slots"]().map((s) => s.kind);
      expect(kinds[0]).toBe(ChildPolicyKind.HumanApproval);
      expect(kinds[1]).toBe(ChildPolicyKind.IpAllowlist);
    });

    it("is not valid until all child slots have emitted a policy", () => {
      // ip_allowlist slot starts with policy=null until the stub child fires ngOnInit.
      const ipSlot = component["slots"]().find((s) => s.kind === "ip_allowlist")!;
      component["slots"].update((prev) =>
        prev.map((s) => (s.id === ipSlot.id ? { ...s, policy: null } : s)),
      );
      expect(component["isValid"]()).toBe(false);

      component["onChildPolicyChange"](ipSlot.id, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] });
      expect(component["isValid"]()).toBe(true);
    });
  });

  describe("at-least-two-children rule", () => {
    it("is invalid when only one child remains after removal", () => {
      const id = component["slots"]()[1].id;
      component["removeSlot"](id);
      fixture.detectChanges();

      expect(component["slots"]().length).toBe(1);
      expect(component["isValid"]()).toBe(false);
    });

    it("emits null policy when fewer than two children", () => {
      const emissions: (import("@bitwarden/pam").LeasingPolicy | null)[] = [];
      component.policyChange.subscribe((p) => emissions.push(p));

      component["removeSlot"](component["slots"]()[1].id);
      fixture.detectChanges();

      expect(emissions[emissions.length - 1]).toBeNull();
    });
  });

  describe("duplicate-kind rejection", () => {
    it("marks a slot with an error when its kind duplicates another slot", () => {
      const secondId = component["slots"]()[1].id;
      component["onKindChange"](secondId, ChildPolicyKind.HumanApproval);
      fixture.detectChanges();

      const second = component["slots"]().find((s) => s.id === secondId)!;
      expect(second.error).toBe("policyCompositeDuplicateKindError");
    });

    it("clears the duplicate error when the kind is changed to a non-duplicate", () => {
      const secondId = component["slots"]()[1].id;
      component["onKindChange"](secondId, ChildPolicyKind.HumanApproval);
      component["onKindChange"](secondId, ChildPolicyKind.TimeOfDay);
      fixture.detectChanges();

      const second = component["slots"]().find((s) => s.id === secondId)!;
      expect(second.error).toBeNull();
    });

    it("emits null when a duplicate makes the form invalid", () => {
      const emissions: (import("@bitwarden/pam").LeasingPolicy | null)[] = [];
      component.policyChange.subscribe((p) => emissions.push(p));

      const secondId = component["slots"]()[1].id;
      component["onKindChange"](secondId, ChildPolicyKind.HumanApproval);
      fixture.detectChanges();

      expect(emissions[emissions.length - 1]).toBeNull();
    });
  });

  describe("no-nested-composite rule", () => {
    it("does not expose all_of as an available child kind for any slot", () => {
      const allAvailable = component["slots"]().flatMap((s) => component["availableKinds"](s));
      expect(allAvailable).not.toContain("all_of");
    });

    it("ALL_CHILD_KINDS does not include all_of", () => {
      expect(ALL_CHILD_KINDS).not.toContain("all_of");
    });
  });

  describe("serialization", () => {
    it("emits an all_of policy with the correct children", () => {
      const emissions: (import("@bitwarden/pam").LeasingPolicy | null)[] = [];
      component.policyChange.subscribe((p) => emissions.push(p));

      const ipSlotId = component["slots"]().find((s) => s.kind === ChildPolicyKind.IpAllowlist)!.id;
      component["onChildPolicyChange"](ipSlotId, {
        kind: "ip_allowlist",
        cidrs: ["192.168.0.0/16"],
      });
      fixture.detectChanges();

      const latest = emissions[emissions.length - 1];
      expect(latest).not.toBeNull();
      expect(latest!.kind).toBe("all_of");
      const children = (latest as { kind: "all_of"; children: unknown[] }).children;
      expect(children).toContainEqual({ kind: "human_approval" });
      expect(children).toContainEqual({ kind: "ip_allowlist", cidrs: ["192.168.0.0/16"] });
    });

    it("serializes a three-child mix: human_approval + ip_allowlist + time_of_day", () => {
      const emissions: (import("@bitwarden/pam").LeasingPolicy | null)[] = [];
      component.policyChange.subscribe((p) => emissions.push(p));

      component["addSlot"]();
      fixture.detectChanges();

      const slots = component["slots"]();
      expect(slots.length).toBe(3);

      const ipSlot = slots.find((s) => s.kind === ChildPolicyKind.IpAllowlist)!;
      const todSlot = slots.find((s) => s.kind === ChildPolicyKind.TimeOfDay)!;

      component["onChildPolicyChange"](ipSlot.id, { kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] });
      component["onChildPolicyChange"](todSlot.id, {
        kind: "time_of_day",
        tz: "UTC",
        windows: [{ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" }],
      });
      fixture.detectChanges();

      const latest = emissions[emissions.length - 1]!;
      expect(latest.kind).toBe("all_of");
      const children = (latest as { kind: "all_of"; children: unknown[] }).children;
      expect(children).toHaveLength(3);
      expect(children).toContainEqual({ kind: "human_approval" });
      expect(children).toContainEqual({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] });
      expect(children).toContainEqual({
        kind: "time_of_day",
        tz: "UTC",
        windows: [{ daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" }],
      });
    });
  });

  describe("child editors", () => {
    it("renders pam-human-approval-editor for a human_approval slot", () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-human-approval-editor")).not.toBeNull();
    });

    it("renders pam-stub-ip-allowlist-editor for an ip_allowlist slot", () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-stub-ip-allowlist-editor")).not.toBeNull();
    });

    it("renders pam-stub-time-of-day-editor when a slot is changed to time_of_day", () => {
      component["addSlot"]();
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("pam-stub-time-of-day-editor")).not.toBeNull();
    });
  });

  describe("add condition", () => {
    it("adds a new slot up to the maximum of three unique kinds", () => {
      component["addSlot"]();
      expect(component["slots"]().length).toBe(3);
    });

    it("does not add a fourth slot when all three kinds are exhausted", () => {
      component["addSlot"](); // → 3 slots
      component["addSlot"](); // should be a no-op
      expect(component["slots"]().length).toBe(3);
    });

    it("reports canAddMore as false when all kinds are used", () => {
      component["addSlot"]();
      expect(component["canAddMore"]).toBe(false);
    });
  });

  describe("manage members event", () => {
    it("propagates manageMembersClicked from an inner human_approval editor", () => {
      const spy = jest.fn();
      component.manageMembersClicked.subscribe(spy);

      component["onManageMembersClicked"]();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
