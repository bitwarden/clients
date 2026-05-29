import { Component, ChangeDetectionStrategy } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

@Component({
  selector: "app-test-carousel-slide",
  imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
      imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
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
    fixture.detectChanges();
    jest.spyOn(component.slideChange, "emit");

    backButton.nativeElement.click();

    expect(component.slideChange.emit).toHaveBeenCalledWith(0);
  });
});

@Component({
  selector: "app-test-carousel-hide-arrows",
  imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <vault-carousel [hideArrows]="true" label="No Arrows Test">
      <vault-carousel-slide label="Slide 1"><p>Content 1</p></vault-carousel-slide>
      <vault-carousel-slide label="Slide 2"><p>Content 2</p></vault-carousel-slide>
      <div carouselActions>
        <button type="button" data-testid="action-btn">Custom Action</button>
      </div>
    </vault-carousel>
  `,
})
class TestCarouselHideArrowsComponent {}

describe("VaultCarouselComponent with hideArrows", () => {
  let fixture: ComponentFixture<TestCarouselHideArrowsComponent>;
  let carouselComponent: VaultCarouselComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestCarouselHideArrowsComponent);
    fixture.detectChanges();
    carouselComponent = fixture.debugElement.query(
      By.directive(VaultCarouselComponent),
    ).componentInstance;
  });

  it("hides navigation arrow buttons when hideArrows is true", () => {
    const iconButtons = fixture.debugElement.queryAll(By.css("[bitIconButton]"));
    expect(iconButtons.length).toBe(0);
  });

  it("renders carouselActions slot content", () => {
    const actionBtn = fixture.debugElement.query(By.css("[data-testid='action-btn']"));
    expect(actionBtn).not.toBeNull();
  });

  it("nextSlide advances to the next slide", () => {
    const slideChangeSpy = jest.spyOn(carouselComponent.slideChange, "emit");
    carouselComponent.nextSlide();
    fixture.detectChanges();
    expect(slideChangeSpy).toHaveBeenCalledWith(1);
  });

  it("prevSlide goes back to the previous slide after advancing", () => {
    carouselComponent.nextSlide();
    fixture.detectChanges();
    const slideChangeSpy = jest.spyOn(carouselComponent.slideChange, "emit");
    carouselComponent.prevSlide();
    fixture.detectChanges();
    expect(slideChangeSpy).toHaveBeenCalledWith(0);
  });
});
