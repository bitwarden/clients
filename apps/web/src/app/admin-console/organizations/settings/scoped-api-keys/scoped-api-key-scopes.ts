export type ScopedApiKeyScope = {
  value: string;
  controlName: string;
  labelKey: string;
  warningKey?: string;
};

export type ScopedApiKeyScopeGroup = {
  labelKey: string;
  scopes: ScopedApiKeyScope[];
};

export const ScopedApiKeyScopeGroups: readonly ScopedApiKeyScopeGroup[] = Object.freeze([
  {
    labelKey: "members",
    scopes: [
      {
        value: "api.organization.members.read",
        controlName: "membersRead",
        labelKey: "scopedApiKeyScopeRead",
      },
      {
        value: "api.organization.members.write",
        controlName: "membersWrite",
        labelKey: "scopedApiKeyScopeWrite",
        warningKey: "scopedApiKeyCollectionAccessWarning",
      },
    ],
  },
  {
    labelKey: "groups",
    scopes: [
      {
        value: "api.organization.groups.read",
        controlName: "groupsRead",
        labelKey: "scopedApiKeyScopeRead",
      },
      {
        value: "api.organization.groups.write",
        controlName: "groupsWrite",
        labelKey: "scopedApiKeyScopeWrite",
        warningKey: "scopedApiKeyCollectionAccessWarning",
      },
    ],
  },
  {
    labelKey: "collections",
    scopes: [
      {
        value: "api.organization.collections.read",
        controlName: "collectionsRead",
        labelKey: "scopedApiKeyScopeRead",
      },
      {
        value: "api.organization.collections.write",
        controlName: "collectionsWrite",
        labelKey: "scopedApiKeyScopeWrite",
        warningKey: "scopedApiKeyCollectionAccessWarning",
      },
    ],
  },
  {
    labelKey: "policies",
    scopes: [
      {
        value: "api.organization.policies.read",
        controlName: "policiesRead",
        labelKey: "scopedApiKeyScopeRead",
      },
    ],
  },
  {
    labelKey: "eventLogs",
    scopes: [
      {
        value: "api.organization.events.read",
        controlName: "eventsRead",
        labelKey: "scopedApiKeyScopeRead",
      },
    ],
  },
  {
    labelKey: "subscription",
    scopes: [
      {
        value: "api.organization.subscription.read",
        controlName: "subscriptionRead",
        labelKey: "scopedApiKeyScopeRead",
      },
      {
        value: "api.organization.subscription.write",
        controlName: "subscriptionWrite",
        labelKey: "scopedApiKeyScopeWrite",
        warningKey: "scopedApiKeyBillingWarning",
      },
    ],
  },
]);

export const ScopedApiKeyScopes: readonly ScopedApiKeyScope[] = ScopedApiKeyScopeGroups.flatMap(
  (group) => group.scopes,
);
