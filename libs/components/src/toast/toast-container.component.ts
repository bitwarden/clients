import { Component, OnInit, ViewChild } from "@angular/core";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

@Component({
  selector: "bit-toast-container",
  templateUrl: "toast-container.component.html",
  standalone: true,
  imports: [ToastContainerDirective],
})
export class ToastContainerComponent implements OnInit {
  @ViewChild(ToastContainerDirective, { static: true })
  toastContainer?: ToastContainerDirective;

  constructor(private toastrService: ToastrService) {}

  ngOnInit(): void {
    this.toastrService.overlayContainer = this.toastContainer;
  }
}
