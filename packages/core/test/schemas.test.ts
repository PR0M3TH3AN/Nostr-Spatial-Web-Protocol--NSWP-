/**
 * The JSON Schemas are structural: they must accept every vector the full
 * validator accepts, and reject the structural failures they can express.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { decodeArrival } from "../src/index.js";

const root = join(import.meta.dirname, "../../..");
const load = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const s of ["entry-assertion", "world-event", "manifest", "portal", "arrival", "look", "list"]) {
  ajv.addSchema(load(`schemas/${s}.schema.json`), `${s}.schema.json`);
}
const validate = (schema: string, data: unknown) => ajv.validate(`${schema}.schema.json`, data);

describe("JSON Schemas agree with the vectors", () => {
  it("world events", () => {
    for (const v of load("vectors/world-events.json").vectors) {
      if (v.expect.valid) expect(validate("world-event", v.event), v.name).toBe(true);
    }
    const byName = Object.fromEntries(load("vectors/world-events.json").vectors.map((v: { name: string }) => [v.name, v]));
    for (const n of ["missing_required", "entry_not_https", "wrong_kind"]) expect(validate("world-event", byName[n].event), n).toBe(false);
  });

  it("manifests", () => {
    for (const v of load("vectors/manifests.json").manifests) {
      if (v.expect.valid) expect(validate("manifest", v.manifest), v.name).toBe(true);
    }
    const byName = Object.fromEntries(load("vectors/manifests.json").manifests.map((v: { name: string }) => [v.name, v]));
    for (const n of ["bad_publisher_key", "wrong_schema", "insecure_entry"]) expect(validate("manifest", byName[n].manifest), n).toBe(false);
  });

  it("portals", () => {
    for (const v of load("vectors/portals.json").portals) expect(validate("portal", v.portal), v.name).toBe(v.expect.valid);
  });

  it("arrivals and assertions", () => {
    for (const v of load("vectors/arrivals.json").vectors) {
      const r = decodeArrival(v.value);
      if (r.ok && v.expect.warnings.length === 0) expect(validate("arrival", r.value), v.name).toBe(true);
    }
    for (const v of load("vectors/assertions.json").vectors) {
      if (v.expect.valid) expect(validate("entry-assertion", v.event), v.name).toBe(true);
    }
  });

  it("lists", () => {
    const { vectors } = load("vectors/lists.json");
    for (const v of vectors) if (v.expect.valid) expect(validate("list", v.event), v.name).toBe(true);
    for (const n of ["missing_d", "wrong_kind"]) expect(validate("list", vectors.find((v: { name: string }) => v.name === n).event), n).toBe(false);
  });

  it("looks, inline", () => {
    const { inline } = load("vectors/looks.json");
    for (const v of inline) {
      let json: unknown;
      try {
        json = JSON.parse(v.text);
      } catch {
        continue;
      }
      // Structural only: the schema can't see the length limit, and unknown values are not errors.
      if (v.expect.valid) expect(validate("look", json), v.name).toBe(true);
    }
    for (const n of ["no_seed", "seed_too_short", "not_an_object"]) expect(validate("look", JSON.parse(inline.find((v: { name: string }) => v.name === n).text)), n).toBe(false);
  });
});
