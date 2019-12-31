/* global Stats */

export function initStats() {
  const drawStats = new DrawStats();
  drawStats.initialize();
  return drawStats;
}

export class DrawStats {
  initialize() {
    this.drawStats = new Stats();
    this.drawStats.setMode(0);
    this.drawStats.domElement.style.position = "absolute";
    this.drawStats.domElement.style.left = "0px";
    this.drawStats.domElement.style.top = "0px";
    document.body.appendChild(this.drawStats.domElement);

    this.tickStats = new Stats();
    this.tickStats.setMode(0);
    this.tickStats.domElement.style.position = "absolute";
    this.tickStats.domElement.style.left = "0px";
    this.tickStats.domElement.style.top = "55px";
    document.body.appendChild(this.tickStats.domElement);
  }

  stop() {
    document.body.removeChild(this.drawStats.domElement);
    document.body.removeChild(this.tickStats.domElement);
  }

  updateStart() {
    this.tickStats.begin();
  }

  updateEnd() {
    this.tickStats.end();
  }

  drawStart() {
    this.drawStats.begin();
  }

  drawEnd() {
    this.drawStats.end();
  }
}
