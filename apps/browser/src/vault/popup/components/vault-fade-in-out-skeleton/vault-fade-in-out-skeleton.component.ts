import { animate, style, transition, trigger } from "@angular/animations";
import { ChangeDetectionStrategy, Component, HostBinding } from "@angular/core";

@Component({
  selector: "vault-fade-in-out-skeleton",
  templateUrl: "./vault-fade-in-out-skeleton.component.html",
  animations: [
    trigger("fadeInOut", [
      transition(":enter", [
        style({ opacity: 0 }),
        animate("100ms ease-in", style({ opacity: 1 })),
      ]),
      transition(":leave", [animate("300ms ease-out", style({ opacity: 0 }))]),
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultFadeInOutSkeletonComponent {
  @HostBinding("@fadeInOut") fadeInOut = true;
}
