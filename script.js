/* global MainLoop, CryptoJS, alea */
import { createSprite, updateSprite, drawSprite } from './lib/sprite.js';
import xxhash from 'https://unpkg.com/xxhash-wasm/esm/xxhash-wasm.js';

const seedrandom = Math.seedrandom;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const entities = [];

async function init() {
  // initGame();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  
  [8675309, 5551212, 1234, 'ilikepie'].forEach(seed => {
    const t0 = performance.now();
    const [fromIndex, fromRandom] = genRandom(seed, 1000);
    const t1 = performance.now();
    console.log('perf', t0, t1, t1 - t0);
    console.log('fromIndex', fromIndex);
    console.log('fromRandom', fromRandom);
    for (const rand of Object.values(fromIndex)) {
      const val = parseInt(rand, 16);
      const x = (val & 0xff00) >> 8;
      const y = val & 0x00ff;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  
}

function genRandom(seed, maxIdx = 1000) {
  const rng = new seedrandom(seed);
  //const rng = new alea(seed);
  
  const indexToRandom = {};
  const randomToIndex = {};
  for (let idx = 0; idx < maxIdx; idx++) {
    let val;
    do {
      val = Math.floor(rng() * 0xffff).toString(16).padStart(4, '0');
    } while (val in randomToIndex);
    indexToRandom[idx] = val;
    randomToIndex[val] = idx;
  }
  return [indexToRandom, randomToIndex];
}

function initGame() {
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

init().then().catch(console.error);