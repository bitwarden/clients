import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { injectObscuredByDialog } from "./obscured-by-dialog";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly obscured = injectObscuredByDialog();
}

// Only identity is compared, so empty objects stand in for dialog refs.
const newDialog = () => ({}) as DialogRef;

describe("injectObscuredByDialog", () => {
  let openDialogs: DialogRef[];

  const createHost = (ownDialog?: DialogRef) => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: Dialog, useValue: { openDialogs } as unknown as Dialog },
        { provide: DialogRef, useValue: ownDialog ?? null },
      ],
    });

    return TestBed.createComponent(HostComponent).componentInstance;
  };

  beforeEach(() => {
    openDialogs = [];
  });

  it("is false when no dialog is open", () => {
    expect(createHost().obscured()).toBe(false);
  });

  it("is true when the host sits outside the open dialog", () => {
    openDialogs.push(newDialog());

    expect(createHost().obscured()).toBe(true);
  });

  it("is false when the host sits inside the open dialog", () => {
    const own = newDialog();
    openDialogs.push(own);

    expect(createHost(own).obscured()).toBe(false);
  });

  it("is true when the host's dialog is covered by another", () => {
    const own = newDialog();
    openDialogs.push(own, newDialog());

    expect(createHost(own).obscured()).toBe(true);
  });

  it("is false when the host's dialog is on top of another", () => {
    const own = newDialog();
    openDialogs.push(newDialog(), own);

    expect(createHost(own).obscured()).toBe(false);
  });
});
