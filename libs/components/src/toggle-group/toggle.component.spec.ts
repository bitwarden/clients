import { ChangeDetectionStrategy, Component, DebugElement, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { BerryComponent } from "../berry";

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
  let fixtureWithBerry: ComponentFixture<TestComponentWithBerryComponent>;
  let berryContainers: DebugElement[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestComponentWithBerryComponent],
    });

    await TestBed.compileComponents();
    fixtureWithBerry = TestBed.createComponent(TestComponentWithBerryComponent);
    fixtureWithBerry.detectChanges();
    berryContainers = fixtureWithBerry.debugElement.queryAll(By.css(".tw-shrink-0"));
  });

  it("should hide berry container when no berry content is projected", () => {
    // First toggle has no berry
    expect(berryContainers[0].nativeElement.hidden).toBe(true);

    // Second toggle has a berry
    expect(berryContainers[1].nativeElement.hidden).toBe(false);

    // Third toggle has no berry
    expect(berryContainers[2].nativeElement.hidden).toBe(true);
  });

  it("should show berry container when berry content is projected", () => {
    const berryElement = fixtureWithBerry.debugElement.query(By.css("bit-berry"));
    expect(berryElement).toBeTruthy();
    expect(berryElement.nativeElement.textContent.trim()).toBe("2");
  });

  it("should render berry content correctly", () => {
    const berryies = fixtureWithBerry.debugElement.queryAll(By.css("bit-berry"));
    expect(berryies.length).toBe(1);
    expect(berryies[0].nativeElement.textContent.trim()).toBe("2");
  });

  it("should set berry variant to 'primary' when toggle is not selected", () => {
    // value=1 toggle has the berry, but selected=0, so berry should be primary
    const berryComponent = fixtureWithBerry.debugElement.query(By.directive(BerryComponent))
      .componentInstance as BerryComponent;
    expect(berryComponent.variant()).toBe("primary");
  });

  it("should set berry variant to 'contrast' when toggle is selected", () => {
    const toggleGroup = fixtureWithBerry.debugElement.query(By.directive(ToggleGroupComponent))
      .componentInstance as ToggleGroupComponent;

    toggleGroup.onInputInteraction(1); // select the toggle that has the berry
    fixtureWithBerry.detectChanges();

    const berryComponent = fixtureWithBerry.debugElement.query(By.directive(BerryComponent))
      .componentInstance as BerryComponent;
    expect(berryComponent.variant()).toBe("contrast");
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
      <bit-toggle [value]="1">One <bit-berry [value]="2"></bit-berry></bit-toggle>
      <bit-toggle [value]="2">Two</bit-toggle>
    </bit-toggle-group>
  `,
  imports: [ToggleGroupModule, BerryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestComponentWithBerryComponent {
  readonly selected = signal(0);
}
