import { ChangeDetectionStrategy, Component, inject, OnInit, viewChild } from "@angular/core";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

@Component({
  selector: "bit-toast-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "toast-container.component.html",
  imports: [ToastContainerDirective],
})
export class ToastContainerComponent implements OnInit {
  private readonly toastrService = inject(ToastrService);

  readonly toastContainer = viewChild(ToastContainerDirective);

  ngOnInit(): void {
    this.toastrService.overlayContainer = this.toastContainer();
  }
}
