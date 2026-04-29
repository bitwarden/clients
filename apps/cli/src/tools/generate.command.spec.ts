import { BehaviorSubject, of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Constraints } from "@bitwarden/common/tools/types";
import { unconstrained } from "@bitwarden/common/tools/util";
import { UserId } from "@bitwarden/common/types/guid";
import {
  CredentialGeneratorService,
  GeneratedCredential,
  GeneratorMetadata,
  providers,
} from "@bitwarden/generator-core";

import { GenerateCommand } from "./generate.command";

// Minimal account stub
const mockAccount: Account = {
  id: "test-user-id" as UserId,
  email: "test@example.com",
  emailVerified: true,
  name: "Test User",
  creationDate: undefined,
};

// Creates a mock engine that returns a fixed credential
function mockEngine(credential: string) {
  return {
    generate: jest
      .fn()
      .mockResolvedValue(new GeneratedCredential(credential, "password" as any, Date.now())),
  };
}

// Creates metadata with a mock engine, optional default constraints, and optional profiles
function mockMetadata(
  credential: string,
  defaultConstraints: Record<string, unknown> = {},
): GeneratorMetadata<any> {
  const engine = mockEngine(credential);
  return {
    id: "password" as any,
    type: "password" as any,
    weight: 100,
    i18nKeys: {} as any,
    capabilities: { autogenerate: false, fields: [] },
    engine: { create: () => engine },
    profiles: {
      account: {
        type: "core" as any,
        storage: {} as any,
        constraints: {
          default: defaultConstraints,
          create: () => ({
            adjust: (s: any) => ({ state: s, constraints: {} }),
            constraints: {},
          }),
        },
      },
    },
  } as any;
}

// Passthrough policy: no adjustments, no policy in effect
function passthroughPolicy() {
  return {
    adjust: (settings: any) => ({
      state: settings,
      constraints: { policyInEffect: false },
      applied: unconstrained<any>(),
    }),
    constraints: { policyInEffect: false },
  };
}

// Policy that overrides specific fields
function overridingPolicy(overrides: Record<string, unknown>, policyInEffect = false) {
  return {
    adjust: (settings: any) => {
      const adjusted = { ...settings, ...overrides };
      // Compute applied: only keys where the value changed
      const applied: Constraints<any> = {};
      for (const key of Object.keys(overrides)) {
        if (JSON.stringify(settings[key]) !== JSON.stringify(overrides[key])) {
          applied[key] = {};
        }
      }
      return {
        state: adjusted,
        constraints: { policyInEffect },
        applied: Object.keys(applied).length > 0 ? applied : unconstrained(),
      };
    },
    constraints: { policyInEffect },
  };
}

function createCommand(options: {
  account?: Account | null;
  savedSettings?: Record<string, unknown>;
  policy?: any;
  metadata?: GeneratorMetadata<any>;
  forwarderMetadata?: GeneratorMetadata<any>;
}) {
  const {
    account = mockAccount,
    savedSettings = {},
    policy = passthroughPolicy(),
    metadata,
    forwarderMetadata,
  } = options;

  const accountService = {
    activeAccount$: new BehaviorSubject(account),
  } as unknown as AccountService;

  const generatorService = {
    policy$: jest.fn().mockReturnValue(of(policy)),
    settings: jest.fn().mockReturnValue(new BehaviorSubject(savedSettings)),
    forwarder: jest.fn().mockImplementation((vendorId: string) => {
      if (forwarderMetadata) {
        return forwarderMetadata;
      }
      throw new Error(`invalid vendor: ${vendorId}`);
    }),
  } as unknown as CredentialGeneratorService;

  const generatorProvider = {} as providers.GeneratorDependencyProvider;

  // If custom metadata provided, override resolveAlgorithm to use it
  const command = new GenerateCommand(generatorService, generatorProvider, accountService);

  if (metadata) {
    // Patch the built-in metadata resolution so all non-forwarded paths use our mock
    const origResolve = (command as any).resolveAlgorithm.bind(command);
    (command as any).resolveAlgorithm = (opts: any) => {
      const result = origResolve(opts);
      if (opts.email !== "forwarded") {
        result.metadata = metadata;
      }
      return result;
    };
  }

  return command;
}

