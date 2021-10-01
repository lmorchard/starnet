import { Pane } from "tweakpane";

export function setupTwiddles(world, viewport) {
  const pane = new Pane();
  const f1 = pane.addFolder({ title: "Twiddles", expanded: false });
  f1.addMonitor(world, "fps" /*, { view: "graph", min: 0, max: 75 }*/);

  f1.addInput(viewport, "zoom", { min: 0.1, max: 3.0 });
  f1.addInput(viewport, "camera", {
    x: { min: -1000, max: 1000 },
    y: { min: -1000, max: 1000 },
  });

  const grid1 = f1.addFolder({ title: "Grid", expanded: false });
  grid1.addInput(viewport, "gridEnabled");
  grid1.addInput(viewport, "gridSize", { min: 10, max: 1000 });
  grid1.addInput(viewport, "gridLineColor", { view: "color" });
  grid1.addInput(viewport, "gridLineAlpha", { min: 0.0, max: 1.0 });
  grid1.addInput(viewport, "gridLineWidth", { min: 0.5, max: 5.0 });

  f1.addSeparator();
  f1.addButton({ title: "Stop" }).on("click", () => world.loop.stop());
  f1.addButton({ title: "Start" }).on("click", () => world.loop.start());

  return pane;
}

export function setupBloomTwiddles(pane, viewport) {
  const bloomTwiddles = pane.addFolder({ title: "Bloom" });
  bloomTwiddles.addInput(viewport.bloom, "threshold", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "bloomScale", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "brightness", {
    min: 0.1,
    max: 2.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "blur", {
    min: 0.5,
    max: 8.0,
    step: 0.1,
  });
  bloomTwiddles.addInput(viewport.bloom, "quality", {
    min: 1,
    max: 16,
    step: 1,
  });
}
