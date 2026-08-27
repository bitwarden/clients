import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormArray, FormControl } from "@angular/forms";
import { By } from "@angular/platform-browser";
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
      expect(removeButtons()[0].closest("[bitFieldContainer]")).toBeNull();
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

  describe("duplicate rows", () => {
    function inputAt(index: number): HTMLInputElement {
      return fixture.debugElement.queryAll(By.css("input[bitInput]"))[index].nativeElement;
    }

    function type(index: number, value: string): void {
      const input = inputAt(index);
      input.value = value;
      input.dispatchEvent(new Event("input"));
    }

    function rows(): DebugElement[] {
      return fixture.debugElement.queryAll(By.css("bit-form-field"));
    }

    /**
     * The `bit-error` text rendered inside each row's own `bit-form-field`, in row order. Scoped
     * per row rather than counted across the component, so a mark landing under the wrong input
     * fails instead of passing on a matching total.
     */
    function errorsByRow(): string[][] {
      fixture.detectChanges();
      return rows().map((row) =>
        row
          .queryAll(By.css("bit-error"))
          .map((e) => (e.nativeElement as HTMLElement).textContent!.trim()),
      );
    }

    function clickRemove(index: number): void {
      rows()[index].query(By.css("button[bitSuffix]")).nativeElement.click();
    }

    const DUPLICATE = "accessRuleIpAllowlistDuplicateCidr";

    it("renders a bit-error on both duplicate rows when an already-duplicated rule mounts untouched", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16", "10.0.0.0/8"));

      expect(errorsByRow()).toEqual([[DUPLICATE], [], [DUPLICATE]]);
      expect(cidrArray.at(1).hasError("duplicateCidr")).toBe(false);
    });

    it("marks both rows of a duplicate pair when only one of them is blurred", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16"));

      type(1, "10.0.0.0/8");
      inputAt(1).dispatchEvent(new Event("blur"));

      expect(errorsByRow()).toEqual([[DUPLICATE], [DUPLICATE]]);
    });

    it("keeps the duplicate marks on the surviving rows when a row between them is removed", () => {
      create(hostArray("10.0.0.0/8", "192.168.0.0/16", "10.0.0.0/8"));

      clickRemove(1);

      expect(errorsByRow()).toEqual([[DUPLICATE], [DUPLICATE]]);
    });

    it("shows the format error rather than the duplicate one on a row that is both", () => {
      create(hostArray("not-a-cidr", "not-a-cidr"));

      expect(errorsByRow()).toEqual([["invalid"], ["invalid"]]);
    });

    it("clears the duplicate mark from both rows once the values differ", () => {
      create(hostArray("10.0.0.0/8", "10.0.0.0/8"));

      type(1, "192.168.0.0/16");

      expect(errorsByRow()).toEqual([[], []]);
    });
  });
});
