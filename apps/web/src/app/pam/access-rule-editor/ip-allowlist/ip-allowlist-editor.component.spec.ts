import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IpAllowlistEditorComponent } from "./ip-allowlist-editor.component";

describe("IpAllowlistEditorComponent", () => {
  let fixture: ComponentFixture<IpAllowlistEditorComponent>;
  let component: IpAllowlistEditorComponent;

  /** Creates the component and runs ngOnInit (which seeds a blank row when unbound). */
  function create(): void {
    fixture = TestBed.createComponent(IpAllowlistEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** The protected internal FormArray, exposed for assertions. */
  const cidrArray = () => component["cidrArray"];

  const touched = () => {
    const control = new FormControl();
    control.markAsTouched();
    return control;
  };

  beforeEach(() => {
    const i18nService = { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") };
    TestBed.configureTestingModule({
      imports: [IpAllowlistEditorComponent, NoopAnimationsModule],
      providers: [{ provide: I18nService, useValue: i18nService }],
    });
  });

  describe("ngOnInit", () => {
    it("starts with a single blank row when no value is written", () => {
      create();
      expect(cidrArray().length).toBe(1);
      expect(cidrArray().at(0).value).toBe("");
    });
  });

  describe("writeValue", () => {
    it("populates a single blank row for an empty list", () => {
      create();
      component.writeValue([]);
      expect(cidrArray().length).toBe(1);
      expect(cidrArray().at(0).value).toBe("");
    });

    it("populates one row per CIDR", () => {
      create();
      component.writeValue(["10.0.0.0/8", "192.168.0.0/16"]);
      expect(cidrArray().length).toBe(2);
      expect(cidrArray().at(0).value).toBe("10.0.0.0/8");
      expect(cidrArray().at(1).value).toBe("192.168.0.0/16");
    });

    it("treats null as an empty list", () => {
      create();
      component.writeValue(null);
      expect(cidrArray().length).toBe(1);
    });

    it("does not emit a change while writing", () => {
      create();
      const emitted: string[][] = [];
      component.registerOnChange((v) => emitted.push(v));
      component.writeValue(["10.0.0.0/8"]);
      expect(emitted).toEqual([]);
    });
  });

  describe("validate()", () => {
    it("rejects a single empty row", () => {
      create();
      component.writeValue([]);
      expect(component.validate(new FormControl())).toEqual({ ipAllowlist: true });
    });

    it("rejects a malformed CIDR", () => {
      create();
      component.writeValue([]);
      cidrArray().at(0).setValue("not-a-cidr");

      expect(component.validate(new FormControl())).toEqual({ ipAllowlist: true });
      expect(cidrArray().at(0).hasError("invalidCidr")).toBe(true);
    });

    it("accepts a single valid IPv4 CIDR", () => {
      create();
      component.writeValue(["10.0.0.0/8"]);
      expect(component.validate(new FormControl())).toBeNull();
    });

    it("accepts a single valid IPv6 CIDR", () => {
      create();
      component.writeValue(["2001:db8::/32"]);
      expect(component.validate(new FormControl())).toBeNull();
    });

    it("rejects duplicate CIDRs", () => {
      create();
      component.writeValue(["10.0.0.0/8", "10.0.0.0/8"]);

      expect(component.validate(new FormControl())).toEqual({ ipAllowlist: true });
      expect(cidrArray().hasError("duplicateCidrs")).toBe(true);
    });

    it("marks rows touched once the host control is touched", () => {
      create();
      component.writeValue([]);

      component.validate(touched());

      expect(cidrArray().touched).toBe(true);
    });

    it("leaves rows untouched while the host control is untouched", () => {
      create();
      component.writeValue([]);

      component.validate(new FormControl());

      expect(cidrArray().touched).toBe(false);
    });
  });

  describe("change propagation", () => {
    it("emits the trimmed list when a row value changes", () => {
      create();
      component.writeValue(["10.0.0.0/8"]);
      const emitted: string[][] = [];
      component.registerOnChange((v) => emitted.push(v));

      cidrArray().at(0).setValue(" 192.168.0.0/16 ");

      expect(emitted[emitted.length - 1]).toEqual(["192.168.0.0/16"]);
    });

    it("emits when a row is added", () => {
      create();
      component.writeValue(["10.0.0.0/8"]);
      const emitted: string[][] = [];
      component.registerOnChange((v) => emitted.push(v));

      component["addRow"]();

      expect(emitted[emitted.length - 1]).toEqual(["10.0.0.0/8", ""]);
    });

    it("emits when a row is removed", () => {
      create();
      component.writeValue(["10.0.0.0/8", "192.168.0.0/16"]);
      const emitted: string[][] = [];
      component.registerOnChange((v) => emitted.push(v));

      component["removeRow"](1);

      expect(emitted[emitted.length - 1]).toEqual(["10.0.0.0/8"]);
    });

    it("notifies touched on blur", () => {
      create();
      const onTouched = jest.fn();
      component.registerOnTouched(onTouched);

      component["markTouched"]();

      expect(onTouched).toHaveBeenCalled();
    });
  });

  describe("removeRow()", () => {
    it("keeps a single blank row when the last row is removed", () => {
      create();
      component.writeValue(["10.0.0.0/8"]);

      component["removeRow"](0);

      expect(cidrArray().length).toBe(1);
      expect(cidrArray().at(0).value).toBe("");
    });
  });

  describe("setDisabledState()", () => {
    it("disables and re-enables the array", () => {
      create();

      component.setDisabledState(true);
      expect(cidrArray().disabled).toBe(true);

      component.setDisabledState(false);
      expect(cidrArray().disabled).toBe(false);
    });
  });
});
