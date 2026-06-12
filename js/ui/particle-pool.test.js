// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ParticlePool } from "./particle-pool.js";

describe("ParticlePool", () => {
  test("starts empty", () => {
    assert.equal(new ParticlePool().size, 0);
  });

  test("add increases size and returns the particle", () => {
    const pool = new ParticlePool();
    const p = { until: 100 };
    assert.equal(pool.add(p), p);
    assert.equal(pool.size, 1);
  });

  test("tick updates live particles and keeps them", () => {
    const pool = new ParticlePool();
    let updates = 0;
    pool.add({ until: 100, update: () => updates++ });
    pool.tick(50);
    assert.equal(updates, 1);
    assert.equal(pool.size, 1);
  });

  test("tick passes `now` to update", () => {
    const pool = new ParticlePool();
    let seen = -1;
    pool.add({ until: 100, update: (now) => { seen = now; } });
    pool.tick(42);
    assert.equal(seen, 42);
  });

  test("tick restores and culls particles at/after their `until`", () => {
    const pool = new ParticlePool();
    let restored = 0, updatesAfterExpiry = 0;
    pool.add({ until: 100, update: () => updatesAfterExpiry++, restore: () => restored++ });
    pool.tick(100); // now === until → expired
    assert.equal(restored, 1, "restore runs on expiry");
    assert.equal(updatesAfterExpiry, 0, "expired particle is not updated");
    assert.equal(pool.size, 0, "expired particle is culled");
  });

  test("a mix: live survive, expired are reaped", () => {
    const pool = new ParticlePool();
    const restored = [];
    pool.add({ until: 100, restore: () => restored.push("a") });
    pool.add({ until: 300, restore: () => restored.push("b") });
    pool.tick(200);
    assert.deepEqual(restored, ["a"]);
    assert.equal(pool.size, 1);
  });

  test("clear restores all and empties the pool", () => {
    const pool = new ParticlePool();
    let restored = 0;
    pool.add({ until: 999, restore: () => restored++ });
    pool.add({ until: 999, restore: () => restored++ });
    pool.clear();
    assert.equal(restored, 2);
    assert.equal(pool.size, 0);
  });

  test("particles without update/restore are handled without throwing", () => {
    const pool = new ParticlePool();
    pool.add({ until: 100 });        // no update
    pool.tick(50);                   // alive, nothing to update
    assert.equal(pool.size, 1);
    pool.tick(100);                  // expired, nothing to restore
    assert.equal(pool.size, 0);
    assert.doesNotThrow(() => new ParticlePool().clear());
  });

  test("tick on an empty pool is a no-op", () => {
    assert.doesNotThrow(() => new ParticlePool().tick(123));
  });

  test("reset empties the pool WITHOUT calling restore", () => {
    const pool = new ParticlePool();
    let restored = 0;
    pool.add({ until: 999, restore: () => restored++ });
    pool.add({ until: 999, restore: () => restored++ });
    pool.reset();
    assert.equal(restored, 0, "reset must not restore (target may be gone)");
    assert.equal(pool.size, 0);
  });
});
