// Linear interpolation from v0 to v1 over t[0..1]
export function lerp(v0, v1, t) {
  return (1 - t) * v0 + t * v1;
}

export const Lerp = {
  create({ active = true, items = {}, duration = 1000, progress = 0.0 }) {
    const ls = { active, duration, progress, items };
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
        Object.assign(ls.items[key], items[key]);
      }
    } else {
      for (const key in ls.items) {
        const item = ls.items[key];
        item.start = item.current;
      }
    }
  },

  getCurrent(ls, name) {
    return ls.items[name].current;
  },

  set(ls, prop, values) {
    for (const key in ls.items) {
      const item = ls.items[key];
      item[prop] = values[key];
    }
  },

  setStart(ls, values) {
    Lerp.set(ls, "start", values);
  },

  setCurrent(ls, values) {
    Lerp.set(ls, "current", values);
  },

  setEnd(ls, values) {
    Lerp.set(ls, "end", values);
  },

  update(ls, delta, transform = t => t) {
    const { items } = ls;
    if (ls.active) {
      ls.progress = Math.min(ls.duration, ls.progress + delta);
      if (ls.progress < ls.duration) {
        for (const key in items) {
          const item = items[key];
          item.current = lerp(
            item.start,
            item.end,
            transform(ls.progress / ls.duration)
          );
        }
      } else {
        ls.active = false;
        ls.progress = ls.duration;
      }
    }
    if (!ls.active) {
      for (const key in items) {
        const item = items[key];
        item.current = lerp(
          item.start,
          item.end,
          transform(1.0)
        );
      }
    }
  }
};
