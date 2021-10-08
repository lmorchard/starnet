#!/usr/bin/env node
const path = require("path");
const fs = require("fs/promises");
const mkdirp = require("mkdirp");

const FONTS_ROOT = path.resolve(__dirname, "..", "fonts");
const FONTS_JSON_ROOT = path.resolve(__dirname, "..", "src/fonts");

async function main() {
  await mkdirp(FONTS_JSON_ROOT);
  for (const fontName in Font.fontChars) {
    const fontPath = path.resolve(FONTS_ROOT, `${fontName}.jhf`);
    const buf = await fs.readFile(fontPath);
    const data = buf.toString("ascii");
    const font = new Font(fontName, data);

    await fs.writeFile(
      path.resolve(FONTS_JSON_ROOT, `${fontName}.json`),
      JSON.stringify(font, null, "  ")
    );
  }
}

class Font {
  constructor(name, data) {
    this.name = name;
    this.glyphs = {};
    const parsed = Font.parse(data);
    const glyphs = parsed.glyphs;
    const chars = Font.fontChars[name];
    if (chars) {
      const keys = Object.keys(glyphs).sort((a, b) => a - b);
      for (let idx = 0; idx < chars.length; idx++) {
        this.glyphs[chars[idx]] = glyphs[keys[idx]];
      }
    }
  }
}

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
    "\\_[]{}|<>~^%@#ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.,:;!?`'&$/()*-+=\"°",
};

Font.parse = (data) => {
  const center = "R".charCodeAt(0);
  const charToCoord = (char) => char.charCodeAt(0) - center;

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

    const lines = [[]];
    for (let idx = 10; idx < line.length; idx += 2) {
      const points = lines[lines.length - 1];
      if (" R" === line.slice(idx, idx + 2)) {
        lines.push([]);
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
      width: 0 - left + right,
      count,
      bounds,
      lines,
      line,
    };
  }

  return { glyphs, lineHeight };
};

main().catch(console.error);
