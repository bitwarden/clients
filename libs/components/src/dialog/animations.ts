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

export const ANIMATION_IN_DURATION = 150; // in milliseconds
export const ANIMATION_OUT_DURATION = 300; // in milliseconds

export const dialogAnimation = trigger("dialogAnimation", [
  transition("void => dialog", [
    style({ opacity: 0, transform: "translateY(-50px)" }),
    group([
      animate(`${ANIMATION_IN_DURATION}ms linear`, style({ opacity: 1 })),
      animate(`${ANIMATION_OUT_DURATION}ms linear`, style({ transform: "none" })),
    ]),
  ]),
  transition("void => drawer", [
    style({ opacity: 0, transform: "translateX(50px)" }),
    group([
      animate(`${ANIMATION_IN_DURATION}ms linear`, style({ opacity: 1 })),
      animate(`${ANIMATION_OUT_DURATION}ms linear`, style({ transform: "none" })),
    ]),
  ]),
]);
