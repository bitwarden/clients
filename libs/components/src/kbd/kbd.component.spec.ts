import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { BitKbdComponent } from "./kbd.component";

@Component({
  imports: [BitKbdComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<bit-kbd [keys]="keys()" />`,
})
class HostComponent {
  readonly keys = signal<string[]>(["modifier", "F"]);
}

describe("BitKbdComponent", () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const labels = () =>
    Array.from(fixture.nativeElement.querySelectorAll("kbd")).map((key) =>
      (key as HTMLElement).textContent?.trim(),
    );

  const setKeys = (keys: string[]) => {
    host.keys.set(keys);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders one kbd per key", () => {
    setKeys(["Ctrl", "Shift", "P"]);

    expect(labels()).toEqual(["Ctrl", "Shift", "P"]);
  });

  it("joins the keys with +", () => {
    setKeys(["Ctrl", "P"]);

    expect(fixture.nativeElement.textContent.replace(/\s+/g, "")).toBe("Ctrl+P");
  });

  it("renders nothing for an empty list", () => {
    setKeys([]);

    expect(labels()).toEqual([]);
  });

  it("passes unknown tokens through verbatim", () => {
    setKeys(["Esc", "F13", "🙂"]);

    expect(labels()).toEqual(["Esc", "F13", "🙂"]);
  });

  describe("the modifier token", () => {
    // jsdom reports a Linux-ish navigator, so the seed is Ctrl.
    it("resolves to Ctrl off a Mac", () => {
      expect(labels()).toEqual(["Ctrl", "F"]);
    });

    it("resolves to the Command glyph once a Cmd chord proves the platform", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true }));
      fixture.detectChanges();

      expect(labels()).toEqual(["⌘", "F"]);
    });

    it("is only the exact token, not a key that merely contains it", () => {
      setKeys(["Modifier", "modifiers"]);

      expect(labels()).toEqual(["Modifier", "modifiers"]);
    });
  });
});
