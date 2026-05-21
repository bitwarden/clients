import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BulkActionButtonComponent } from "./bulk-action-button.component";

@Component({
  imports: [BulkActionButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      bitBulkAction
      icon="bwi-trash"
      [disabled]="disabled()"
      (click)="onClick()"
    >
      Delete
    </button>
  `,
})
class HostComponent {
  readonly disabled = signal(false);
  readonly clicks = signal(0);
  onClick() {
    this.clicks.update((v) => v + 1);
  }
}

describe("BulkActionButtonComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const button = () => fixture.nativeElement.querySelector("button") as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("prepends a hidden bit-icon as the host button's first child", () => {
    const first = button().firstElementChild as HTMLElement;
    expect(first.tagName.toLowerCase()).toBe("bit-icon");
    expect(first.classList.contains("bwi-trash")).toBe(true);
    expect(first.getAttribute("aria-hidden")).toBe("true");
  });

  it("projects the host button's label text after the icon", () => {
    expect(button().textContent?.trim()).toBe("Delete");
  });

  it("forwards the consumer's (click) handler", () => {
    button().click();
    expect(host.clicks()).toBe(1);
  });

  it("respects the consumer's [disabled] binding", () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(button().disabled).toBe(true);
    button().click();
    expect(host.clicks()).toBe(0);
  });
});
