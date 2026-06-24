import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { Subject } from "rxjs";

import { ManagedSettingsService } from "@bitwarden/common/platform/managed-settings";

import { BadgeComponent } from "../badge/badge.component";

import { BitManagedDirective } from "./managed.directive";

class MockManagedSettingsService {
  // eslint-disable-next-line rxjs/no-exposed-subjects
  changes$ = new Subject<void>();
  private managed = new Set<string>();

  setManaged(key: string, value: boolean) {
    if (value) {
      this.managed.add(key);
    } else {
      this.managed.delete(key);
    }
  }

  isManaged(key: string) {
    return this.managed.has(key);
  }
}

@Component({
  selector: "test-managed-host",
  template: `
    <form [formGroup]="form">
      <input formControlName="x" [bitManaged]="'environment.base'" [bitManagedLabel]="'Managed'" />
    </form>
  `,
  imports: [ReactiveFormsModule, BitManagedDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestManagedHostComponent {
  form = new FormGroup({ x: new FormControl("https://vault.example.com") });
}

@Component({
  selector: "test-managed-nocontrol-host",
  template: `<span [bitManaged]="'environment.base'" [bitManagedLabel]="'Managed'"></span>`,
  imports: [BitManagedDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestManagedNoControlHostComponent {}

describe("BitManagedDirective", () => {
  let managedSettings: MockManagedSettingsService;

  function setup<T>(component: new () => T): ComponentFixture<T> {
    managedSettings = new MockManagedSettingsService();
    TestBed.configureTestingModule({
      imports: [component],
      providers: [{ provide: ManagedSettingsService, useValue: managedSettings }],
    });
    return TestBed.createComponent(component);
  }

  function badge(fixture: ComponentFixture<unknown>) {
    return fixture.debugElement.query(By.directive(BadgeComponent));
  }

  it("disables the control and renders the badge when the key is managed on init", () => {
    const fixture = setup(TestManagedHostComponent);
    managedSettings.setManaged("environment.base", true);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get("x")!.disabled).toBe(true);
    const b = badge(fixture);
    expect(b).not.toBeNull();
    expect(b.nativeElement.textContent).toContain("Managed");
  });

  it("leaves the control enabled and renders no badge when the key is unmanaged", () => {
    const fixture = setup(TestManagedHostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get("x")!.disabled).toBe(false);
    expect(badge(fixture)).toBeNull();
  });

  it("flips to managed when a profile arrives after subscription", () => {
    const fixture = setup(TestManagedHostComponent);
    fixture.detectChanges();
    expect(badge(fixture)).toBeNull();

    managedSettings.setManaged("environment.base", true);
    managedSettings.changes$.next();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get("x")!.disabled).toBe(true);
    expect(badge(fixture)).not.toBeNull();
  });

  it("re-enables the control and removes the badge when the key stops being managed", () => {
    const fixture = setup(TestManagedHostComponent);
    managedSettings.setManaged("environment.base", true);
    fixture.detectChanges();
    expect(badge(fixture)).not.toBeNull();

    managedSettings.setManaged("environment.base", false);
    managedSettings.changes$.next();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.get("x")!.disabled).toBe(false);
    expect(badge(fixture)).toBeNull();
  });

  it("renders the badge without throwing when the host has no form control", () => {
    const fixture = setup(TestManagedNoControlHostComponent);
    managedSettings.setManaged("environment.base", true);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(badge(fixture)).not.toBeNull();
  });
});
