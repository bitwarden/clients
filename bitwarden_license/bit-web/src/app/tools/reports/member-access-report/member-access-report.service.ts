import { Injectable } from "@angular/core";

import { MemberAccessReportView } from "./view/member-access-report.view";

@Injectable({ providedIn: "root" })
export class MemberAccessReportService {
  //Temporary method to provide mock data for test purposes only
  getMemberAccessMockData(): MemberAccessReportView[] {
    const memberAccess = new MemberAccessReportView();
    memberAccess.email = "sjohnson@email.com";
    memberAccess.name = "Sarah Johnson";
    memberAccess.groups = 3;
    memberAccess.collections = 12;
    memberAccess.items = 3;

    const memberAccess2 = new MemberAccessReportView();
    memberAccess2.email = "jlull@email.com";
    memberAccess2.name = "James Lull";
    memberAccess2.groups = 2;
    memberAccess2.collections = 24;
    memberAccess2.items = 2;

    const memberAccess3 = new MemberAccessReportView();
    memberAccess3.email = "bwilliams@email.com";
    memberAccess3.name = "Beth Williams";
    memberAccess3.groups = 6;
    memberAccess3.collections = 12;
    memberAccess3.items = 1;

    const memberAccess4 = new MemberAccessReportView();
    memberAccess4.email = "rwilliams@email.com";
    memberAccess4.name = "Ray Williams";
    memberAccess4.groups = 5;
    memberAccess4.collections = 21;
    memberAccess4.items = 2;

    return [memberAccess, memberAccess2, memberAccess3, memberAccess4];
  }
}
