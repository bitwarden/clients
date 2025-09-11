import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";

import { BitLabel } from "../form-control/label.component";

import { SwitchComponent } from "./switch.component";
import { SwitchModule } from "./switch.module";

describe("SwitchComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let switchComponent: SwitchComponent;
  let inputEl: HTMLInputElement;

  @Component({
    selector: "test-host",
    imports: [FormsModule, BitLabel, ReactiveFormsModule, SwitchModule],
    template: `
      <form [formGroup]="formObj">
        <bit-switch formControlName="switch">
          <bit-label>Element</bit-label>
        </bit-switch>
      </form>
    `,
  })
  class TestHostComponent {
    formObj = new FormGroup({
      switch: new FormControl(false),
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const debugSwitch = fixture.debugElement.query(By.directive(SwitchComponent));
    switchComponent = debugSwitch.componentInstance;
    inputEl = debugSwitch.nativeElement.querySelector("input[type=checkbox]");
  });

  it("should update checked attribute when selected changes programmatically", () => {
    expect(inputEl.checked).toBe(false);

    switchComponent.writeValue(true);
    fixture.detectChanges();
    expect(inputEl.checked).toBe(true);

    switchComponent.writeValue(false);
    fixture.detectChanges();
    expect(inputEl.checked).toBe(false);
  });

  it("should update checked attribute when switch is clicked", () => {
    expect(inputEl.checked).toBe(false);

    inputEl.click();
    fixture.detectChanges();

    expect(inputEl.checked).toBe(true);

    inputEl.click();
    fixture.detectChanges();

    expect(inputEl.checked).toBe(false);
  });

  it("should update checked when selected input changes outside of a form", async () => {
    @Component({
      selector: "test-selected-host",
      template: `<bit-switch [selected]="checked"><bit-label>Element</bit-label></bit-switch>`,
      standalone: true,
      imports: [SwitchComponent, BitLabel],
    })
    class TestSelectedHostComponent {
      checked = false;
    }

    const hostFixture = TestBed.createComponent(TestSelectedHostComponent);
    hostFixture.detectChanges();
    const switchDebug = hostFixture.debugElement.query(By.directive(SwitchComponent));
    const input = switchDebug.nativeElement.querySelector('input[type="checkbox"]');

    expect(input.checked).toBe(false);

    hostFixture.componentInstance.checked = true;
    hostFixture.detectChanges();
    expect(input.checked).toBe(true);

    hostFixture.componentInstance.checked = false;
    hostFixture.detectChanges();
    expect(input.checked).toBe(false);
  });
});
