import { Component, HostBinding } from "@angular/core";

@Component({
  selector: "app-auth-card",
  templateUrl: "card.component.html",
  standalone: true,
})
export class CardComponent {
  @HostBinding("class") class = "tw-w-full";
}