describe("GenerateCommand", () => {
  describe("account checks", () => {
    it("returns error when not logged in", async () => {
      const command = createCommand({ account: null });
      const response = await command.run({});

      expect(response.success).toBe(false);
      expect(response.message).toContain("not logged in");
    });
  });

  describe("password flag mapping", () => {
    it("maps -u -l --length to password settings", async () => {
      const meta = mockMetadata("Ab3xK9mPqR7w2sYt4j");
      const command = createCommand({ metadata: meta });

      const response = await command.run({
        uppercase: true,
        lowercase: true,
        length: "18",
      });

      expect(response.success).toBe(true);
      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.objectContaining({ algorithm: meta.id }),
        expect.objectContaining({ uppercase: true, lowercase: true, length: 18 }),
      );
    });

    it("parses numeric string options to integers", async () => {
      const meta = mockMetadata("test123");
      const command = createCommand({ metadata: meta });

      await command.run({ length: "25", minNumber: "3", minSpecial: "2" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ length: 25, minNumber: 3, minSpecial: 2 }),
      );
    });

    it("returns error for non-numeric --length", async () => {
      const command = createCommand({});

      const response = await command.run({ length: "abc" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("--length must be a number");
    });

    it("returns error for non-numeric --minNumber", async () => {
      const command = createCommand({});

      const response = await command.run({ minNumber: "xyz" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("--minNumber must be a number");
    });

    it("returns error for non-numeric --words", async () => {
      const command = createCommand({});

      const response = await command.run({ passphrase: true, words: "abc" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("--words must be a number");
    });

    it("inverts --ambiguous flag", async () => {
      const meta = mockMetadata("test123");
      const command = createCommand({ metadata: meta });

      await command.run({ ambiguous: true });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ambiguous: false }),
      );
    });
  });

  describe("passphrase flag mapping", () => {
    it("maps --words and --separator", async () => {
      const meta = mockMetadata("correct-horse-battery");
      const command = createCommand({ metadata: meta });

      await command.run({ passphrase: true, words: "5", separator: "_" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ numWords: 5, wordSeparator: "_" }),
      );
    });

    it("normalizes separator 'space' to actual space", async () => {
      const meta = mockMetadata("correct horse battery");
      const command = createCommand({ metadata: meta });

      await command.run({ passphrase: true, separator: "space" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ wordSeparator: " " }),
      );
    });

    it("normalizes separator 'empty' to empty string", async () => {
      const meta = mockMetadata("correcthorsebattery");
      const command = createCommand({ metadata: meta });

      await command.run({ passphrase: true, separator: "empty" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ wordSeparator: "" }),
      );
    });

    it("truncates multi-character separator to first character", async () => {
      const meta = mockMetadata("correct--horse");
      const command = createCommand({ metadata: meta });

      await command.run({ passphrase: true, separator: "--" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ wordSeparator: "-" }),
      );
    });
  });

  describe("username flag mapping", () => {
    it("maps --capitalize to wordCapitalize", async () => {
      const meta = mockMetadata("TestWord");
      const command = createCommand({ metadata: meta });

      await command.run({ username: true, capitalize: true, includeNumber: true });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ wordCapitalize: true, wordIncludeNumber: true }),
      );
    });
  });

  describe("catchall flag mapping", () => {
    it("maps --domain and --catchall-type", async () => {
      const meta = mockMetadata("random@example.com");
      const command = createCommand({ metadata: meta });

      await command.run({ email: "catchall", domain: "example.com", catchallType: "random" });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ catchallDomain: "example.com", catchallType: "random" }),
      );
    });
  });

  describe("subaddress flag mapping", () => {
    it("maps --email-address and --subaddress-type", async () => {
      const meta = mockMetadata("user+abc@example.com");
      const command = createCommand({ metadata: meta });

      await command.run({
        email: "subaddress",
        emailAddress: "user@example.com",
        subaddressType: "random",
      });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          subaddressEmail: "user@example.com",
          subaddressType: "random",
        }),
      );
    });
  });

  describe("website-name generation", () => {
    it("generates catchall from website name, stripping TLD", async () => {
      const meta = mockMetadata("should-not-be-used");
      const command = createCommand({ metadata: meta });

      const response = await command.run({
        email: "catchall",
        domain: "example.com",
        catchallType: "website-name",
        website: "mysite.com",
      });

      expect(response.success).toBe(true);
      expect((response.data as any).data).toBe("mysite@example.com");
    });

    it("generates subaddress from website name, stripping TLD", async () => {
      const meta = mockMetadata("should-not-be-used");
      const command = createCommand({ metadata: meta });

      const response = await command.run({
        email: "subaddress",
        emailAddress: "user@example.com",
        subaddressType: "website-name",
        website: "mysite.com",
      });

      expect(response.success).toBe(true);
      expect((response.data as any).data).toBe("user+mysite@example.com");
    });

    it("falls back to engine when website-name but no --website provided", async () => {
      const meta = mockMetadata("random123@example.com");
      const command = createCommand({ metadata: meta });

      const response = await command.run({
        email: "catchall",
        domain: "example.com",
        catchallType: "website-name",
      });

      expect(response.success).toBe(true);
      // Should have called the engine since website-name can't be fulfilled
      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalled();
    });

    it("strips TLD correctly for various domains", async () => {
      const meta = mockMetadata("unused");
      const command = createCommand({ metadata: meta });

      const cases = [
        { website: "github.com", expected: "github@example.com" },
        { website: "myapp.org", expected: "myapp@example.com" },
        { website: "store.co.uk", expected: "store.co@example.com" },
        { website: "localhost", expected: "localhost@example.com" },
      ];

      for (const { website, expected } of cases) {
        const response = await command.run({
          email: "catchall",
          domain: "example.com",
          catchallType: "website-name",
          website,
        });

        expect(response.success).toBe(true);
        expect((response.data as any).data).toBe(expected);
      }
    });
  });

  describe("hard engine limits", () => {
    it("fails when value exceeds constraint max", async () => {
      const meta = mockMetadata("unused");
      meta.profiles.account.constraints.default = { minNumber: { min: 0, max: 9 } };
      const command = createCommand({ metadata: meta });

      const response = await command.run({ minNumber: "20" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("maximum of 9");
      expect(response.message).toContain("requested 20");
    });

    it("fails when value is below constraint min", async () => {
      const meta = mockMetadata("unused");
      meta.profiles.account.constraints.default = { length: { min: 5, max: 128 } };
      const command = createCommand({ metadata: meta });

      const response = await command.run({ length: "2" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("minimum of 5");
      expect(response.message).toContain("requested 2");
    });
  });

  describe("policy enforcement", () => {
    it("rejects when org policy requires different settings", async () => {
      const meta = mockMetadata("unused");
      const policy = overridingPolicy({ length: 20 }, true);
      const command = createCommand({ metadata: meta, policy });

      const response = await command.run({ length: "25" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("Organization policy requires different settings");
      expect(response.message).toContain("length: 25 → 20");
    });

    it("reports all applied constraints, not just user-specified flags", async () => {
      const meta = mockMetadata("unused");
      const policy = overridingPolicy({ minSpecial: 5 }, true);
      const command = createCommand({
        metadata: meta,
        savedSettings: { minSpecial: 0 },
        policy,
      });

      const response = await command.run({ length: "18" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("minSpecial: 0 → 5");
    });

    it("succeeds when policy applies no changes", async () => {
      const meta = mockMetadata("generatedPassword123");
      const policy = overridingPolicy({ minSpecial: 5 }, true);
      const command = createCommand({
        metadata: meta,
        savedSettings: { minSpecial: 5 },
        policy,
      });

      const response = await command.run({ length: "18" });

      expect(response.success).toBe(true);
    });
  });

  describe("saved settings as defaults", () => {
    it("merges CLI flags over saved settings", async () => {
      const meta = mockMetadata("result");
      const command = createCommand({
        metadata: meta,
        savedSettings: { length: 14, uppercase: true, lowercase: true },
      });

      const response = await command.run({ length: "20" });

      expect(response.success).toBe(true);
      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ length: 20, uppercase: true, lowercase: true }),
      );
    });
  });

  describe("forwarder error handling", () => {
    it("returns clean error when --forwarded-service is missing", async () => {
      const command = createCommand({});

      const response = await command.run({ email: "forwarded" });

      expect(response.success).toBe(false);
      expect(response.message).toContain("--forwarded-service is required");
    });

    it("returns clean error for invalid vendor", async () => {
      const command = createCommand({});

      const response = await command.run({
        email: "forwarded",
        forwardedService: "bogus",
        apiKey: "test",
      });

      expect(response.success).toBe(false);
      expect(response.message).toContain("bogus");
    });
  });

  describe("forwarder flag mapping", () => {
    it("maps --api-key, --domain, --base-url, --prefix to forwarder settings", async () => {
      const meta = mockMetadata("alias@forwarder.com");
      const command = createCommand({ forwarderMetadata: meta });

      await command.run({
        email: "forwarded",
        forwardedService: "addyio",
        apiKey: "my-token",
        domain: "example.com",
        baseUrl: "https://app.addy.io",
        prefix: "myprefix",
      });

      const engine = meta.engine.create({} as any);
      expect(engine.generate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          token: "my-token",
          domain: "example.com",
          baseUrl: "https://app.addy.io",
          prefix: "myprefix",
        }),
      );
    });
  });
});
