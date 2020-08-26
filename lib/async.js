export async function awaitProperties(object) {
  const out = {};
  const entries = Object.entries(object);
  await Promise.all(entries.map(async ([name, value]) => {
    out[name] = await value;
  }));
  return out;
} 
