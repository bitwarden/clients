import { TemplatePortal } from "@angular/cdk/portal";
import { Component, OnInit, TemplateRef, ViewChild, ViewContainerRef } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { VaultCarouselContentComponent } from "./carousel-content.component";

@Component({
  selector: "app-test-template-ref",
  standalone: true,
  imports: [VaultCarouselContentComponent],
  template: `
    <ng-template #template>
      <p>Test Template Content</p>
    </ng-template>
    <vault-carousel-content [content]="portal"></vault-carousel-content>
  `,
})
class TestTemplateRefComponent implements OnInit {
  // Test template content by creating a wrapping component and then pass a portal to the carousel content component.
  @ViewChild("template", { static: true }) template!: TemplateRef<any>;
  portal!: TemplatePortal;

  constructor(private viewContainerRef: ViewContainerRef) {}

  ngOnInit() {
    this.portal = new TemplatePortal(this.template, this.viewContainerRef);
  }
}

describe("VaultCarouselContentComponent", () => {
  let fixture: ComponentFixture<TestTemplateRefComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCarouselContentComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestTemplateRefComponent);
    fixture.detectChanges();
  });

  it("displays content", () => {
    const carouselContent = fixture.debugElement.query(By.directive(VaultCarouselContentComponent));

    expect(carouselContent.nativeElement.textContent).toBe("Test Template Content");
  });

  it("sets aria attributes for screen readers", () => {
    const carouselContent = fixture.debugElement.query(By.directive(VaultCarouselContentComponent));
    const wrappingDiv = carouselContent.nativeElement.querySelector("div");

    expect(wrappingDiv.getAttribute("aria-live")).toBe("polite");
    expect(wrappingDiv.getAttribute("aria-atomic")).toBe("false");
  });
});
