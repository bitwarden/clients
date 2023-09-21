import {
  ApplicationRef,
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef,
  EmbeddedViewRef,
  Injectable,
  Injector,
  Type,
  ViewContainerRef,
} from "@angular/core";
import { first } from "rxjs/operators";

import { DynamicModalComponent } from "../components/modal/dynamic-modal.component";
import { ModalInjector } from "../components/modal/modal-injector";
import { ModalRef } from "../components/modal/modal.ref";

export class ModalConfig<D = any> {
  data?: D;
  allowMultipleModals?: boolean;
  replaceTopModal?: boolean;
}

/**
 * @deprecated Use the Component Library's `DialogService` instead.
 */
@Injectable()
export class ModalService {
  protected modalList: ComponentRef<DynamicModalComponent>[] = [];

  // Lazy loaded modules are not available in componentFactoryResolver,
  // therefore modules needs to manually initialize their resolvers.
  private factoryResolvers: Map<Type<any>, ComponentFactoryResolver> = new Map();

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private applicationRef: ApplicationRef,
    private injector: Injector
  ) {
    document.addEventListener("keyup", (event) => {
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
    setComponentParameters: (component: T) => void = null
  ): Promise<[ModalRef, T]> {
    const [modalRef, modalComponentRef] = this.openInternal(componentType, null, false);
    modalComponentRef.instance.setComponentParameters = setComponentParameters;

    viewContainerRef.insert(modalComponentRef.hostView);

    await modalRef.onCreated.pipe(first()).toPromise();

    return [modalRef, modalComponentRef.instance.componentRef.instance];
  }

  open(componentType: Type<any>, config: ModalConfig = {}) {
    const { replaceTopModal = false, allowMultipleModals = false } = config;

    if (this.modalCount > 0 && replaceTopModal) {
      this.topModal.instance.close();
    }

    if (this.modalCount > 0 && !allowMultipleModals) {
      return;
    }

    const [modalRef] = this.openInternal(componentType, config, true);

    return modalRef;
  }

  registerComponentFactoryResolver<T>(
    componentType: Type<T>,
    componentFactoryResolver: ComponentFactoryResolver
  ): void {
    this.factoryResolvers.set(componentType, componentFactoryResolver);
  }

  resolveComponentFactory<T>(componentType: Type<T>): ComponentFactory<T> {
    if (this.factoryResolvers.has(componentType)) {
      return this.factoryResolvers.get(componentType).resolveComponentFactory(componentType);
    }

    return this.componentFactoryResolver.resolveComponentFactory(componentType);
  }

  closeAll(): void {
    this.modalList.forEach((modal) => modal.instance.close());
  }

  protected openInternal(
    componentType: Type<any>,
    config?: ModalConfig,
    attachToDom?: boolean
  ): [ModalRef, ComponentRef<DynamicModalComponent>] {
    const [modalRef, componentRef] = this.createModalComponent(config);
    componentRef.instance.childComponentType = componentType;

    if (attachToDom) {
      this.applicationRef.attachView(componentRef.hostView);
      const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
      document.body.appendChild(domElem);
    }

    modalRef.onClosed.pipe(first()).subscribe(() => {
      if (attachToDom) {
        this.applicationRef.detachView(componentRef.hostView);
      }
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
    modalRef.onCreated.pipe(first()).subscribe((el) => {
      document.body.classList.add("modal-open");

      const modalEl: HTMLElement = el.querySelector(".modal");
      const dialogEl = modalEl.querySelector(".modal-dialog") as HTMLElement;

      backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop fade";
      backdrop.style.zIndex = `${this.modalCount}040`;
      modalEl.prepend(backdrop);

      dialogEl.addEventListener("click", (e: Event) => {
        e.stopPropagation();
      });
      dialogEl.style.zIndex = `${this.modalCount}050`;

      const modals = Array.from(
        el.querySelectorAll('.modal-backdrop, .modal *[data-dismiss="modal"]')
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
        document.body.classList.remove("modal-open");
      }
    });
  }

  protected createModalComponent(
    config: ModalConfig
  ): [ModalRef, ComponentRef<DynamicModalComponent>] {
    const modalRef = new ModalRef();

    const map = new WeakMap();
    map.set(ModalConfig, config);
    map.set(ModalRef, modalRef);

    const componentFactory =
      this.componentFactoryResolver.resolveComponentFactory(DynamicModalComponent);
    const componentRef = componentFactory.create(new ModalInjector(this.injector, map));

    return [modalRef, componentRef];
  }
}
