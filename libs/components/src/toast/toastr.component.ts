import { animate, state, style, transition, trigger } from "@angular/animations";
import { Component } from "@angular/core";
import { Toast as BaseToastrComponent, ToastPackage, ToastrService } from "ngx-toastr";

import { ToastComponent } from "./toast.component";

@Component({
  template: `
    <bit-toast
      [title]="options?.payload?.title"
      [variant]="options?.payload?.variant"
      [message]="options?.payload?.message"
      [progressWidth]="width()"
      (onClose)="remove()"
    ></bit-toast>
  `,
  animations: [
    trigger("flyInOut", [
      state("inactive", style({ opacity: 0 })),
      state("active", style({ opacity: 1 })),
      state("removed", style({ opacity: 0 })),
      transition("inactive => active", animate("{{ easeTime }}ms {{ easing }}")),
      transition("active => removed", animate("{{ easeTime }}ms {{ easing }}")),
    ]),
  ],
  standalone: true,
  imports: [ToastComponent],
})
export class BitwardenToastrComponent extends BaseToastrComponent {
  constructor(toastrService: ToastrService, toastPackage: ToastPackage) {
    super(toastrService, toastPackage);
  }
}
