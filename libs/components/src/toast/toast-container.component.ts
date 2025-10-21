import { Component, OnInit, viewChild } from "@angular/core";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-toast-container",
  templateUrl: "toast-container.component.html",
  imports: [ToastContainerDirective],
})
export class ToastContainerComponent implements OnInit {
  readonly toastContainer = viewChild(ToastContainerDirective);

  constructor(private toastrService: ToastrService) {}

  ngOnInit(): void {
    this.toastrService.overlayContainer = this.toastContainer();
  }
}
