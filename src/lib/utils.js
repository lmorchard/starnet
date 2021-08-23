export const rand = (min, max) => min + Math.random() * (max - min);

let lastId = 0;
export const genid = () => lastId++;
