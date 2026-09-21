const fs = require('fs');
const { spawnSync } = require('child_process');

const extracted = spawnSync(process.execPath, ['scripts/extract-photo-bots.js'], {
  encoding: 'utf8',
  cwd: __dirname + '/..',
});

const rows = JSON.parse(extracted.stdout);
const values = rows
  .map((row) => `  ('${row.prefix}', ${row.botId})`)
  .join(',\n');

const sql = `-- bot_id vive en inventoryoracle (el carro), no en una tabla aparte.
-- img_prefix = como se llama el paquete de fotos en Kommo.

alter table public.inventoryoracle
  add column if not exists bot_id integer;

update public.inventoryoracle as car
set bot_id = map.bot_id
from (
  values
${values}
) as map(img_prefix, bot_id)
where car.img_prefix = map.img_prefix;

drop table if exists public.vehicle_salesbots;
`;

fs.mkdirSync('supabase', { recursive: true });
fs.writeFileSync('supabase/vehicle_salesbots.sql', sql);
console.log('wrote', rows.length, 'rows');
