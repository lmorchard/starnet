// Linear interpolation from v0 to v1 over t[0..1]
export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export const Lerp = {
  create({ active = true, items = {}, speed = 0.004, progress = 0.0 }) {
    const ls = { active, speed, progress, items };
    for (const key in items) {
      ls.items[key].current = ls.items[key].start;
    }
    return ls;
  },

  reset(ls, items) {
    ls.active = true;
    ls.progress = 0.0;
    if (items) {
      for (const key in ls.items) {
        Object.assign(ls.items[key], items[key])
      }
    } else {
      for (const key in ls.items) {
        const item = ls.items[key];
        item.start = item.current;
      }  
    }
  },

  set(ls, prop, values) {
    for (const key in ls.items) {
      const item = ls.items[key];
      item[prop] = values[key];
    }
  },

  setStart(ls, values) {
    Lerp.set(ls, 'start', values);
  },

  setCurrent(ls, values) {
    Lerp.set(ls, 'start', values);
  },

  setEnd(ls, values) {
    Lerp.set(ls, 'end', values);
  },

  update(ls, delta, ease = t => t) {
    const { items } = ls;
    ls.progress = Math.min(1.0, ls.progress + ls.speed * delta);
    if (ls.active) {
      if (ls.progress < 1.0) {
        for (const key in items) {
          const item = items[key];
          item.current = lerp(item.start, item.end, ease(ls.progress));
        }
      } else {
        ls.active = false;
        ls.progress = 1.0;
      }
    }
    if (!ls.active) {
      for (const key in items) {
        const item = items[key];
        item.current = item.end;
      }
    }
  }
};
