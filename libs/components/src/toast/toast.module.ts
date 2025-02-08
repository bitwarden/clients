import { ModuleWithProviders, NgModule } from "@angular/core";
import { DefaultNoComponentGlobalConfig, GlobalConfig, TOAST_CONFIG } from "ngx-toastr";

import { ToastContainerComponent } from "./toast-container.component";
import { BitwardenToastrComponent } from "./toastr.component";

@NgModule({
  imports: [BitwardenToastrComponent, ToastContainerComponent],
  exports: [BitwardenToastrComponent, ToastContainerComponent],
})
export class ToastModule {
  static forRoot(config: Partial<GlobalConfig> = {}): ModuleWithProviders<ToastModule> {
    return {
      ngModule: ToastModule,
      providers: [
        {
          provide: TOAST_CONFIG,
          useValue: {
            default: BitwardenToastrGlobalConfig,
            config: config,
          },
        },
      ],
    };
  }
}

export const BitwardenToastrGlobalConfig: GlobalConfig = {
  ...DefaultNoComponentGlobalConfig,
  toastComponent: BitwardenToastrComponent,
  tapToDismiss: false,
  timeOut: 5000,
  extendedTimeOut: 2000,
  maxOpened: 5,
  autoDismiss: true,
  progressBar: true,
};
