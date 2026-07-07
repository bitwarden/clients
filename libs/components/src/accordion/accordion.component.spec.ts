import { ChangeDetectionStrategy, Component, signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { AccordionGroupComponent } from "./accordion-group.component";
import { AccordionComponent } from "./accordion.component";

describe("AccordionComponent", () => {
  let component: AccordionComponent;
  let fixture: ComponentFixture<AccordionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccordionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AccordionComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("title", "Test Heading");
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });

  describe("default state", () => {
    it("is collapsed by default", () => {
      expect(component.open()).toBe(false);
    });

    it("hides content panel when collapsed", () => {
      const panel = fixture.nativeElement.querySelector(`#${component.contentId}`);
      expect(panel.getAttribute("aria-hidden")).toBe("true");
    });

    it("button has aria-expanded=false when closed", () => {
      expect(fixture.nativeElement.querySelector("button").getAttribute("aria-expanded")).toBe(
        "false",
      );
    });

    it("shows chevron-down icon when collapsed", () => {
      expect(fixture.nativeElement.querySelector("bit-icon").classList).toContain("bwi-angle-down");
    });
  });

  describe("toggle", () => {
    it("opens when button is clicked", () => {
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(true);
    });

    it("closes again on second click", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(false);
    });

    it("renders content panel when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(`#${component.contentId}`)).toBeTruthy();
    });

    it("button has aria-expanded=true when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("button").getAttribute("aria-expanded")).toBe(
        "true",
      );
    });

    it("shows chevron-up icon when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("bit-icon").classList).toContain("bwi-angle-up");
    });
  });

  describe("accessibility", () => {
    it("button aria-controls matches content panel id when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector("button");
      const panel = fixture.nativeElement.querySelector(`#${component.contentId}`);
      expect(btn.getAttribute("aria-controls")).toBe(panel.id);
    });

    it("content panel has role=region when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(`#${component.contentId}`).getAttribute("role"),
      ).toBe("region");
    });

    it("content panel aria-labelledby points to trigger button id when open", () => {
      fixture.componentRef.setInput("open", true);
      fixture.detectChanges();
      expect(
        fixture.nativeElement
          .querySelector(`#${component.contentId}`)
          .getAttribute("aria-labelledby"),
      ).toBe(component.triggerId);
    });

    it("chevron icon has aria-hidden=true", () => {
      expect(fixture.nativeElement.querySelector("bit-icon").getAttribute("aria-hidden")).toBe(
        "true",
      );
    });
  });

  describe("disabled", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();
    });

    it("does not toggle when clicked", () => {
      fixture.nativeElement.querySelector("button").click();
      fixture.detectChanges();
      expect(component.open()).toBe(false);
    });

    it("button has disabled attribute", () => {
      expect(fixture.nativeElement.querySelector("button").hasAttribute("disabled")).toBe(true);
    });
  });

  describe("subtitle", () => {
    it("shows subtitle when provided", () => {
      fixture.componentRef.setInput("subtitle", "My subtitle");
      fixture.detectChanges();
      const spans = fixture.nativeElement.querySelectorAll("button span");
      const found = Array.from(spans).some((el: any) => el.textContent.trim() === "My subtitle");
      expect(found).toBe(true);
    });

    it("does not render subtitle span when not provided", () => {
      fixture.detectChanges();
      const spans = fixture.nativeElement.querySelectorAll("button span");
      expect(spans.length).toBe(1);
    });
  });
});

describe("AccordionComponent in singleSelect group", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let accordions: AccordionComponent[];
  let triggers: HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    accordions = fixture.debugElement
      .queryAll(By.css("bit-accordion"))
      .map((e) => e.componentInstance);
    triggers = fixture.debugElement
      .queryAll(By.css("button"))
      .map((e) => e.nativeElement as HTMLButtonElement);
  });

  it("closes the previously open row when another is opened via two-way binding", () => {
    host.firstOpen.set(true);
    fixture.detectChanges();
    expect(accordions[0].open()).toBe(true);

    host.secondOpen.set(true);
    fixture.detectChanges();

    expect(accordions[1].open()).toBe(true);
    expect(accordions[0].open()).toBe(false);
    expect(host.firstOpen()).toBe(false);
  });

  it("closes the previously open row when another is opened by click", () => {
    triggers[0].click();
    fixture.detectChanges();
    expect(accordions[0].open()).toBe(true);

    triggers[1].click();
    fixture.detectChanges();

    expect(accordions[1].open()).toBe(true);
    expect(accordions[0].open()).toBe(false);
  });
});

describe("AccordionComponent in non-singleSelect group", () => {
  it("allows multiple rows to remain open when bound externally", () => {
    TestBed.configureTestingModule({ imports: [MultiSelectHostComponent] });
    const fixture = TestBed.createComponent(MultiSelectHostComponent);
    fixture.detectChanges();
    const accordions = fixture.debugElement
      .queryAll(By.css("bit-accordion"))
      .map((e) => e.componentInstance as AccordionComponent);

    fixture.componentInstance.firstOpen.set(true);
    fixture.componentInstance.secondOpen.set(true);
    fixture.detectChanges();

    expect(accordions[0].open()).toBe(true);
    expect(accordions[1].open()).toBe(true);
  });
});

@Component({
  selector: "test-host",
  template: `
    <bit-accordion-group singleSelect>
      <bit-accordion title="First" [(open)]="firstOpen">First content</bit-accordion>
      <bit-accordion title="Second" [(open)]="secondOpen">Second content</bit-accordion>
    </bit-accordion-group>
  `,
  imports: [AccordionComponent, AccordionGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHostComponent {
  readonly firstOpen: WritableSignal<boolean> = signal(false);
  readonly secondOpen: WritableSignal<boolean> = signal(false);
}

@Component({
  selector: "multi-select-host",
  template: `
    <bit-accordion-group>
      <bit-accordion title="First" [(open)]="firstOpen">First content</bit-accordion>
      <bit-accordion title="Second" [(open)]="secondOpen">Second content</bit-accordion>
    </bit-accordion-group>
  `,
  imports: [AccordionComponent, AccordionGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MultiSelectHostComponent {
  readonly firstOpen: WritableSignal<boolean> = signal(false);
  readonly secondOpen: WritableSignal<boolean> = signal(false);
}
