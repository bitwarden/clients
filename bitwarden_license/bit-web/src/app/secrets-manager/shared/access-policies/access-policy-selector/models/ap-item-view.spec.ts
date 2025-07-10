import {
  GroupAccessPolicyView,
  ServiceAccountAccessPolicyView,
  UserAccessPolicyView,
} from "../../../../models/view/access-policies/access-policy.view";
import { ProjectPeopleAccessPoliciesView } from "../../../../models/view/access-policies/project-people-access-policies.view";
import { ProjectServiceAccountsAccessPoliciesView } from "../../../../models/view/access-policies/project-service-accounts-access-policies.view";
import { SecretAccessPoliciesView } from "../../../../models/view/access-policies/secret-access-policies.view";
import { ServiceAccountGrantedPoliciesView } from "../../../../models/view/access-policies/service-account-granted-policies.view";
import { ServiceAccountPeopleAccessPoliciesView } from "../../../../models/view/access-policies/service-account-people-access-policies.view";

import {
  convertGrantedPoliciesToAccessPolicyItemViews,
  convertProjectServiceAccountsViewToApItemViews,
  convertSecretAccessPoliciesToApItemViews,
  convertToAccessPolicyItemViews,
} from "./ap-item-view.type";
import { ApItemEnum } from "./enums/ap-item.enum";
import { ApPermissionEnum } from "./enums/ap-permission.enum";

describe("convertToAccessPolicyItemViews", () => {
  it("should convert ProjectPeopleAccessPoliciesView to ApItemViewType array", () => {
    const accessPoliciesView: ProjectPeopleAccessPoliciesView = createPeopleAccessPoliciesView();

    const result = convertToAccessPolicyItemViews(accessPoliciesView);

    expect(result).toEqual([...expectedUserApItemViews, ...expectedGroupApItemViews]);
  });

  it("should convert empty ProjectPeopleAccessPoliciesView to empty ApItemViewType array", () => {
    const accessPoliciesView = new ProjectPeopleAccessPoliciesView();
    accessPoliciesView.userAccessPolicies = [];
    accessPoliciesView.groupAccessPolicies = [];

    const result = convertToAccessPolicyItemViews(accessPoliciesView);

    expect(result).toEqual([]);
  });

  it("should convert ServiceAccountPeopleAccessPoliciesView to ApItemViewType array", () => {
    const accessPoliciesView: ServiceAccountPeopleAccessPoliciesView =
      createPeopleAccessPoliciesView();

    const result = convertToAccessPolicyItemViews(accessPoliciesView);

    expect(result).toEqual([...expectedUserApItemViews, ...expectedGroupApItemViews]);
  });

  it("should convert empty ServiceAccountPeopleAccessPoliciesView to empty ApItemViewType array", () => {
    const accessPoliciesView = new ServiceAccountPeopleAccessPoliciesView();
    accessPoliciesView.userAccessPolicies = [];
    accessPoliciesView.groupAccessPolicies = [];

    const result = convertToAccessPolicyItemViews(accessPoliciesView);

    expect(result).toEqual([]);
  });
});

describe("convertGrantedPoliciesToAccessPolicyItemViews", () => {
  it("should convert ServiceAccountGrantedPoliciesView to ApItemViewType array", () => {
    const grantedPoliciesView: ServiceAccountGrantedPoliciesView = createGrantedPoliciesView();

    const result = convertGrantedPoliciesToAccessPolicyItemViews(grantedPoliciesView);

    expect(result).toEqual(expectedGrantedProjectApItemViews);
  });

  it("should convert empty ServiceAccountGrantedPoliciesView to empty ApItemViewType array", () => {
    const grantedPoliciesView = new ServiceAccountGrantedPoliciesView();
    grantedPoliciesView.grantedProjectPolicies = [];

    const result = convertGrantedPoliciesToAccessPolicyItemViews(grantedPoliciesView);

    expect(result).toEqual([]);
  });
});

describe("convertProjectServiceAccountsViewToApItemViews", () => {
  it("should convert ProjectServiceAccountsAccessPoliciesView to ApItemViewType array", () => {
    const accessPoliciesView = createProjectServiceAccountsAccessPoliciesView();

    const result = convertProjectServiceAccountsViewToApItemViews(accessPoliciesView);

    expect(result).toEqual([...expectedServiceAccountAccessPolicyViews]);
  });

  it("should convert empty ProjectPeopleAccessPoliciesView to empty ApItemViewType array", () => {
    const accessPoliciesView = new ProjectServiceAccountsAccessPoliciesView();
    accessPoliciesView.serviceAccountAccessPolicies = [];

    const result = convertProjectServiceAccountsViewToApItemViews(accessPoliciesView);

    expect(result).toEqual([]);
  });
});

