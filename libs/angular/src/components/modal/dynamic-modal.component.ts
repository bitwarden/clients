// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ConfigurableFocusTrap, ConfigurableFocusTrapFactory } from "@angular/cdk/a11y";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  ElementRef,
  OnDestroy,
  Type,
  ViewChild,
  ViewContainerRef,
} from "@angular/core";

import { ModalRef } from "./modal.ref";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-modal",
  template: "<ng-template #modalContent></ng-template>",
  standalone: false,
})
export class DynamicModalComponent implements AfterViewInit, OnDestroy {
  componentRef: ComponentRef<any>;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("modalContent", { read: ViewContainerRef, static: true })
  modalContentRef: ViewContainerRef;

  childComponentType: Type<any>;
  setComponentParameters: (component: any) => void;

  private focusTrap: ConfigurableFocusTrap;

  constructor(
    private cd: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
    private focusTrapFactory: ConfigurableFocusTrapFactory,
    public modalRef: ModalRef,
  ) {}

  ngAfterViewInit() {
    this.loadChildComponent(this.childComponentType);
    if (this.setComponentParameters != null) {
      this.setComponentParameters(this.componentRef.instance);
    }
    this.cd.detectChanges();

    this.modalRef.created(this.el.nativeElement);
    this.focusTrap = this.focusTrapFactory.create(
      this.el.nativeElement.querySelector(".modal-dialog"),
    );
    if (this.el.nativeElement.querySelector("[appAutoFocus]") == null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.focusTrap.focusFirstTabbableElementWhenReady();
    }
  }

  loadChildComponent(componentType: Type<any>) {
    this.modalContentRef.clear();
    this.componentRef = this.modalContentRef.createComponent(componentType);
  }

  ngOnDestroy() {
    if (this.componentRef) {
      this.componentRef.destroy();
    }
    this.focusTrap.destroy();
  }

  close() {
    this.modalRef.close();
  }

  getFocus() {
    const autoFocusEl = this.el.nativeElement.querySelector("[appAutoFocus]") as HTMLElement;
    autoFocusEl?.focus();
  }
}
