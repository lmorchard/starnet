import { initCanvas } from "../lib/ecs/viewport/canvas/index.js";
import Font from "../lib/fonts.js";

const { container, canvas, ctx } = initCanvas("#game");

const fontNames = [
  "futural",
  "futuram",
  "rowmant",
  "scripts",
  "scriptc",
  //"rowmand",
  //"rowmans",
  //"symbolic",
  //"mathlow",
  //"mathupp",
  //"astrology",
  //"cursive",
  //"gothgbt",
  //"gothgrt",
  //"gothiceng",
  //"markers"
  //"timesg",
  //"timesi",
  //"timesib",
  //"timesr",
  //"timesrb"
];

const fonts = {};

async function init() {
  for (let idx = 0; idx < fontNames.length; idx++) {
    const name = fontNames[idx];
    const font = await Font.fetch(name);
    if (font) {
      fonts[name] = font;
    }
  }

  MainLoop.setUpdate(update)
    .setDraw(draw)
    .start();
}

function update(delta) {}

function draw(ip) {
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 1.5;
  ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
  ctx.strokeStyle = "rgba(255, 255, 255, 1.0)";

  const pos = { x: 0, y: 0 };

  for (const name of fontNames) {
    pos.y += 18;

    ctx.font = "16px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${name}`, pos.x, pos.y);

    pos.x = 0;
    pos.y += 25;

    const font = fonts[name];

    if (font.chars) {
      const endPos = font.drawText(
        ctx,
        0,
        pos.y,
        `DANGER WARNING TRACE ACTIVE Scan Probe ${font.chars}`,
        { maxWidth: canvas.width - 25 }
      );
      pos.x = 0;
      pos.y += endPos.y + 30;
    }
  }

  ctx.restore();
}

function end(fps, panic) {}

init().catch(console.error);
