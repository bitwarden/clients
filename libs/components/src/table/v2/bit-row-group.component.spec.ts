import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { BitRowGroupComponent } from "./bit-row-group.component";
import { BitTableV2Component } from "./table-v2.component";

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitRowGroupComponent],
  template: `
    <bit-row-group
      collapsible
      [match]="match"
      [collapsed]="collapsed()"
      (collapsedChange)="onCollapsedChange($event)"
    >
      Header
    </bit-row-group>
  `,
})
class TestHostComponent {
  match = (_row: unknown) => true;
  readonly collapsed = signal(false);
  changes: boolean[] = [];

  // Mirror a real two-way consumer: record the emission and update the bound source so the
  // one-way `[collapsed]` input doesn't revert the group on the next change detection.
  onCollapsedChange(value: boolean) {
    this.changes.push(value);
    this.collapsed.set(value);
  }
}

describe("BitRowGroupComponent", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let group: BitRowGroupComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        // The group registers itself with the nearest table via DI; a stub is all it needs here.
        {
          provide: BitTableV2Component,
          useValue: { registerGroup: () => {}, unregisterGroup: () => {} },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    group = fixture.debugElement.query(By.directive(BitRowGroupComponent)).componentInstance;
  });

  it("is not collapsed by default", () => {
    expect(group.collapsed()).toBe(false);
  });

  it("reflects the seeded collapsed input without emitting", () => {
    host.collapsed.set(true);
    fixture.detectChanges();

    expect(group.collapsed()).toBe(true);
    expect(host.changes).toEqual([]);
  });

  it("flips the state and emits when toggled", () => {
    group.toggle();
    fixture.detectChanges();
    expect(group.collapsed()).toBe(true);
    expect(host.changes).toEqual([true]);

    group.toggle();
    fixture.detectChanges();
    expect(group.collapsed()).toBe(false);
    expect(host.changes).toEqual([true, false]);
  });
});
