import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

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
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            // Deliberately not the English legends: these assertions would pass either way if
            // the mock echoed "Esc"/"Ctrl".
            new I18nMockService({
              keyEscape: "\u00c9chap",
              keyControl: "Strg",
              keyCommand: "Befehl",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders one kbd per key", () => {
    setKeys(["Shift", "Alt", "P"]);

    expect(labels()).toEqual(["Shift", "Alt", "P"]);
  });

  it("joins the keys with +", () => {
    setKeys(["Shift", "P"]);

    expect(fixture.nativeElement.textContent.replace(/\s+/g, "")).toBe("Shift+P");
  });

  it("renders nothing for an empty list", () => {
    setKeys([]);

    expect(labels()).toEqual([]);
  });

  it("passes unknown tokens through verbatim", () => {
    setKeys(["Enter", "F13", "🙂"]);

    expect(labels()).toEqual(["Enter", "F13", "🙂"]);
  });

  describe("localized legends", () => {
    it.each([
      ["Esc", "Échap"],
      ["Escape", "Échap"],
      ["Ctrl", "Strg"],
      ["Control", "Strg"],
      ["Command", "Befehl"],
    ])("renders %s as its localized legend", (token, expected) => {
      setKeys([token]);

      expect(labels()).toEqual([expected]);
    });

    it("matches the token regardless of case", () => {
      setKeys(["ESC", "control"]);

      expect(labels()).toEqual(["Échap", "Strg"]);
    });
  });

  describe("the modifier token", () => {
    // jsdom reports a Linux-ish navigator, so the seed is Ctrl.
    it("resolves to the localized Control legend off a Mac", () => {
      expect(labels()).toEqual(["Strg", "F"]);
    });

    // ⌘ is locale-independent, so it is never routed through i18n.
    it("resolves to the Command glyph once a Cmd chord proves the platform", () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true }));
      fixture.detectChanges();

      expect(labels()).toEqual(["⌘", "F"]);
    });

    it("is a case-sensitive sentinel, unlike the localized legends", () => {
      setKeys(["Modifier", "modifiers"]);

      expect(labels()).toEqual(["Modifier", "modifiers"]);
    });
  });
});
