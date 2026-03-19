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
});
