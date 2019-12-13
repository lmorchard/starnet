/* global MainLoop */
import { createSprite, updateSprite, drawSprite } from './sprite.js';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const seedrandom = Math.seedrandom;

const entities = [];

function init() {
  let margin = 40;
  let width = 100;
  let height = 100;
  let maxx = 500;
  let x = undefined;
  let y = undefined;
  
  const incCoords = () => {
    if (x === undefined) {
      x = y = 0;
    } else {
      x += margin + width;
      if (x >= maxx) {
        x = 0;
        y += margin + height;
      }
    }
    return { x: x + margin, y: y + margin, width, height };
  };
  
  [
    createSprite({ ...incCoords(), seed: 'lmorchard', numPoints: 2 }),
    createSprite({ ...incCoords(), seed: 'lmorchard', numPoints: 4 }),
    createSprite({ ...incCoords(), seed: 'lmorchard', numPoints: 8 }),
    createSprite({ ...incCoords(), seed: 'lmorchard', numPoints: 16 }),
    createSprite({ ...incCoords(), seed: 'lmorchard' }),
    createSprite({ ...incCoords(), seed: 'daemon' }),
    createSprite({ ...incCoords(), seed: 'what' }),
    createSprite({ ...incCoords(), seed: 'sprite' }),
    createSprite({ ...incCoords(), seed: 'elf' }),
    createSprite({ ...incCoords(), seed: 'yeah' }),
    createSprite({ ...incCoords(), seed: 'alpha' }),
    createSprite({ ...incCoords(), seed: 'beta' }),
    createSprite({ ...incCoords(), seed: 'gamma' }),
    createSprite({ ...incCoords(), seed: 'delta' }),
    createSprite({ ...incCoords(), seed: 'foo' }),
    createSprite({ ...incCoords(), seed: 'bar' }),
  ].forEach(entity => entities.push(entity));
  
  MainLoop.setUpdate(update).setDraw(draw).setEnd(end).start();
}

function update(delta) {
  for (let idx = 0, len = entities.length; idx < len; idx++) {
    updateSprite(entities[idx], delta)
  }
}

function draw(interpolationPercentage) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let idx = 0, len = entities.length; idx < len; idx++) {
    drawSprite(entities[idx], ctx, interpolationPercentage)
  }
}

function end(fps, panic) {
  if (panic) {
    var discardedTime = Math.round(MainLoop.resetFrameDelta());
  }
}

init();