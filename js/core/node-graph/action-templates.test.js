import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACTION_TEMPLATES } from "./action-templates.js";

// ── Action templates ─────────────────────────────────────────

describe("action templates", () => {
  it("all templates have id, label, requires, and effects", () => {
    for (const [name, template] of Object.entries(ACTION_TEMPLATES)) {
      assert.ok(template.id, `${name} missing id`);
      assert.ok(template.label, `${name} missing label`);
      assert.ok(Array.isArray(template.requires), `${name} requires not an array`);
      assert.ok(Array.isArray(template.effects), `${name} effects not an array`);
    }
  });

  it("all templates have desc field", () => {
    for (const [name, template] of Object.entries(ACTION_TEMPLATES)) {
      assert.ok(template.desc, `${name} missing desc`);
    }
  });
});
