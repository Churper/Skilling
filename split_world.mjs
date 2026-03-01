import fs from 'fs';
const d = JSON.parse(fs.readFileSync('docs/world.json','utf8'));
const manifest = { chunks: d.chunks, spawn: d.spawn || '0,0' };
fs.writeFileSync('docs/chunks.json', JSON.stringify(manifest));
console.log('Wrote chunks.json with', d.chunks.length, 'chunks');
for (const key of d.chunks) {
  const [cx, cz] = key.split(',');
  const chunkData = d.data[key];
  if (!chunkData) { console.warn('No data for', key); continue; }
  const filename = `docs/chunks/chunk_${cx}_${cz}.json`;
  fs.writeFileSync(filename, JSON.stringify(chunkData));
}
console.log('Wrote', d.chunks.length, 'chunk files');
const c00 = d.data['0,0'];
if (c00) {
  const types = (c00.objects||[]).map(o=>o.type);
  const svc = types.filter(t => t.startsWith('Svc_') || t === 'Market_Stalls');
  console.log('Chunk 0,0 service objects:', svc);
}
/* write instances */
if (d.instances && Object.keys(d.instances).length > 0) {
  if (!fs.existsSync('docs/instances')) fs.mkdirSync('docs/instances');
  manifest.instances = Object.keys(d.instances);
  fs.writeFileSync('docs/chunks.json', JSON.stringify(manifest));
  for (const [name, inst] of Object.entries(d.instances)) {
    fs.writeFileSync(`docs/instances/${name}.json`, JSON.stringify(inst));
    console.log(`Wrote instance: ${name} (type=${inst.type}, heightKeys=${Object.keys(inst.heightData||{}).length})`);
  }
}
