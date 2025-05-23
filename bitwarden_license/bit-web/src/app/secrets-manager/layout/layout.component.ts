import { Component, OnInit } from "@angular/core";

@Component({
  selector: "sm-layout",
  templateUrl: "./layout.component.html",
  standalone: false,
})
export class LayoutComponent implements OnInit {
  ngOnInit() {
    document.body.classList.remove("layout_frontend");
  }
}
