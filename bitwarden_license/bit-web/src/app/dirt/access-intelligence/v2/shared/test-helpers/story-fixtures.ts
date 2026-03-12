import { ApplicationHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { DrawerMemberData } from "../../models/drawer-content-data.types";

/**
 * Creates a mock cipher for Storybook stories
 * @param name - Display name for the cipher
 * @param id - Optional cipher ID (defaults to cipher-{name})
 */
export function createMockCipher(name: string, id?: string): CipherView {
  const cipher = new CipherView();
  cipher.name = name;
  cipher.id = id ?? `cipher-${name}`;
  return cipher;
}

/**
 * Creates sample application data for stories
 * @param count - Number of applications to create (defaults to all 7)
 * @returns Array of sample applications
 */
export function createSampleApplications(count: number = 7): ApplicationHealthView[] {
  const apps: Array<{
    name: string;
    members: Record<string, boolean>;
    ciphers: Record<string, boolean>;
  }> = [
    {
      name: "github.com",
      members: { u1: true, u2: false, u3: true },
      ciphers: { c1: true, c2: false, c3: true },
    },
    { name: "gitlab.com", members: { u4: true, u5: false }, ciphers: { c4: true, c5: false } },
    { name: "bitbucket.org", members: { u6: true }, ciphers: { c6: true, c7: true } },
    {
      name: "aws.amazon.com",
      members: { u7: true, u8: true, u9: true, u10: true },
      ciphers: { c8: true, c9: true, c10: true },
    },
    {
      name: "azure.microsoft.com",
      members: { u11: true, u12: false },
      ciphers: { c11: true, c12: false },
    },
    { name: "salesforce.com", members: { u13: false }, ciphers: { c13: false } },
    { name: "internal-app.company.com", members: {}, ciphers: { c14: false } },
  ];

  return apps.slice(0, count).map((app) => createReport(app.name, app.members, app.ciphers));
}

/**
 * Creates sample member data for drawer stories
 * @param count - Number of members to create (defaults to 5)
 */
export function createSampleMembers(count: number = 5): DrawerMemberData[] {
  const names = ["Alice Smith", "Bob Johnson", "Charlie Davis", "Diana Wilson", "Eve Martinez"];
  const emails = [
    "alice@example.com",
    "bob@example.com",
    "charlie@example.com",
    "diana@example.com",
    "eve@example.com",
  ];
  const atRiskCounts = [15, 8, 12, 5, 20];

  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    email: emails[i],
    userName: names[i],
    userGuid: `user-${i + 1}`,
    atRiskPasswordCount: atRiskCounts[i],
  }));
}

/**
 * Creates mock ciphers with icon data
 */
export function createMockCiphersWithIcons(): CipherView[] {
  return [
    createMockCipher("GitHub Login", "cipher-github"),
    createMockCipher("GitLab", "cipher-gitlab"),
    createMockCipher("Bitbucket", "cipher-bitbucket"),
    createMockCipher("AWS Console", "cipher-aws"),
    createMockCipher("Azure Portal", "cipher-azure"),
    createMockCipher("Salesforce", "cipher-salesforce"),
  ];
}

/**
 * Generates large dataset for performance testing
 */
export function createLargeDataset(count: number): DrawerMemberData[] {
  return Array.from({ length: count }, (_, i) => ({
    email: `user${i}@example.com`,
    userName: `User ${i}`,
    userGuid: `user-${i}`,
    // Use deterministic pattern instead of random: cycles through 1-25
    atRiskPasswordCount: (i % 25) + 1,
  }));
}
