import { Observable, of } from "rxjs";

import { UserId } from "../../../types/guid";
import { UserActionEvent } from "../types";

const itemAdded$: Observable<UserActionEvent> = of({
  "@timestamp": Date.now(),
  user: {
    id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
  },
  event: {
    kind: "event",
    category: "session",
    type: "creation",
    outcome: "success",
    provider: "vault",
  },
  service: {
    name: "extension",
    type: "client",
    node: { name: "commotion-amused-rinse-trivial-sadly" },
    environment: "production",
    version: "2025.3.1-innovation-sprint",
  },
  action: "vault-item-added",
  labels: { "vault-item-type": "login", "vault-item-uri-quantity": 1 },
  tags: ["with-attachment"],
});

const itemUpdated$: Observable<UserActionEvent> = of({
  "@timestamp": Date.now(),
  user: {
    id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
  },
  event: {
    kind: "event",
    category: "session",
    type: "creation",
    outcome: "success",
    provider: "vault",
  },
  service: {
    name: "extension",
    type: "client",
    node: { name: "commotion-amused-rinse-trivial-sadly" },
    environment: "production",
    version: "2025.3.1-innovation-sprint",
  },
  action: "vault-item-updated",
  labels: { "vault-item-type": "login", "uri-quantity": 1 },
  tags: ["with-folder"],
});

const itemDeleted$: Observable<UserActionEvent> = of({
  "@timestamp": Date.now(),
  user: {
    id: "08f95669-1a65-4840-ba8b-3538cb3e1496" as UserId,
  },
  event: {
    kind: "event",
    category: "session",
    type: "deletion",
    outcome: "success",
    provider: "vault",
  },
  service: {
    name: "extension",
    type: "client",
    node: { name: "commotion-amused-rinse-trivial-sadly" },
    environment: "production",
    version: "2025.3.1-innovation-sprint",
  },
  action: "vault-item-removed",
  labels: { "vault-item-type": "login" },
  tags: [],
});

const itemMovedToCollection$: Observable<UserActionEvent> = of(
  {
    "@timestamp": Date.now(),
    user: {
      id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
    },
    event: {
      kind: "event",
      category: "session",
      type: "deletion",
      outcome: "success",
      provider: "vault",
    },
    service: {
      name: "extension",
      type: "client",
      node: { name: "commotion-amused-rinse-trivial-sadly" },
      environment: "production",
      version: "2025.3.1-innovation-sprint",
    },
    action: "vault-item-moved",
    labels: { "vault-item-type": "login", "uri-quantity": 1 },
    tags: ["collection"],
  } satisfies UserActionEvent,
  {
    "@timestamp": Date.now(),
    user: {
      id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
    },
    event: {
      kind: "event",
      category: "session",
      type: "info",
      outcome: "success",
      provider: "vault",
    },
    service: {
      name: "extension",
      type: "client",
      node: { name: "commotion-amused-rinse-trivial-sadly" },
      environment: "production",
      version: "2025.3.1-innovation-sprint",
    },
    action: "vault-item-moved",
    labels: { "vault-item-type": "login", "uri-quantity": 1 },
    tags: ["collection"],
  } satisfies UserActionEvent,
);

const sendAdded$: Observable<UserActionEvent> = of({
  "@timestamp": Date.now(),
  user: {
    id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
  },
  event: {
    kind: "event",
    category: "session",
    type: "creation",
    outcome: "success",
    provider: "send",
  },
  service: {
    name: "extension",
    type: "client",
    node: { name: "commotion-amused-rinse-trivial-sadly" },
    environment: "production",
    version: "2025.3.1-innovation-sprint",
  },
  action: "send-item-added",
  tags: ["with-attachment"],
});

const credentialGenerated$: Observable<UserActionEvent> = of({
  "@timestamp": Date.now(),
  user: {
    id: "1E2EDBC3-4449-4583-A4AC-ACDFA5C2EC71" as UserId,
  },
  event: {
    kind: "event",
    category: "session",
    type: "creation",
    outcome: "success",
    provider: "credential-generator",
  },
  service: {
    name: "extension",
    type: "client",
    node: { name: "commotion-amused-rinse-trivial-sadly" },
    environment: "production",
    version: "2025.3.1-innovation-sprint",
  },
  action: "credential-generated",
  labels: { algorithm: "password", "algorithm-category": "password", extension: "firefox" },
});

export {
  itemAdded$,
  itemUpdated$,
  itemDeleted$,
  itemMovedToCollection$,
  sendAdded$,
  credentialGenerated$,
};
