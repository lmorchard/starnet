const UPDATE_DELAY = 16;
const PI2 = Math.PI * 2;

const numPoints = 6;

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
      xOffset: 0,
      yOffset: 0,
      xAngle: 0,
    });
  }
  
  updateTimer = setTimeout(update, UPDATE_DELAY);
  drawFrame = window.requestAnimationFrame(draw);
}

function draw(ts) {
  canvas.width = canvas.width;
  
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = '#fff';
  
  for (let idx = 0; idx < numPoints; idx++) {
    const { x, y, xOffset, yOffset, link } = points[idx];
    const { x: linkX, y: linkY, xOffset: linkXOffset, yOffset: linkYOffset } = points[numPoints - idx - 1];
    
    ctx.moveTo(x + xOffset, y + yOffset);
    ctx.lineTo(canvas.width - (x + xOffset), y + yOffset);
    ctx.lineTo(linkX + linkXOffset, linkY + linkYOffset);    
    ctx.lineTo(canvas.width - (linkX + linkXOffset), linkY + linkYOffset);    
    ctx.lineTo(x + xOffset, y + yOffset);
  }
  
  ctx.stroke();

  drawFrame = window.requestAnimationFrame(draw);
}

function update() {
  const now = Date.now();
  const timeDelta = now - lastUpdateTime;
  lastUpdateTime = now;
  
  for (let idx = 0; idx < numPoints; idx++) {
    points[idx].xAngle = (points[idx].xAngle + Math.PI * timeDelta) % PI2;
    points[idx].xOffset = 10Math.sin(points[idx].xangle); // 4.0 * (0.5 - Math.random());    
    points[idx].yOffset = 0; // 4.0 * (0.5 - Math.random());    
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