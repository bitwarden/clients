import { Component, OnInit, viewChild, ElementRef, AfterViewInit } from "@angular/core";
import { ToastContainerDirective, ToastrService } from "ngx-toastr";

@Component({
  selector: "bit-toast-container",
  templateUrl: "toast-container.component.html",
  imports: [ToastContainerDirective],
})
export class ToastContainerComponent implements OnInit, AfterViewInit {
  readonly toastContainer = viewChild(ToastContainerDirective);

  constructor(
    private toastrService: ToastrService,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.toastrService.overlayContainer = this.toastContainer();
  }

  ngAfterViewInit(): void {
    // Move toast container to document body level to match CDK overlay container placement.
    // This ensures toast z-index (999999) can compete with dialog z-index (2000) in the same stacking context.
    // Without this, on small screens toasts appear behind dialogs due to separate stacking contexts.
    document.body.appendChild(this.elementRef.nativeElement);
  }
}
