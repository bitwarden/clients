import { Component, OnInit } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "user-provisioning",
  templateUrl: "user-provisioning.component.html",
})
export class UserProvisioningComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
