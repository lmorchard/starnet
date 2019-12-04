const UPDATE_DELAY = 16;
const PI2 = Math.PI * 2;

const numPoints = 12;

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
    const y = (yUnit * idx)
      + (0.5 - Math.random()) * yUnit;
    points.push({ x, y, link: Math.floor(Math.random() * numPoints) });
  }
  
  updateTimer = setTimeout(update, UPDATE_DELAY);
  drawFrame = window.requestAnimationFrame(draw);
}

function draw(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = '#fff';
  
  for (let idx = 0; idx < numPoints; idx++) {
    const { x, y, link } = points[idx];
    
    ctx.moveTo(x, y);
    ctx.arc(x, y, 2, 0, PI2);
    ctx.moveTo(canvas.width - x, y);
    ctx.arc(canvas.width - x, y, 2, 0, PI2);
    
    const { x: linkX, y: linkY } = points[numPoints - idx - 1];
    ctx.moveTo(x, y);
    ctx.lineTo(canvas.width - linkX, linkY);    
    
  }
  
  ctx.stroke();

  drawFrame = window.requestAnimationFrame(draw);
}

function update() {
  const now = Date.now();
  const timeDelta = now - lastUpdateTime;
  lastUpdateTime = now;
  
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