export class Font {
  constructor(name, data) {
    Object.assign(this, Font.parse(data));

    this.name = name;
    this.charToGlyphKey = {};

    const chars = Font.fontChars[name];
    this.chars = chars;
    if (chars) {
      const keys = Object.keys(this.glyphs).sort((a, b) => a - b);
      for (let idx = 0; idx < chars.length; idx++) {
        this.charToGlyphKey[chars[idx]] = keys[idx];
      }
    }
  }

  stringToGlyphs(str) {
    const out = [];
    for (let idx = 0; idx < str.length; idx++) {
      const glyph = this.glyphs[this.charToGlyphKey[str[idx]]];
      if (glyph) {
        out.push(glyph);
      }
    }
    return out;
  }

  /*
  drawText(ctx, x, y, str, options = {}) {
    const { maxWidth = null, scale = 1.0 } = options;

    ctx.save();
    ctx.translate(x, y);

    const pos = { x: 0, y: 0 };
    const glyphs = this.stringToGlyphs(str);
    for (const glyph of glyphs) {
      const { left, right } = glyph;

      incPos(pos, Math.abs(left), maxWidth, this.lineHeight);
      Font.drawGlyph(ctx, pos.x, pos.y, scale, glyph);
      incPos(pos, Math.abs(right), maxWidth, this.lineHeight);
    }

    ctx.restore();

    return pos;
  }
  */
}

const incPos = (pos, width, maxWidth, lineHeight) => {
  pos.x += width;
  if (maxWidth !== null && pos.x > maxWidth) {
    pos.x = 0;
    pos.y += lineHeight;
  }
};

Font.fontChars = {
  futural:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789!?\"$/()|-+=*'#&\\^.,:;`[]{}<>~%@°",
  futuram:
    " |-#\\()[]{}<>~^`%&@ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?$/*+='\"°",
  rowmant:
    "\\_[]{}|<>~^%@#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.,:;!?`'&$/()*-+=\"°",
  scripts:
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .°|-+=#\\_[]{}<>~^%@0123456789,:;!?`'&$/()*\"",
  scriptc:
    "\\_[]{}|<>~^%@#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.,:;!?`'&$/()*-+=\"°"
};

Font.fetch = async (name = "futural") => {
  const resp = await fetch(`fonts/${name}.jhf`);
  const data = await resp.text();
  return new Font(name, data);
};

/*
Font.drawGlyph = (ctx, x, y, scale, { left, right, count, bounds, points }) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  let penDown = false;
  for (const point of points) {
    if (point === false) {
      penDown = false;
      continue;
    }
    ctx[penDown ? "lineTo" : "moveTo"](point[0] * scale, point[1] * scale);
    penDown = true;
  }
  ctx.stroke();
  ctx.restore();
};
*/

// TODO: think about pre-processing these fonts into JSON?
Font.parse = data => {
  const center = "R".charCodeAt(0);
  const charToCoord = char => char.charCodeAt(0) - center;
  
  const lines = data.split(/\n/);
  const glyphs = {};
  let lineHeight = 0;

  for (const line of lines) {
    if (!line) {
      continue;
    }

    const key = parseInt(line.slice(0, 5).trim());
    const count = parseInt(line.slice(5, 8));
    const left = charToCoord(line.slice(8, 9));
    const right = charToCoord(line.slice(9, 10));
    const bounds = { top: 0, bottom: 0, left: 0, right: 0 };

    const points = [];
    for (let idx = 10; idx < line.length; idx += 2) {
      if (" R" === line.slice(idx, idx + 2)) {
        points.push(false);
        continue;
      }

      const x = charToCoord(line.slice(idx, idx + 1));
      const y = charToCoord(line.slice(idx + 1, idx + 2));
      points.push([x, y]);

      bounds.left = Math.min(bounds.left, x);
      bounds.right = Math.max(bounds.right, x);
      bounds.top = Math.min(bounds.top, y);
      bounds.bottom = Math.max(bounds.bottom, y);
      lineHeight = Math.max(
        lineHeight,
        Math.abs(bounds.top) + Math.abs(bounds.bottom)
      );
    }

    glyphs[key] = {
      left,
      right,
      count,
      bounds,
      points,
      line
    };
  }

  return { glyphs, lineHeight };
};

export default Font;
