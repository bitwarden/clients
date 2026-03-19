import { ChangeDetectionStrategy, Component, DebugElement, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { BadgeModule } from "../badge";

import { ToggleGroupComponent } from "./toggle-group.component";
import { ToggleGroupModule } from "./toggle-group.module";

describe("Toggle", () => {
  let fixture: ComponentFixture<TestComponent>;
  let toggleGroup: ToggleGroupComponent;
  let toggleButtons: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponent],
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(TestComponent);
    fixture.detectChanges();
    toggleGroup = fixture.debugElement.query(By.directive(ToggleGroupComponent)).componentInstance;
    toggleButtons = fixture.debugElement.queryAll(By.css("input[type=radio]"));
  });

  it("should emit value when clicking on radio button", () => {
    const spyFn = jest.spyOn(toggleGroup, "onInputInteraction");

    toggleButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(spyFn).toHaveBeenCalledWith(1);
  });

  it("should select toggle button only when selected matches value", () => {
    fixture.detectChanges();

    expect(toggleButtons[0].nativeElement.checked).toBe(true);
    expect(toggleButtons[1].nativeElement.checked).toBe(false);

    toggleButtons[1].triggerEventHandler("change");
    fixture.detectChanges();

    expect(toggleButtons[0].nativeElement.checked).toBe(false);
    expect(toggleButtons[1].nativeElement.checked).toBe(true);
  });
});

describe("Toggle with badge content", () => {
  let fixtureWithBadge: ComponentFixture<TestComponentWithBadgeComponent>;
  let badgeContainers: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponentWithBadgeComponent],
    });

    await TestBed.compileComponents();
    fixtureWithBadge = TestBed.createComponent(TestComponentWithBadgeComponent);
    fixtureWithBadge.detectChanges();
    badgeContainers = fixtureWithBadge.debugElement.queryAll(By.css(".tw-shrink-0"));
  });

  it("should hide badge container when no badge content is projected", () => {
    // First toggle has no badge
    expect(badgeContainers[0].nativeElement.hidden).toBe(true);

    // Second toggle has a badge
    expect(badgeContainers[1].nativeElement.hidden).toBe(false);

    // Third toggle has no badge
    expect(badgeContainers[2].nativeElement.hidden).toBe(true);
  });

  it("should show badge container when badge content is projected", () => {
    const badgeElement = fixtureWithBadge.debugElement.query(By.css("[bitBadge]"));
    expect(badgeElement).toBeTruthy();
    expect(badgeElement.nativeElement.textContent.trim()).toBe("2");
  });

  it("should render badge content correctly", () => {
    const badges = fixtureWithBadge.debugElement.queryAll(By.css("[bitBadge]"));
    expect(badges.length).toBe(1);
    expect(badges[0].nativeElement.textContent.trim()).toBe("2");
  });
});

@Component({
  selector: "test-component",
  template: `
    <bit-toggle-group [(selected)]="selected">
      <bit-toggle [value]="0">Zero</bit-toggle>
      <bit-toggle [value]="1">One</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestComponent {
  readonly selected = signal(0);
}

@Component({
  selector: "test-component-with-badge",
  template: `
    <bit-toggle-group [(selected)]="selected">
      <bit-toggle [value]="0">Zero</bit-toggle>
      <bit-toggle [value]="1">One <span bitBadge variant="info">2</span></bit-toggle>
      <bit-toggle [value]="2">Two</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule, BadgeModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestComponentWithBadgeComponent {
  readonly selected = signal(0);
}
