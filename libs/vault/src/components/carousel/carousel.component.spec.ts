import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

@Component({
  selector: "app-test-carousel-slide",
  standalone: true,
  imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
  template: `
    <vault-carousel label="Storybook Demo">
      <vault-carousel-slide>
        <h1>First Carousel Heading</h1>
      </vault-carousel-slide>
      <vault-carousel-slide>
        <h1>Second Carousel Heading</h1>
      </vault-carousel-slide>
      <vault-carousel-slide>
        <h1>Third Carousel Heading</h1>
      </vault-carousel-slide>
    </vault-carousel>
  `,
})
class TestCarouselComponent {
  // Test carousel by creating a wrapping component.
}

describe("VaultCarouselComponent", () => {
  let fixture: ComponentFixture<TestCarouselComponent>;
  let component: VaultCarouselComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TestCarouselComponent);
    fixture.detectChanges();
    component = fixture.debugElement.query(By.directive(VaultCarouselComponent)).componentInstance;
  });

  it("sets first slide as active by default", () => {
    expect(component["selectedIndex"]).toBe(0);
  });

  it("shows the active slides content", () => {
    // Set the second slide as active
    fixture.debugElement.queryAll(By.css("button"))[1].nativeElement.click();
    fixture.detectChanges();

    const heading = fixture.debugElement.query(By.css("h1")).nativeElement;

    expect(heading.textContent).toBe("Second Carousel Heading");
  });

  it("sets the initial focused button as the first button", () => {
    expect(component["keyManager"]?.activeItemIndex).toBe(0);
  });
});
