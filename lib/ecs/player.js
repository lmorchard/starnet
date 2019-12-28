export function init(world) {
}

export function initState(worldState, {  }) {
  worldState
    .addComponent(PlayerState, {  });
}

export class PlayerState {
  constructor() {
    Object.assign(this, {
      currentNode: null,
      originNode: null,
    });
  }
}