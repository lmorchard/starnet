const UPDATE_DELAY = 16;
const PI2 = Math.PI * 2;

const numPoints = 3 + Math.floor(12 * Math.random());

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let points = [];

let updateTimer = null;
let drawFrame = null;
let lastUpdateTime = Date.now();

function init() {
  let xUnit = (canvas.width / 2) / numPoints;
  let yUnit = canvas.height / numPoints;

  points = [];
  for (let idx = 0; idx < numPoints; idx++) {
    const x = Math.random() * 0.5 * canvas.width;
    const y = (yUnit * idx) + (Math.random()) * yUnit;
    points.push({
      x,
      y,
      //strokeStyle: `hsl(${360 * Math.random()}, 50%, 50%)`,
      strokeStyle: `rgba(${255 * Math.random()}, ${255 * Math.random()}, ${255 * Math.random()}, ${Math.random()})`,
      xOffset: 0,
      yOffset: 0,
      xAngle: 0,
      xAngleFactor: 25 * Math.random(),
      xAngleRate: 0.5 * Math.random(),
      yAngle: 0,
      yAngleFactor: 25 * Math.random(),
      yAngleRate: 0.5 * Math.random(),
    });
  }
  
  updateTimer = setTimeout(update, UPDATE_DELAY);
  drawFrame = window.requestAnimationFrame(draw);
}

function draw(ts) {
  canvas.width = canvas.width;
  
  ctx.lineWidth = 1.5;
  
  for (let idx = 0; idx < numPoints; idx++) {
    const { x, y, xOffset, yOffset, strokeStyle } = points[idx];
    const { x: linkX, y: linkY, xOffset: linkXOffset, yOffset: linkYOffset } = points[numPoints - idx - 1];
  
    ctx.strokeStyle = strokeStyle;
    ctx.beginPath();
    ctx.moveTo(x + xOffset, y + yOffset);
    ctx.lineTo(canvas.width - (x + xOffset), y + yOffset);
    ctx.lineTo(linkX + linkXOffset, linkY + linkYOffset);    
    ctx.lineTo(canvas.width - (linkX + linkXOffset), linkY + linkYOffset);    
    ctx.lineTo(x + xOffset, y + yOffset);
  
    ctx.stroke();
  }

  drawFrame = window.requestAnimationFrame(draw);
}

function update() {
  const now = Date.now();
  const timeDelta = (now - lastUpdateTime) / 1000.0;
  lastUpdateTime = now;
  
  for (let idx = 0; idx < numPoints; idx++) {
    points[idx].xAngle = 
      (points[idx].xAngle + (points[idx].xAngleRate * Math.PI * timeDelta)) % PI2;
    points[idx].yAngle = 
      (points[idx].yAngle + (points[idx].yAngleRate * Math.PI * timeDelta)) % PI2;
    points[idx].xOffset = points[idx].xAngleFactor * Math.sin(points[idx].xAngle);    
    points[idx].yOffset = points[idx].yAngleFactor * Math.sin(points[idx].yAngle);    
  }
  
  updateTimer = setTimeout(update, UPDATE_DELAY);  
}

function shuffle (array) {
  var i = 0
    , j = 0
    , temp = null

  for (i = array.length - 1; i > 0; i -= 1) {
    j = Math.floor(Math.random() * (i + 1))
    temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
}

init();