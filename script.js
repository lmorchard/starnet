/* global MainLoop */
const UPDATE_DELAY = 16;
const PI2 = Math.PI * 2;

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
    createSprite({ ...incCoords(), seed: 'baz' }),
    createSprite({ ...incCoords(), seed: 'quux' }),
    createSprite({ ...incCoords(), seed: 'hello' }),
    createSprite({ ...incCoords(), seed: 'sailor' }),
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

function createSprite(initial = {}) {
  const props = {
    seed: 'lmorchard',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    numPoints: undefined,
    type: 'sprite',
    points: [],
    ...initial,
  };
  
  const rng = new seedrandom(props.seed);
  
  const defaultNumPoints = 3 + Math.floor(rng() * 15);
  if (typeof props.numPoints === 'undefined') {
    props.numPoints = defaultNumPoints;
  }
  
  const { seed, width, height, numPoints, points } = props;  

  let xUnit = (width / 2) / numPoints;
  let yUnit = height / numPoints;

  for (let idx = 0; idx < numPoints; idx++) {
    points.push({
      x: rng() * 0.5 * width,
      y: (yUnit * idx) + rng() * yUnit,
      strokeStyle: `hsl(${360 * rng()}, 50%, 50%)`,
      xOffset: 0,
      yOffset: 0,
      xAngle: 0,
      xAngleFactor: (width / 4) * rng(),
      xAngleRate: (2.0 * rng()) / 1000,
      //xAngleFactor: 25 * rng(),
      //xAngleRate: (0.75 * rng()) / 1000,
      yAngle: 0,
      yAngleFactor: (height / 4) * rng(),
      yAngleRate: (0.75 * rng()) / 1000,
    });
  }
  
  return props;
}

function updateSprite(props, delta) {
  for (let idx = 0, len = props.points.length; idx < len; idx++) {
    props.points[idx].xAngle = (props.points[idx].xAngle + (props.points[idx].xAngleRate * Math.PI * delta)) % PI2;
    props.points[idx].yAngle = (props.points[idx].yAngle + (props.points[idx].yAngleRate * Math.PI * delta)) % PI2;
    props.points[idx].xOffset = props.points[idx].xAngleFactor * Math.sin(props.points[idx].xAngle);    
    props.points[idx].yOffset = props.points[idx].yAngleFactor * Math.sin(props.points[idx].yAngle);    
  }  
}

function drawSprite(props, ctx, interpolationPercentage) {
  const numPoints = props.points.length;
  
  ctx.save();
  ctx.translate(props.x, props.y);
  
  ctx.lineWidth = 1.5;
  for (let idx = 0; idx < numPoints; idx++) {
    const { x, y, xOffset, yOffset, strokeStyle } = props.points[idx];
    const { x: linkX, y: linkY, xOffset: linkXOffset, yOffset: linkYOffset } = props.points[numPoints - idx - 1];
  
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x + xOffset, y + yOffset);
    ctx.lineTo(props.width - (x + xOffset), y + yOffset);
    ctx.lineTo(linkX + linkXOffset, linkY + linkYOffset);    
    ctx.lineTo(props.width - (linkX + linkXOffset), linkY + linkYOffset);    
    ctx.lineTo(x + xOffset, y + yOffset);
  
    ctx.stroke();
  }  
  
  ctx.restore();
}

init();