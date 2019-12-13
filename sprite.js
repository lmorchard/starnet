const seedrandom = Math.seedrandom;
const PI2 = Math.PI * 2;

export function createSprite(initial = {}) {
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
      xAngleRate: (0.75 * rng()) / 1000,
      yAngle: 0,
      yAngleFactor: (height / 4) * rng(),
      yAngleRate: (0.75 * rng()) / 1000,
    });
  }
  
  return props;
}

export function updateSprite(props, delta) {
  for (let idx = 0, len = props.points.length; idx < len; idx++) {
    props.points[idx].xAngle = (props.points[idx].xAngle + (props.points[idx].xAngleRate * Math.PI * delta)) % PI2;
    props.points[idx].yAngle = (props.points[idx].yAngle + (props.points[idx].yAngleRate * Math.PI * delta)) % PI2;
    props.points[idx].xOffset = props.points[idx].xAngleFactor * Math.sin(props.points[idx].xAngle);    
    props.points[idx].yOffset = props.points[idx].yAngleFactor * Math.sin(props.points[idx].yAngle);    
  }  
}

export function drawSprite(props, ctx, interpolationPercentage) {
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
