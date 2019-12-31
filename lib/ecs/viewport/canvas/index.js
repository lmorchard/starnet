export function initCanvas(containerSelector) {
  const container = document.querySelector(containerSelector);
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  return { container, canvas, ctx };
}
