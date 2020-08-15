import { System, Component, Types } from "./index.js";

export function init(world) {
  world.registerComponent(Lerper);
  world.registerSystem(LerperSystem);
}

// Linear interpolation from v0 to v1 over t[0..1]
export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export class Lerper extends Component {
  static schema = {
    items: { type: Types.Ref, default: {} },
    toDelete: { type: Types.Array, default: [] },
  }
}

export class LerpItem {
  constructor(props = {}) {
    Object.assign(this, {
      transform: v => v,
      ease: t => t,
      onEnd: () => {},
      start: 0.0,
      end: 0.0,
      duration: 0.0,
      time: 0.0,
      ...props
    })
  }
}

export class LerperSystem extends System {
  static queries = {
    lerpers: {
      components: [ Lerper ]
    }
  }

  execute(delta) {
    for (let entity of this.queries.lerpers.results) {
      const lerper = entity.getMutableComponent(Lerper);
      
      for (const key of lerper.toDelete) {
        delete lerper.items[key];
      }
      lerper.toDelete.length = 0;
      
      for (const [key, item] of Object.entries(lerper.items)) {
        item.time += delta;
        const { start, end, duration, time, transform, ease, onEnd } = item;
        if (time < duration) {
          item.value = transform(lerp(start, end, ease(item.time / duration)));
        } else {
          item.value = item.end;
          lerper.toDelete.push(key);
          onEnd({ entity, item });
        }
      }
    }
  }
}
