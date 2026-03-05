import { Component } from "@angular/core";

/**
 * bit-container is a minimally styled component that limits the max width of its content to the tailwind theme variable '4xl'. '4xl' is equal to the value of 56rem
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-container",
  templateUrl: "container.component.html",
})
export class ContainerComponent {}
