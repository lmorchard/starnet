import Stats from "../vendor/pkg/statsjs.js";

export function init() {
  const draw = new Stats();
  draw.setMode(0);
  draw.domElement.style.position = "absolute";
  draw.domElement.style.left = "0px";
  draw.domElement.style.top = "0px";
  document.body.appendChild(draw.domElement);

  const update = new Stats();
  update.setMode(0);
  update.domElement.style.position = "absolute";
  update.domElement.style.left = "0px";
  update.domElement.style.top = "55px";
  document.body.appendChild(update.domElement);

  return { draw, update };
}
