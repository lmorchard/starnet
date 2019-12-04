/* If you're feeling fancy you can add interactivity 
    to your site with Javascript */

// prints "hi" in the browser's dev tools console
console.log("hi");

const UPDATE_DELAY = 16;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');


function draw(ts) {

  window.requestAnimationFrame(draw);
}

let updateTimer = null;
let lastUpdateTime = Date.now();

function update() {
  const now = Date.now();
  const timeDelta = now - lastUpdateTime;
  lastUpdateTime = now;
  
  updateTimer = setTimeout(update, UPDATE_DELAY);  
}

function init() {
  updateTimer = setTimeout(update, UPDATE_DELAY);
  window.requestAnimationFrame(draw);
}

init();