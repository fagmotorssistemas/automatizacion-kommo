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

const sql = `-- 67 salesbots de fotos que hoy viven en n8n.
-- Un HTTP en Nest; el bot_id se lee de aqui.
-- inventory_id se puede llenar despues (camino preferido).

create table if not exists public.vehicle_salesbots (
  img_prefix text primary key,
  bot_id integer not null,
  inventory_id text
);

insert into public.vehicle_salesbots (img_prefix, bot_id) values
${values}
on conflict (img_prefix) do update set bot_id = excluded.bot_id;
`;

fs.mkdirSync('supabase', { recursive: true });
fs.writeFileSync('supabase/vehicle_salesbots.sql', sql);
console.log('wrote', rows.length, 'rows');
