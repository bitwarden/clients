import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

@Component({
  selector: "app-test-carousel-slide",
  imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
  template: `
    <vault-carousel label="Storybook Demo">
      <vault-carousel-slide label="First Slide">
        <h1>First Carousel Heading</h1>
      </vault-carousel-slide>
      <vault-carousel-slide label="Second Slide">
        <h1>Second Carousel Heading</h1>
      </vault-carousel-slide>
      <vault-carousel-slide label="Third Slide">
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
      imports: [VaultCarouselComponent, VaultCarouselSlideComponent, PreloadedEnglishI18nModule],
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
    fixture.debugElement.queryAll(By.css("button"))[2].nativeElement.click();
    fixture.detectChanges();

    const heading = fixture.debugElement.query(By.css("h1")).nativeElement;

    expect(heading.textContent).toBe("Second Carousel Heading");
  });

  it("sets the initial focused button as the first button", () => {
    expect(component["keyManager"]?.activeItemIndex).toBe(0);
  });

  it('emits "slideChange" event when slide changes', () => {
    jest.spyOn(component.slideChange, "emit");

    const thirdSlideButton = fixture.debugElement.queryAll(By.css("button"))[3];

    thirdSlideButton.nativeElement.click();

    expect(component.slideChange.emit).toHaveBeenCalledWith(2);
  });

  it('advances to the next slide when the "next" button is pressed', () => {
    const middleSlideButton = fixture.debugElement.queryAll(By.css("button"))[2];
    const nextButton = fixture.debugElement.queryAll(By.css("button"))[4];

    middleSlideButton.nativeElement.click();

    jest.spyOn(component.slideChange, "emit");

    nextButton.nativeElement.click();

    expect(component.slideChange.emit).toHaveBeenCalledWith(2);
  });

  it('advances to the previous slide when the "back" button is pressed', async () => {
    const middleSlideButton = fixture.debugElement.queryAll(By.css("button"))[2];
    const backButton = fixture.debugElement.queryAll(By.css("button"))[0];

    middleSlideButton.nativeElement.click();
    await new Promise((r) => setTimeout(r, 100)); // Give time for the DOM to update.

    jest.spyOn(component.slideChange, "emit");

    backButton.nativeElement.click();

    expect(component.slideChange.emit).toHaveBeenCalledWith(0);
  });
});
