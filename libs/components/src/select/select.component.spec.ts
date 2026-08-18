import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SelectComponent } from "./select.component";
import { SelectModule } from "./select.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SelectModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <bit-select formControlName="fruits"></bit-select>
    </form>
  `,
})
export class TestFormComponent {
  form = new FormGroup({ fruits: new FormControl<"apple" | "pear" | "banana">("apple") });
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SelectModule],
  template: `
    <bit-select>
      <bit-option
        value="apple"
        label="Apple"
        [iconTile]="{ icon: 'bwi-star', variant: 'teal', emphasis: 'bold' }"
      ></bit-option>
      <bit-option value="pear" label="Pear" icon="bwi-key"></bit-option>
      <bit-option
        value="banana"
        label="Banana"
        icon="bwi-key"
        [iconTile]="{ icon: 'bwi-star' }"
      ></bit-option>
    </bit-select>
  `,
})
export class TestOptionsComponent {}

describe("Select Component", () => {
  let select: SelectComponent<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestFormComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestFormComponent);
    fixture.detectChanges();

    select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
  });

  describe("initial state", () => {
    it("selected option should update when items input changes", () => {
      expect(select.selectedOption()?.value).toBeUndefined();

      select.items.set([
        { label: "Apple", value: "apple" },
        { label: "Pear", value: "pear" },
        { label: "Banana", value: "banana" },
      ]);

      expect(select.selectedOption()?.value).toBe("apple");
    });
  });

  describe("ID and label association", () => {
    it("labelForId targets the internal search input, not the component root element", () => {
      expect(select.formFieldControl.labelForId()).not.toBe(select.formFieldControl.id());
    });

    it("labelForId is derived from the component id with a '-search' suffix", () => {
      expect(select.formFieldControl.labelForId()).toBe(`${select.formFieldControl.id()}-search`);
    });
  });
});

describe("Select Component with bit-option children", () => {
  let select: SelectComponent<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestOptionsComponent],
      providers: [{ provide: I18nService, useValue: mock<I18nService>() }],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestOptionsComponent);
    fixture.detectChanges();

    select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance;
  });

  it("maps the iconTile input onto the items it derives from bit-option", () => {
    expect(select.items()).toEqual([
      {
        label: "Apple",
        value: "apple",
        icon: undefined,
        iconTile: { icon: "bwi-star", variant: "teal", emphasis: "bold" },
        description: undefined,
        disabled: undefined,
      },
      {
        label: "Pear",
        value: "pear",
        icon: "bwi-key",
        iconTile: undefined,
        description: undefined,
        disabled: undefined,
      },
      {
        label: "Banana",
        value: "banana",
        icon: "bwi-key",
        iconTile: { icon: "bwi-star" },
        description: undefined,
        disabled: undefined,
      },
    ]);
  });
});
