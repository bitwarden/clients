import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ErrorCardComponent } from "./error-card.component";

describe("ErrorCardComponent", () => {
  let fixture: ComponentFixture<ErrorCardComponent>;
  let component: ErrorCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("title", "Something went wrong");
    fixture.componentRef.setInput("description", "We could not load your subscription.");
  });

  const textContent = () => (fixture.nativeElement as HTMLElement).textContent ?? "";

  it("renders the title and description", () => {
    fixture.detectChanges();

    expect(textContent()).toContain("Something went wrong");
    expect(textContent()).toContain("We could not load your subscription.");
  });

  it("does not render an action button when no button text is provided", () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });

  it("renders the action button when button text is provided", () => {
    fixture.componentRef.setInput("buttonText", "Refresh");
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain("Refresh");
  });

  it("emits actionClicked when the button is clicked", () => {
    fixture.componentRef.setInput("buttonText", "Refresh");
    fixture.detectChanges();
    const emit = jest.spyOn(component.actionClicked, "emit");

    (fixture.nativeElement.querySelector("button") as HTMLButtonElement).click();

    expect(emit).toHaveBeenCalledTimes(1);
  });
});