describe("convertSecretAccessPoliciesToApItemViews", () => {
  it("should convert SecretAccessPoliciesView to ApItemViewType array", () => {
    const accessPoliciesView = createSecretAccessPoliciesView();

    const result = convertSecretAccessPoliciesToApItemViews(accessPoliciesView);

    expect(result).toEqual([
      ...expectedUserApItemViews,
      ...expectedGroupApItemViews,
      ...expectedServiceAccountAccessPolicyViews,
    ]);
  });

  it("should convert empty SecretAccessPoliciesView to empty ApItemViewType array", () => {
    const accessPoliciesView = new SecretAccessPoliciesView();
    accessPoliciesView.userAccessPolicies = [];
    accessPoliciesView.groupAccessPolicies = [];
    accessPoliciesView.serviceAccountAccessPolicies = [];

    const result = convertSecretAccessPoliciesToApItemViews(accessPoliciesView);

    expect(result).toEqual([]);
  });
});

function createUserAccessPolicyViews(): UserAccessPolicyView[] {
  return [
    {
      organizationUserId: "1",
      organizationUserName: "Example organization user name",
      read: true,
      write: false,
      currentUser: true,
    },
    {
      organizationUserId: "2",
      organizationUserName: "Example organization user name",
      read: true,
      write: true,
      currentUser: false,
    },
  ];
}

const expectedUserApItemViews = [
  {
    type: ApItemEnum.User,
    icon: "bwi-user",
    id: "1",
    labelName: "Example organization user name",
    listName: "Example organization user name",
    permission: ApPermissionEnum.CanRead,
    currentUser: true,
    readOnly: false,
  },
  {
    type: ApItemEnum.User,
    icon: "bwi-user",
    id: "2",
    labelName: "Example organization user name",
    listName: "Example organization user name",
    permission: ApPermissionEnum.CanReadWrite,
    currentUser: false,
    readOnly: false,
  },
];

function createGroupAccessPolicyViews(): GroupAccessPolicyView[] {
  return [
    {
      groupId: "3",
      groupName: "Example group name",
      currentUserInGroup: true,
      read: true,
      write: false,
    },
    {
      groupId: "4",
      groupName: "Example group name",
      currentUserInGroup: false,
      read: true,
      write: true,
    },
  ];
}

const expectedGroupApItemViews = [
  {
    type: ApItemEnum.Group,
    icon: "bwi-family",
    id: "3",
    labelName: "Example group name",
    listName: "Example group name",
    permission: ApPermissionEnum.CanRead,
    currentUserInGroup: true,
    readOnly: false,
  },
  {
    type: ApItemEnum.Group,
    icon: "bwi-family",
    id: "4",
    labelName: "Example group name",
    listName: "Example group name",
    permission: ApPermissionEnum.CanReadWrite,
    currentUserInGroup: false,
    readOnly: false,
  },
];

function createServiceAccountAccessPolicyViews(): ServiceAccountAccessPolicyView[] {
  return [
    {
      serviceAccountId: "5",
      serviceAccountName: "service account name",
      read: true,
      write: false,
    },
    {
      serviceAccountId: "6",
      serviceAccountName: "service account name",
      read: true,
      write: true,
    },
  ];
}

const expectedServiceAccountAccessPolicyViews = [
  {
    type: ApItemEnum.ServiceAccount,
    icon: "bwi-wrench",
    id: "5",
    labelName: "service account name",
    listName: "service account name",
    permission: ApPermissionEnum.CanRead,
    readOnly: false,
  },
  {
    type: ApItemEnum.ServiceAccount,
    icon: "bwi-wrench",
    id: "6",
    labelName: "service account name",
    listName: "service account name",
    permission: ApPermissionEnum.CanReadWrite,
    readOnly: false,
  },
];

function createGrantedPoliciesView() {
  return {
    grantedProjectPolicies: [
      {
        accessPolicy: {
          grantedProjectId: "1",
          grantedProjectName: "Example project name",
          read: true,
          write: false,
        },
        hasPermission: true,
      },
      {
        accessPolicy: {
          grantedProjectId: "2",
          grantedProjectName: "project name",
          read: true,
          write: true,
        },
        hasPermission: false,
      },
    ],
  };
}

const expectedGrantedProjectApItemViews = [
  {
    type: ApItemEnum.Project,
    icon: "bwi-collection",
    id: "1",
    labelName: "Example project name",
    listName: "Example project name",
    permission: ApPermissionEnum.CanRead,
    readOnly: false,
  },
  {
    type: ApItemEnum.Project,
    icon: "bwi-collection",
    id: "2",
    labelName: "project name",
    listName: "project name",
    permission: ApPermissionEnum.CanReadWrite,
    readOnly: true,
  },
];

function createPeopleAccessPoliciesView() {
  return {
    userAccessPolicies: createUserAccessPolicyViews(),
    groupAccessPolicies: createGroupAccessPolicyViews(),
  };
}

function createProjectServiceAccountsAccessPoliciesView(): ProjectServiceAccountsAccessPoliciesView {
  return {
    serviceAccountAccessPolicies: createServiceAccountAccessPolicyViews(),
  };
}

function createSecretAccessPoliciesView(): SecretAccessPoliciesView {
  return {
    userAccessPolicies: createUserAccessPolicyViews(),
    groupAccessPolicies: createGroupAccessPolicyViews(),
    serviceAccountAccessPolicies: createServiceAccountAccessPolicyViews(),
  };
}
