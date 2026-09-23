import { Dialog, DialogRef } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { dialogOver, dialogWith } from "./dialog-mock";
import { injectObscuredByDialog } from "./obscured-by-dialog";

@Component({
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly obscured = injectObscuredByDialog();
}

describe("injectObscuredByDialog", () => {
  let openDialogs: DialogRef[];
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    openDialogs = [];

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: Dialog, useValue: dialogWith(openDialogs) }],
    });

    fixture = TestBed.createComponent(HostComponent);
  });

  it("is false when no dialog is open", () => {
    expect(fixture.componentInstance.obscured()).toBe(false);
  });

  it("is true when the host sits outside the open dialog", () => {
    openDialogs.push(dialogOver(document.createElement("div")));

    expect(fixture.componentInstance.obscured()).toBe(true);
  });

  it("is false when the host sits inside the open dialog", () => {
    openDialogs.push(dialogOver(document.body));

    expect(fixture.componentInstance.obscured()).toBe(false);
  });

  it("consults only the topmost dialog", () => {
    openDialogs.push(dialogOver(document.body), dialogOver(document.createElement("div")));

    expect(fixture.componentInstance.obscured()).toBe(true);
  });

  it("consults only the topmost dialog when the host is inside it", () => {
    openDialogs.push(dialogOver(document.createElement("div")), dialogOver(document.body));

    expect(fixture.componentInstance.obscured()).toBe(false);
  });
});
