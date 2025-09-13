// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ComponentRef, Injectable, Injector, Type, ViewContainerRef, Inject } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { DynamicModalComponent } from "../components/modal/dynamic-modal.component";
import { ModalInjector } from "../components/modal/modal-injector";
import { ModalRef } from "../components/modal/modal.ref";

/**
 * @deprecated Use the Component Library's `DialogService` instead.
 */
@Injectable()
export class ModalService {
  protected modalList: ComponentRef<DynamicModalComponent>[] = [];

  constructor(private injector: Injector, @Inject(DOCUMENT) private readonly document: Document) {
    // Guard for SSR/Electron contexts where document may be undefined or not a real DOM
    this.document?.addEventListener("keyup", (event) => {
      if (event.key === "Escape" && this.modalCount > 0) {
        this.topModal.instance.close();
      }
    });
  }

  get modalCount() {
    return this.modalList.length;
  }

  private get topModal() {
    return this.modalList[this.modalCount - 1];
  }

  /**
   * @deprecated Use `dialogService.open` instead.
   * If replacing an existing call to this method, also remove any `@ViewChild` and `<ng-template>` associated with the
   * existing usage.
   */
  async openViewRef<T>(
    componentType: Type<T>,
    viewContainerRef: ViewContainerRef,
    setComponentParameters: (component: T) => void = null,
  ): Promise<[ModalRef, T]> {
    const [modalRef, modalComponentRef] = this.openInternal(viewContainerRef, componentType);
    modalComponentRef.instance.setComponentParameters = setComponentParameters;

    viewContainerRef.insert(modalComponentRef.hostView);

  await firstValueFrom(modalRef.onCreated);

    return [modalRef, modalComponentRef.instance.componentRef.instance];
  }

  closeAll(): void {
    this.modalList.forEach((modal) => modal.instance.close());
  }

  protected openInternal(
    viewContainerRef: ViewContainerRef,
    componentType: Type<any>,
  ): [ModalRef, ComponentRef<any>] {
    const [modalRef, componentRef] = this.createModalComponent(viewContainerRef);
    componentRef.instance.childComponentType = componentType;

    modalRef.onClosed.pipe(first()).subscribe(() => {
      componentRef.destroy();

      this.modalList.pop();
      if (this.modalCount > 0) {
        this.topModal.instance.getFocus();
      }
    });

    this.setupHandlers(modalRef);

    this.modalList.push(componentRef);

    return [modalRef, componentRef];
  }

  protected setupHandlers(modalRef: ModalRef) {
    let backdrop: HTMLElement = null;

    // Add backdrop, setup [data-dismiss] handler.
    modalRef.onCreated.pipe(first()).subscribe((el: HTMLElement) => {
      if (!this.document) {
        return;
      }
      this.document.body?.classList.add("modal-open");

      const modalEl: HTMLElement = el.querySelector(".modal");
      const dialogEl = modalEl.querySelector(".modal-dialog") as HTMLElement;

      backdrop = this.document.createElement("div");
      backdrop.className = "modal-backdrop fade";
      backdrop.style.zIndex = `${this.modalCount}040`;
      modalEl.prepend(backdrop);

      dialogEl.addEventListener("click", (e: Event) => {
        e.stopPropagation();
      });
      dialogEl.style.zIndex = `${this.modalCount}050`;

      const modals: Element[] = Array.from(
        el.querySelectorAll('.modal-backdrop, .modal *[data-dismiss="modal"]'),
      );
      for (const closeElement of modals) {
        closeElement.addEventListener("click", () => {
          modalRef.close();
        });
      }
    });

    // onClose is used in Web to hook into bootstrap. On other projects we pipe it directly to closed.
    modalRef.onClose.pipe(first()).subscribe(() => {
      modalRef.closed();

      if (this.modalCount === 0) {
        this.document?.body?.classList.remove("modal-open");
      }
    });
  }

  protected createModalComponent(
    viewContainerRef: ViewContainerRef,
  ): [ModalRef, ComponentRef<any>] {
    const modalRef = new ModalRef();

    const map = new WeakMap();
    map.set(ModalRef, modalRef);

    const injector = new ModalInjector(this.injector, map);
    const componentRef = viewContainerRef.createComponent(DynamicModalComponent, { injector });

    return [modalRef, componentRef];
  }
}
