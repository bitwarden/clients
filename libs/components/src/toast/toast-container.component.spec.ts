import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

import { ToastContainerComponent } from "./toast-container.component";

describe("ToastContainerComponent", () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let component: ToastContainerComponent;
  let toastrService: MockProxy<ToastrService>;

  beforeEach(async () => {
    toastrService = mock<ToastrService>();

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [{ provide: ToastrService, useValue: toastrService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainerComponent);
    component = fixture.componentInstance;
  });

  it("should create component and resolve toastContainer directive", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component.toastContainer()).toBeDefined();
    expect(component.toastContainer()).toBeInstanceOf(ToastContainerDirective);
  });

  it("should register overlayContainer with toastrService after view initializes", () => {
    fixture.detectChanges();
    expect(toastrService.overlayContainer).toBe(component.toastContainer());
  });

  it("should render accessible live container in DOM", () => {
    fixture.detectChanges();
    const containerEl = fixture.debugElement.query(By.directive(ToastContainerDirective));
    expect(containerEl).not.toBeNull();
    expect(containerEl.nativeElement.getAttribute("role")).toBe("status");
    expect(containerEl.nativeElement.getAttribute("aria-live")).toBe("polite");
    expect(containerEl.nativeElement.getAttribute("aria-atomic")).toBe("true");
  });
});
