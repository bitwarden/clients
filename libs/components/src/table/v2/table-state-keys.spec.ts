import { TABLE_STATE_KEYS } from "./table-state-keys";

// Mirrors `state-definitions.spec.ts`. Object literals already reject duplicate names; this
// holds the stored values to the same rule.
describe("table state keys", () => {
  const tracked: [name: string, key: string][] = [];

  test.each(Object.entries(TABLE_STATE_KEYS))("that %s follows all rules", (name, key) => {
    const conflict = tracked.find(([, trackedKey]) => trackedKey === key);
    if (conflict) {
      throw new Error(
        `'${name}' has the same stored key as '${conflict[0]}'. Two tables sharing a key ` +
          `share one stored set of hidden columns — choose a unique key.`,
      );
    }

    expect(key.length).toBeGreaterThan(3); // Too short to be descriptive
    expect(key).not.toContain(" "); // Keys are storage identifiers, not labels
    // All-lowercase, so two keys can never differ from one another by casing alone.
    expect(key).toEqual(key.toLowerCase());

    tracked.push([name, key]);
  });
});
