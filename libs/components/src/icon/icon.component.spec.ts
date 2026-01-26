import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BitIconComponent } from "./icon.component";

describe("BitIconComponent", () => {
  let fixture: ComponentFixture<BitIconComponent>;
  let component: BitIconComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BitIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BitIconComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("icon", "bwi-lock");
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should apply base icon class", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains("bwi")).toBe(true);
    expect(el.classList.contains("bwi-lock")).toBe(true);
  });

  it("should apply fw class when fw is true", () => {
    fixture.componentRef.setInput("fw", true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains("bwi-fw")).toBe(true);
  });

  it("should apply spin class when spin is true", () => {
    fixture.componentRef.setInput("spin", true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains("bwi-spin")).toBe(true);
  });

  it("should apply size class when size is provided", () => {
    fixture.componentRef.setInput("size", "lg");
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains("bwi-lg")).toBe(true);
  });

  it("should set aria-label when provided", () => {
    fixture.componentRef.setInput("ariaLabel", "Lock icon");
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute("aria-label")).toBe("Lock icon");
    expect(el.getAttribute("aria-hidden")).toBe(null);
  });

  it("should set aria-hidden when no aria-label is provided", () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
});
