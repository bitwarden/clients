import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IpAllowlistEditorComponent } from "./ip-allowlist-editor.component";

describe("IpAllowlistEditorComponent", () => {
  let fixture: ComponentFixture<IpAllowlistEditorComponent>;
  let component: IpAllowlistEditorComponent;

  function setup(cidrs: string[] = [], readonly = false) {
    fixture = TestBed.createComponent(IpAllowlistEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("cidrs", cidrs);
    fixture.componentRef.setInput("readonly", readonly);
    fixture.detectChanges();
  }

  beforeEach(() => {
    const i18nService = { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") };
    TestBed.configureTestingModule({
      imports: [IpAllowlistEditorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    });
  });

  describe("initialisation", () => {
    it("adds a single blank row when no initial CIDRs are provided", () => {
      setup([]);
      expect(component["cidrArray"].length).toBe(1);
      expect(component["cidrArray"].at(0).value).toBe("");
    });

    it("populates rows from the initial cidrs input", () => {
      setup(["10.0.0.0/8", "192.168.0.0/16"]);
      expect(component["cidrArray"].length).toBe(2);
      expect(component["cidrArray"].at(0).value).toBe("10.0.0.0/8");
      expect(component["cidrArray"].at(1).value).toBe("192.168.0.0/16");
    });
  });

  describe("validate()", () => {
    it("returns false and marks touched when the single row is empty", () => {
      setup([]);
      component["cidrArray"].at(0).setValue("");

      const result = component.validate();

      expect(result).toBe(false);
    });

    it("returns false for a malformed CIDR", () => {
      setup([]);
      component["cidrArray"].at(0).setValue("not-a-cidr");

      const result = component.validate();

      expect(result).toBe(false);
      expect(component["cidrArray"].at(0).hasError("invalidCidr")).toBe(true);
    });

    it("returns true for a single valid IPv4 CIDR", () => {
      setup([]);
      component["cidrArray"].at(0).setValue("10.0.0.0/8");

      const result = component.validate();

      expect(result).toBe(true);
    });

    it("returns true for a single valid IPv6 CIDR", () => {
      setup([]);
      component["cidrArray"].at(0).setValue("2001:db8::/32");

      const result = component.validate();

      expect(result).toBe(true);
    });

    it("returns false when duplicate CIDRs are present", () => {
      setup(["10.0.0.0/8", "10.0.0.0/8"]);

      const result = component.validate();

      expect(result).toBe(false);
      expect(component["cidrArray"].hasError("duplicateCidrs")).toBe(true);
    });

    it("returns false when there are no rows (all removed)", () => {
      setup(["10.0.0.0/8"]);
      component["cidrArray"].removeAt(0);

      const result = component.validate();

      expect(result).toBe(false);
    });
  });

  describe("currentCidrs", () => {
    it("returns the trimmed values of all rows", () => {
      setup(["10.0.0.0/8", "192.168.0.0/16"]);

      expect(component.currentCidrs).toEqual(["10.0.0.0/8", "192.168.0.0/16"]);
    });

    it("trims whitespace from values", () => {
      setup([" 10.0.0.0/8 "]);

      expect(component.currentCidrs).toEqual(["10.0.0.0/8"]);
    });
  });

  describe("addRow()", () => {
    it("appends a blank row", () => {
      setup(["10.0.0.0/8"]);
      const before = component["cidrArray"].length;

      component["addRow"]();

      expect(component["cidrArray"].length).toBe(before + 1);
      expect(component["cidrArray"].at(before).value).toBe("");
    });
  });

  describe("removeRow()", () => {
    it("removes the row at the given index", () => {
      setup(["10.0.0.0/8", "192.168.0.0/16"]);

      component["removeRow"](0);

      expect(component["cidrArray"].length).toBe(1);
      expect(component["cidrArray"].at(0).value).toBe("192.168.0.0/16");
    });
  });

  describe("cidrsChange output", () => {
    it("emits the updated list when a row is added", () => {
      setup(["10.0.0.0/8"]);
      const emitted: string[][] = [];
      component.cidrsChange.subscribe((v) => emitted.push(v));

      component["addRow"]();

      expect(emitted.length).toBeGreaterThan(0);
    });

    it("emits the updated list when a row is removed", () => {
      setup(["10.0.0.0/8", "192.168.0.0/16"]);
      const emitted: string[][] = [];
      component.cidrsChange.subscribe((v) => emitted.push(v));

      component["removeRow"](1);

      expect(emitted[emitted.length - 1]).toEqual(["10.0.0.0/8"]);
    });
  });

  describe("valid submission serialises correctly", () => {
    it("currentCidrs matches { kind: 'ip_allowlist', cidrs: [...] } shape", () => {
      setup(["10.0.0.0/8", "192.168.1.0/24"]);
      component["cidrArray"].at(0).setValue("10.0.0.0/8");
      component["cidrArray"].at(1).setValue("192.168.1.0/24");

      const isValid = component.validate();
      const policy = { kind: "ip_allowlist" as const, cidrs: component.currentCidrs };

      expect(isValid).toBe(true);
      expect(policy).toEqual({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8", "192.168.1.0/24"] });
    });
  });
});
