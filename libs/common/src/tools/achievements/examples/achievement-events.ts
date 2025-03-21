import { UserId } from "../../../types/guid";
import { AchievementEarnedEvent, AchievementProgressEvent } from "../types";

import {
  CredentialGeneratedProgress,
  ItemCreatedAchievement,
  ItemCreatedProgress,
  ThreeItemsCreatedAchievement,
} from "./example-validators";

const ItemCreatedEarnedEvent: AchievementEarnedEvent = {
  "@timestamp": Date.now(),
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "earned", name: ItemCreatedAchievement },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

const NextItemCreatedEarnedEvent: AchievementEarnedEvent = {
  "@timestamp": Date.now() + 100,
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "earned", name: ItemCreatedAchievement },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

const ThreeItemsCreatedEarnedEvent: AchievementEarnedEvent = {
  "@timestamp": Date.now(),
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "earned", name: ThreeItemsCreatedAchievement },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

const ItemCreatedProgressEvent: AchievementProgressEvent = {
  "@timestamp": Date.now(),
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "progress", name: ItemCreatedProgress, value: 1 },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

const NextItemCreatedProgressEvent: AchievementProgressEvent = {
  "@timestamp": Date.now() + 100,
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "progress", name: ItemCreatedProgress, value: 2 },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

const CredentialGeneratedProgressEvent: AchievementProgressEvent = {
  "@timestamp": Date.now(),
  event: {
    kind: "metric",
    category: "session",
  },
  achievement: { type: "progress", name: CredentialGeneratedProgress, value: 1 },
  service: {
    name: "extension",
    type: "client",
    node: {
      name: "an-installation-identifier-for-this-client-instance",
    },
    version: "2025.3.1-innovation-sprint",
  },
  user: {
    id: "some-guid" as UserId,
  },
};

export {
  CredentialGeneratedProgressEvent,
  ItemCreatedEarnedEvent,
  ItemCreatedProgressEvent,
  NextItemCreatedEarnedEvent,
  NextItemCreatedProgressEvent,
  ThreeItemsCreatedEarnedEvent,
};
