import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SpotlightComponent } from "./spotlight.component";

describe("SpotlightComponent", () => {
  let fixture: ComponentFixture<SpotlightComponent>;
  let component: SpotlightComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpotlightComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SpotlightComponent);
    component = fixture.componentInstance;
  });

  function detect(): void {
    fixture.detectChanges();
  }

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("rendering when inputs are null", () => {
    it("should render without crashing when inputs are null/undefined", () => {
      // Explicitly drive the inputs to null to exercise template null branches
      fixture.componentRef.setInput("title", null);
      fixture.componentRef.setInput("subtitle", null);
      fixture.componentRef.setInput("buttonText", null);
      fixture.componentRef.setInput("buttonIcon", null);
      // persistent has a default, but drive it as well for coverage sanity
      fixture.componentRef.setInput("persistent", false);

      expect(() => detect()).not.toThrow();

      const root = fixture.debugElement.nativeElement as HTMLElement;
      expect(root).toBeTruthy();
    });
  });

  describe("close button visibility based on persistent", () => {
    it("should show the close button when persistent is false", () => {
      fixture.componentRef.setInput("persistent", false);
      detect();

      // Assumes dismiss uses bitIconButton
      const dismissButton = fixture.debugElement.query(By.css("button[bitIconButton]"));

      expect(dismissButton).toBeTruthy();
    });

    it("should hide the close button when persistent is true", () => {
      fixture.componentRef.setInput("persistent", true);
      detect();

      const dismissButton = fixture.debugElement.query(By.css("button[bitIconButton]"));
      expect(dismissButton).toBeNull();
    });
  });

  describe("event emission", () => {
    it("should emit onButtonClick when CTA button is clicked", () => {
      const clickSpy = jest.fn();
      component.onButtonClick.subscribe(clickSpy);

      fixture.componentRef.setInput("buttonText", "Click me");
      detect();

      const buttonDe = fixture.debugElement.query(By.css("button[bitButton]"));
      expect(buttonDe).toBeTruthy();

      const event = new MouseEvent("click");
      buttonDe.triggerEventHandler("click", event);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
    });

    it("should emit onDismiss when close button is clicked", () => {
      const dismissSpy = jest.fn();
      component.onDismiss.subscribe(dismissSpy);

      fixture.componentRef.setInput("persistent", false);
      detect();

      const dismissButton = fixture.debugElement.query(By.css("button[bitIconButton]"));
      expect(dismissButton).toBeTruthy();

      dismissButton.triggerEventHandler("click", new MouseEvent("click"));

      expect(dismissSpy).toHaveBeenCalledTimes(1);
    });

    it("handleButtonClick should emit via onButtonClick()", () => {
      const clickSpy = jest.fn();
      component.onButtonClick.subscribe(clickSpy);

      const event = new MouseEvent("click");
      component.handleButtonClick(event);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy.mock.calls[0][0]).toBe(event);
    });

    it("handleDismiss should emit via onDismiss()", () => {
      const dismissSpy = jest.fn();
      component.onDismiss.subscribe(dismissSpy);

      component.handleDismiss();

      expect(dismissSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("content projection behavior", () => {
    @Component({
      standalone: true,
      imports: [SpotlightComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <bit-spotlight>
          <span class="tw-text-sm">Projected content</span>
        </bit-spotlight>
      `,
    })
    class HostWithProjectionComponent {}

    let hostFixture: ComponentFixture<HostWithProjectionComponent>;

    beforeEach(async () => {
      hostFixture = TestBed.createComponent(HostWithProjectionComponent);
    });

    it("should render projected content inside the spotlight", () => {
      hostFixture.detectChanges();

      const projected = hostFixture.debugElement.query(By.css(".tw-text-sm"));
      expect(projected).toBeTruthy();
      expect(projected.nativeElement.textContent.trim()).toBe("Projected content");
    });
  });

  describe("boolean attribute transform for persistent", () => {
    @Component({
      standalone: true,
      imports: [CommonModule, SpotlightComponent],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <!-- bare persistent attribute -->
        <bit-spotlight *ngIf="mode === 'bare'" persistent></bit-spotlight>

        <!-- no persistent attribute -->
        <bit-spotlight *ngIf="mode === 'none'"></bit-spotlight>

        <!-- explicit persistent="false" -->
        <bit-spotlight *ngIf="mode === 'falseStr'" persistent="false"></bit-spotlight>
      `,
    })
    class BooleanHostComponent {
      mode: "bare" | "none" | "falseStr" = "bare";
    }

    let boolFixture: ComponentFixture<BooleanHostComponent>;
    let boolHost: BooleanHostComponent;

    beforeEach(async () => {
      boolFixture = TestBed.createComponent(BooleanHostComponent);
      boolHost = boolFixture.componentInstance;
    });

    function getSpotlight(): SpotlightComponent {
      const de = boolFixture.debugElement.query(By.directive(SpotlightComponent));
      return de.componentInstance as SpotlightComponent;
    }

    it("treats bare 'persistent' attribute as true via booleanAttribute", () => {
      boolHost.mode = "bare";
      boolFixture.detectChanges();

      const spotlight = getSpotlight();
      expect(spotlight.persistent()).toBe(true);
    });

    it("uses default false when 'persistent' is omitted", () => {
      boolHost.mode = "none";
      boolFixture.detectChanges();

      const spotlight = getSpotlight();
      expect(spotlight.persistent()).toBe(false);
    });

    it('treats persistent="false" as false', () => {
      boolHost.mode = "falseStr";
      boolFixture.detectChanges();

      const spotlight = getSpotlight();
      expect(spotlight.persistent()).toBe(false);
    });
  });
});
