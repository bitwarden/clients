import { CdkTextareaAutosize } from "@angular/cdk/text-field";
import { EventEmitter, NgZone } from "@angular/core";

import { VaultAutosizeReadOnlyTextArea } from "./readonly-textarea.directive";

describe("VaultAutosizeReadOnlyTextArea", () => {
  let directive: VaultAutosizeReadOnlyTextArea;
  let onStable: EventEmitter<void>;

  beforeEach(async () => {
    onStable = new EventEmitter<void>();

    directive = new VaultAutosizeReadOnlyTextArea(
      { enabled: undefined } as unknown as CdkTextareaAutosize,
      { onStable } as NgZone,
    );
  });

  it("disables CdkTextareaAutosize by default", () => {
    expect(directive["autosize"].enabled).toBe(false);
  });

  it("enables CdkTextareaAutosize after view init", async () => {
    expect(directive["autosize"].enabled).toBe(false);

    const viewInitPromise = directive.ngAfterViewInit();

    onStable.emit();

    await viewInitPromise;

    expect(directive["autosize"].enabled).toBe(true);
  });
});
