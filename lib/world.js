import { createWorld } from "../vendor/pkg/bitecs.js";
import * as MainLoop from "../vendor/pkg/mainloopjs.js";

export function init() {
  const world = createWorld();

  Object.assign(world, {
    fps: 0,
    time: { delta: 0, deltaSec: 0, elapsed: 0 },

    update(delta, pipeline) {
      const time = this.time;
      time.delta = delta;
      time.deltaSec = delta / 1000;
      time.elapsed += delta;
      pipeline(world);
    },

    run(pipeline, viewport, stats) {
      this.loop = MainLoop.setUpdate((delta) => {
        stats && stats.update.begin();
        world.update(delta, pipeline);
        stats && stats.update.end();
      })
        .setDraw((interpolationPercentage) => {
          stats && stats.draw.begin();
          viewport.draw(world, interpolationPercentage);
          stats && stats.draw.end();
        })
        .setEnd((fps, panic) => {
          // TODO: handle pausing here?
          world.fps = fps;
          if (panic) {
            const discardedTime = Math.round(MainLoop.resetFrameDelta());
            console.log(`Rendering discarded ${discardedTime}ms`);
          }
        })
        .start();
    },
  });

  return world;
}
