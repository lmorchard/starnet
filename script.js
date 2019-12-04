/* If you're feeling fancy you can add interactivity 
    to your site with Javascript */

// prints "hi" in the browser's dev tools console
console.log("hi");

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
    const x = (xUnit * idx)
      + (0.5 - Math.random()) * xUnit;
    const y = (yUnit * idx)
      + (0.5 - Math.random()) * yUnit;
    points.push({ x, y });
  }
  
  updateTimer = setTimeout(update, UPDATE_DELAY);
  drawFrame = window.requestAnimationFrame(draw);
}

function draw(ts) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let idx = 0; idx < numPoints; idx++) {
    const { x, y } = points[idx];
    ctx.moveTo(x, y);
    ctx.arc(x, y, 2, 0, PI2);
  }
  
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  

  // Wall
  ctx.strokeRect(75, 140, 150, 110);

  // Door
  ctx.fillRect(130, 190, 40, 60);

  // Roof
  ctx.moveTo(50, 140);
  ctx.lineTo(150, 60);
  ctx.lineTo(250, 140);
  ctx.closePath();
  ctx.stroke();

  drawFrame = window.requestAnimationFrame(draw);
}

function update() {
  const now = Date.now();
  const timeDelta = now - lastUpdateTime;
  lastUpdateTime = now;
  
  updateTimer = setTimeout(update, UPDATE_DELAY);  
}

init();