import { TemplatePortal } from "@angular/cdk/portal";
import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { VaultCarouselSlideComponent } from "./carousel-slide.component";

@Component({
  selector: "app-test-carousel-slide",
  imports: [VaultCarouselSlideComponent],
  template: ` <vault-carousel-slide><p>Carousel Slide Content!</p></vault-carousel-slide> `,
})
class TestCarouselSlideComponent {
  // Test template content by creating a wrapping component.
}

describe("VaultCarouselSlideComponent", () => {
  let fixture: ComponentFixture<TestCarouselSlideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCarouselSlideComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestCarouselSlideComponent);
    fixture.detectChanges();
  });

  it("sets content", () => {
    const slideComponent = fixture.debugElement.query(
      By.directive(VaultCarouselSlideComponent),
    ).componentInstance;

    expect(slideComponent.content).not.toBeNull();
    expect(slideComponent.content).toBeInstanceOf(TemplatePortal);
  });
});
