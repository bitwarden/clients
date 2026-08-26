import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormArray, FormControl } from "@angular/forms";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CidrValidationService } from "./cidr-validation.service";
import {
  cidrRowControl,
  IpAllowlistCidrsArray,
  IpAllowlistEditorComponent,
} from "./ip-allowlist-editor.component";

// Stand-in for the SDK-backed CIDR check the app injects; recognises the fixtures these specs use.
const isValidCidr = (value: string): boolean =>
  value === "10.0.0.0/8" || value === "192.168.0.0/16";

describe("IpAllowlistEditorComponent", () => {
  let fixture: ComponentFixture<IpAllowlistEditorComponent>;
  let component: IpAllowlistEditorComponent;
  let cidrArray: IpAllowlistCidrsArray;

  /** A host-owned CIDR array seeded with the given values, as the parent form builds it. */
  function hostArray(...cidrs: string[]): IpAllowlistCidrsArray {
    return new FormArray<FormControl<string>>(
      cidrs.map((c) => cidrRowControl(c, "invalid", isValidCidr)),
    );
  }

  /** The per-row remove buttons currently rendered, in row order. */
  function removeButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll("bit-form-field button"));
  }

  /** Creates the component bound to `array` and runs ngOnInit. */
  function create(array: IpAllowlistCidrsArray): void {
    cidrArray = array;
    fixture = TestBed.createComponent(IpAllowlistEditorComponent);
    fixture.componentRef.setInput("cidrArray", array);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    const i18nService = { t: (key: string, ...args: unknown[]) => [key, ...args].join(" ") };
    TestBed.configureTestingModule({
      imports: [IpAllowlistEditorComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: i18nService },
        { provide: CidrValidationService, useValue: { isValid: isValidCidr } },
      ],
    });
  });

  describe("ngOnInit", () => {
    it("seeds a single blank row when the host array is empty", () => {
      create(hostArray());
      expect(cidrArray.length).toBe(1);
      expect(cidrArray.at(0).value).toBe("");
    });

    it("leaves a pre-seeded array untouched", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16"));
      expect(cidrArray.length).toBe(2);
      expect(cidrArray.at(0).value).toBe("10.0.0.0/8");
      expect(cidrArray.at(1).value).toBe("192.168.0.0/16");
    });
  });

  describe("addRow()", () => {
    it("appends a blank row and marks the array touched", () => {
      create(hostArray("10.0.0.0/8"));

      component["addRow"]();

      expect(cidrArray.length).toBe(2);
      expect(cidrArray.at(1).value).toBe("");
      expect(cidrArray.touched).toBe(true);
    });

    it("gives added rows the per-row CIDR validator", () => {
      create(hostArray());

      component["addRow"]();
      cidrArray.at(1).setValue("not-a-cidr");

      expect(cidrArray.at(1).hasError("invalidCidr")).toBe(true);
    });
  });

  describe("removeRow()", () => {
    it("removes the row at the given index", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16"));

      component["removeRow"](0);

      expect(cidrArray.length).toBe(1);
      expect(cidrArray.at(0).value).toBe("192.168.0.0/16");
    });

    it("keeps a single blank row when the last row is removed", () => {
      create(hostArray("10.0.0.0/8"));

      component["removeRow"](0);

      expect(cidrArray.length).toBe(1);
      expect(cidrArray.at(0).value).toBe("");
    });

    it("clears the removed row's error rather than showing it against the row that replaces it", () => {
      create(hostArray("not-a-cidr", "10.0.0.0/8"));
      cidrArray.at(0).markAsTouched();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("bit-error")).not.toBeNull();

      removeButtons()[0].click();
      fixture.detectChanges();

      expect(cidrArray.at(0).value).toBe("10.0.0.0/8");
      expect(fixture.nativeElement.querySelector("bit-error")).toBeNull();
    });
  });

  describe("remove button", () => {
    it("is hidden while a single row is all there is to remove", () => {
      create(hostArray("10.0.0.0/8"));
      expect(removeButtons().length).toBe(0);
    });

    it("is offered on every row once more than one exists", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16"));
      expect(removeButtons().length).toBe(2);
    });

    it("sits outside the input rather than inside it as a suffix", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16"));
      expect(removeButtons()[0].getAttribute("slot")).toBe("inline-end");
    });

    it("is withheld when the editor is read-only", () => {
      cidrArray = hostArray("10.0.0.0/8", "192.168.0.0/16");
      fixture = TestBed.createComponent(IpAllowlistEditorComponent);
      fixture.componentRef.setInput("cidrArray", cidrArray);
      fixture.componentRef.setInput("readonly", true);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(removeButtons().length).toBe(0);
    });
  });

  describe("markTouched()", () => {
    it("marks the host array touched so array-level errors can surface", () => {
      create(hostArray("10.0.0.0/8"));
      expect(cidrArray.touched).toBe(false);

      component["markTouched"]();

      expect(cidrArray.touched).toBe(true);
    });
  });
});
