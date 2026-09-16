import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { VaultRemountOnDirective } from "./remount-on.directive";

@Component({
  selector: "vault-remount-child",
  template: "",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ChildComponent {
  static instances = 0;

  constructor() {
    ChildComponent.instances++;
  }
}

@Component({
  template: `<vault-remount-child *vaultRemountOn="key()"></vault-remount-child>`,
  imports: [ChildComponent, VaultRemountOnDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly key = signal("a");
}

describe("VaultRemountOnDirective", () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    ChildComponent.instances = 0;
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it("renders the view once for the initial key", () => {
    expect(ChildComponent.instances).toBe(1);
    expect(fixture.nativeElement.querySelectorAll("vault-remount-child").length).toBe(1);
  });

  it("re-creates the view when the key changes", () => {
    fixture.componentInstance.key.set("b");
    fixture.detectChanges();

    expect(ChildComponent.instances).toBe(2);
    expect(fixture.nativeElement.querySelectorAll("vault-remount-child").length).toBe(1);
  });

  it("keeps the view when the key is unchanged", () => {
    fixture.componentInstance.key.set("a");
    fixture.detectChanges();

    expect(ChildComponent.instances).toBe(1);
  });
});
