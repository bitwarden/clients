import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AnchorPartDirective, AnchorParts } from "./anchor-parts";

@Component({
  selector: "test-scope",
  imports: [AnchorPartDirective],
  providers: [AnchorParts],
  template: `
    @if (shown()) {
      <button type="button" [bitAnchorPart]="name()">{{ name() }}</button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestScopeComponent {
  readonly anchors = inject(AnchorParts);
  readonly shown = signal(true);
  readonly name = signal("target");
}

describe("AnchorParts", () => {
  const create = () => {
    const fixture = TestBed.createComponent(TestScopeComponent);
    fixture.detectChanges();
    return fixture;
  };

  it("registers a tagged element under its name", () => {
    const fixture = create();

    expect(fixture.componentInstance.anchors.get("target")?.tagName).toBe("BUTTON");
  });

  it("unregisters the element when it is destroyed", () => {
    const fixture = create();
    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.anchors.get("target")).toBeUndefined();
  });

  it("moves the element when its name changes", () => {
    const fixture = create();
    fixture.componentInstance.name.set("renamed");
    fixture.detectChanges();

    const { anchors } = fixture.componentInstance;
    expect(anchors.get("target")).toBeUndefined();
    expect(anchors.get("renamed")?.tagName).toBe("BUTTON");
  });

  it("keeps each provider's names separate", () => {
    const first = create();
    const second = create();

    expect(first.componentInstance.anchors.get("target")).not.toBe(
      second.componentInstance.anchors.get("target"),
    );
  });

  it("ignores an unregister from an element that no longer holds the name", () => {
    const anchors = new AnchorParts();
    const stale = document.createElement("div");
    const current = document.createElement("div");
    anchors.register("target", stale);
    anchors.register("target", current);
    anchors.unregister("target", stale);

    expect(anchors.get("target")).toBe(current);
  });
});
