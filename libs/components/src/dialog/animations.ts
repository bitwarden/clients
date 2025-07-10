import { style, animate, trigger, transition, group } from "@angular/animations";

export const fadeIn = trigger("fadeIn", [
  transition(":enter", [
    style({ opacity: 0, transform: "translateY(-50px)" }),
    group([
      animate("0.15s linear", style({ opacity: 1 })),
      animate("0.3s ease-out", style({ transform: "none" })),
    ]),
  ]),
]);
