import { defineSystem, addEntity, addComponent, pipe, removeComponent } from "../../vendor/pkg/bitecs.uBk-LJ8s6O3X.js";
import * as Stats from "../../lib/stats.OV0McSz3wFid.js";
import * as World from "../../lib/world.TEy0JkQcCExn.js";
import * as Viewport from "../../lib/viewport/pixi.GMeh2Dm0nMH5.js";
import {
  CameraFocus,
  RenderableShape,
  RenderableShapes,
  Renderable,
  renderQuery,
  cameraFocusQuery,
} from "../../lib/viewport/index.V6yaLwAeWhUZ.js";
import { movementSystem, Position, Velocity } from "../../lib/positionMotion.Rf-6EmSjJMue.js";
import { setupTwiddles } from "../twiddles.Vi43hBdm0vpV.js";

async function main() {
  const stats = Stats.init();
  const viewport = Viewport.init();
  const world = World.init();

  const xStep = 125;
  const yStep = 125;
  const xStart = -250;
  const xMax = 250;
  let x = xStart;
  let y = 0;

  let lastEid;

  for (const renderableName of RenderableShapes) {
    const eid = addEntity(world);
    lastEid = eid;
    
    addComponent(world, Renderable, eid);
    addComponent(world, Position, eid);
    addComponent(world, Velocity, eid);

    Position.x[eid] = x;
    Position.y[eid] = y;
    
    Renderable.shape[eid] = RenderableShape[renderableName];

    x += xStep;
    if (x > xMax) {
      x = xStart;
      y += yStep;
    }
  }

  //addComponent(world, CameraFocus, lastEid);

  const pane = setupTwiddles(world, viewport);

  const focusSelectionSystem = defineSystem((world) => {
    const clickedEid = renderQuery(world).find(
      (eid) => Renderable.mouseClicked[eid]
    );
    if (clickedEid) {
      const cameraFocusEid = cameraFocusQuery(world)[0];
      if (cameraFocusEid) {
        removeComponent(world, CameraFocus, cameraFocusEid);
      }
      addComponent(world, CameraFocus, clickedEid);
    }
  });

  const pipeline = pipe(
    movementSystem,
    focusSelectionSystem,
    () => pane.refresh()
  );
  world.run(pipeline, viewport, stats);

  console.log("READY.");
}

main().catch(console.error);
