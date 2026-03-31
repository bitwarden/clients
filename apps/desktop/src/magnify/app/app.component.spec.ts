import { ComponentFixture, TestBed } from "@angular/core/testing";

import { AppComponent } from "./app.component";

describe("AppComponent", () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates the component", () => {
    expect(component).toBeTruthy();
  });

  it("renders the magnify root element", () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector("p")?.textContent).toBe("Magnify");
  });
});
