import { createWorld } from "bitecs";
import * as MainLoop from "mainloop.js";

export function init() {
  const world = createWorld();

  Object.assign(world, {
    time: { delta: 0, deltaSec: 0, elapsed: 0 },

    update(delta, ...pipelines) {
      const time = this.time;
      time.delta = delta;
      time.deltaSec = delta / 1000;
      time.elapsed += delta;
      for (const pipeline of pipelines) {
        pipeline(world);
      }
    },

    run(pipeline, viewport, stats) {
      MainLoop.setUpdate((delta) => {
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
    }
  });

  return world;
}
