import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GRADES, GRADE_INDEX, parseGrade, gradeRange, clampGrade, shiftGrade, randomGrade,
} from "./grades.js";

describe("GRADES", () => {
  it("has 6 entries in ascending order", () => {
    assert.deepEqual(GRADES, ["F", "D", "C", "B", "A", "S"]);
  });

  it("GRADE_INDEX maps each letter to its position", () => {
    assert.equal(GRADE_INDEX["F"], 0);
    assert.equal(GRADE_INDEX["D"], 1);
    assert.equal(GRADE_INDEX["S"], 5);
  });
});

describe("parseGrade", () => {
  it("accepts valid uppercase letters", () => {
    assert.equal(parseGrade("F"), "F");
    assert.equal(parseGrade("S"), "S");
    assert.equal(parseGrade("B"), "B");
  });

  it("normalises lowercase", () => {
    assert.equal(parseGrade("c"), "C");
    assert.equal(parseGrade("a"), "A");
  });

  it("returns null for invalid input", () => {
    assert.equal(parseGrade("E"), null);
    assert.equal(parseGrade("Z"), null);
    assert.equal(parseGrade(""), null);
    assert.equal(parseGrade(null), null);
    assert.equal(parseGrade(undefined), null);
  });
});

describe("gradeRange", () => {
  it("returns a single-element array when min === max", () => {
    assert.deepEqual(gradeRange("C", "C"), ["C"]);
  });

  it("returns full range F–S", () => {
    assert.deepEqual(gradeRange("F", "S"), ["F", "D", "C", "B", "A", "S"]);
  });

  it("returns a mid-range slice", () => {
    assert.deepEqual(gradeRange("C", "A"), ["C", "B", "A"]);
  });

  it("handles reversed min/max by normalising", () => {
    // Higher index as minGrade should still return the range
    const r = gradeRange("A", "C");
    assert.deepEqual(r, ["C", "B", "A"]);
  });
});

describe("clampGrade", () => {
  it("clamps negative index to F", () => {
    assert.equal(clampGrade(-5), "F");
  });

  it("clamps high index to S", () => {
    assert.equal(clampGrade(99), "S");
  });

  it("rounds fractional index", () => {
    assert.equal(clampGrade(1.7), "C"); // rounds to 2 = "C"
  });
});

describe("shiftGrade", () => {
  it("shifts up by delta", () => {
    assert.equal(shiftGrade("F", 1), "D");
    assert.equal(shiftGrade("C", 2), "A");
  });

  it("shifts down by delta", () => {
    assert.equal(shiftGrade("S", -1), "A");
    assert.equal(shiftGrade("B", -2), "D");
  });

  it("clamps at F when shifting below minimum", () => {
    assert.equal(shiftGrade("F", -5), "F");
  });

  it("clamps at S when shifting above maximum", () => {
    assert.equal(shiftGrade("S", 5), "S");
  });
});

describe("randomGrade", () => {
  it("returns a grade within the specified range", () => {
    // Use a deterministic rng that cycles through [0, 0.5, 0.99]
    const values = [0, 0.5, 0.99];
    let i = 0;
    const rng = () => values[i++ % values.length];
    for (let n = 0; n < 9; n++) {
      const g = randomGrade(rng, "C", "A");
      assert.ok(["C", "B", "A"].includes(g), `expected C/B/A, got ${g}`);
    }
  });

  it("always returns the same grade when min === max", () => {
    const rng = () => Math.random();
    for (let n = 0; n < 10; n++) {
      assert.equal(randomGrade(rng, "B", "B"), "B");
    }
  });
});
