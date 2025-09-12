import { Component, OnInit, viewChild } from "@angular/core";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

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
