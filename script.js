/* global MainLoop */
const UPDATE_DELAY = 16;
const PI2 = Math.PI * 2;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const seedrandom = Math.seedrandom;

const entities = [];

function init() {
  [
    createSprite({ x: 20, y: 20, seed: 'lmorchard' }),
    createSprite({ x: 140, y: 20, seed: 'daemon' }),
    createSprite({ x: 260, y: 20, seed: 'what' }),
    createSprite({ x: 20, y: 140, seed: 'sprite' }),
    createSprite({ x: 140, y: 140, seed: 'elf' }),
    createSprite({ x: 260, y: 140, seed: 'yeah' }),
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
    numPoints: 10,
    type: 'sprite',
    points: [],
    ...initial,
  };
  const { seed, width, height, numPoints, points } = props;  
  const rng = new seedrandom(seed);

  let xUnit = (width / 2) / numPoints;
  let yUnit = height / numPoints;

  for (let idx = 0; idx < numPoints; idx++) {
    const x = rng() * 0.5 * width;
    const y = (yUnit * idx) + rng() * yUnit;
    points.push({
      x,
      y,
      strokeStyle: `hsl(${360 * rng()}, 50%, 50%)`,
      xOffset: 0,
      yOffset: 0,
      xAngle: 0,
      xAngleFactor: 25 * rng(),
      xAngleRate: (0.5 * rng()) / 1000,
      yAngle: 0,
      yAngleFactor: 25 * rng(),
      yAngleRate: (0.5 * rng()) / 1000,
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