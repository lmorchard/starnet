const FONTS_URL_BASE = "wgl6100/fonts";

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

  charToGlyph(char) {
    return this.glyphs[this.charToGlyphKey[char]];
  }

  stringToGlyphs(str) {
    const out = [];
    for (let idx = 0; idx < str.length; idx++) {
      const char = str[idx];
      const glyph = this.charToGlyph(char);
      if (glyph) {
        out.push(glyph);
      }
    }
    return out;
  }

  layoutText(text, maxWidth) {
    const paragraphs = this.splitTextIntoParagraphs(text);
    const glyphLines = this.paragraphsToGlyphLines(paragraphs, maxWidth);
    return this.layoutGlyphLines(glyphLines);
  }

  splitTextIntoParagraphs(text) {
    const lines = text
      .trim()
      .split(/\n/g)
      .map((line) => line.trim());      
    const paragraphs = [""];
    for (const line of lines) {
      if (line === "") {
        paragraphs.push(line);
      } else {
        paragraphs[paragraphs.length - 1] += line + " ";
      }
    }
    return paragraphs;
  }

  paragraphsToGlyphLines(paragraphs, maxWidth) {
    const spaceGlyph = this.charToGlyph(" ");
    const glyphLines = [[]];

    for (const paragraph of paragraphs) {
      const wordGlyphs = this.paragraphToWordGlyphs(paragraph);

      let currWidth = 0;
      for (const [glyphs, wordWidth] of wordGlyphs) {
        currWidth += wordWidth;
        if (currWidth >= maxWidth) {
          currWidth = 0;
          glyphLines.push([]);
        }
        currWidth += spaceGlyph.width;
        glyphLines[glyphLines.length - 1].push(...glyphs, spaceGlyph);
      }
      glyphLines.push([spaceGlyph]);
      glyphLines.push([]);
    }
    glyphLines.pop();
    glyphLines.pop();

    return glyphLines;
  }

  paragraphToWordGlyphs(paragraph) {
    const words = paragraph.trim().split(/\s+/g);
    const wordGlyphs = [];
    for (const word of words) {
      const glyphs = this.stringToGlyphs(word);
      let width = 0;
      for (const glyph of glyphs) {
        width += glyph.width;
      }
      wordGlyphs.push([glyphs, width]);
    }
    return wordGlyphs;
  }

  layoutGlyphLines(glyphLines) {
    const glyphShapes = [];
    let xCursor = 0;
    let yCursor = 0;

    const incX = (width) => (xCursor += width);
    const incY = (lineHeightFactor = 1.0) => {
      xCursor = 0;
      yCursor += this.lineHeight * lineHeightFactor;
    };

    for (const glyphs of glyphLines) {
      for (const glyph of glyphs) {
        const { left, right } = glyph;
        incX(0 - left);
        glyphShapes.push([]);
        for (const point of glyph.points) {
          if (!point) {
            glyphShapes.push([]);
          } else {
            const [x, y] = point;
            glyphShapes[glyphShapes.length - 1].push([
              x + xCursor,
              y + yCursor,
            ]);
          }
        }
        incX(right);
      }
      incY();
    }

    return glyphShapes.filter((shape) => shape.length > 0);
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

Font.fetch = async (name = "futural") => {
  const resp = await fetch(`${FONTS_URL_BASE}/${name}.jhf`);
  const data = await resp.text();
  return new Font(name, data);
};

// TODO: think about pre-processing these fonts into JSON?
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
      width: 0 - left + right,
      count,
      bounds,
      points,
      line,
    };
  }

  return { glyphs, lineHeight };
};

export default Font;
