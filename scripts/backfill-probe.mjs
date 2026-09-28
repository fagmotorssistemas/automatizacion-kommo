import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs
    .readFileSync(path.resolve(process.cwd(), '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const supabaseUrl = env.SUPABASE_URL.replace(/\/$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  accept: 'application/json',
};

async function rest(pathAndQuery, extra = {}) {
  const res = await fetch(`${supabaseUrl}${pathAndQuery}`, {
    headers: { ...headers, ...extra },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function postJson(path, body, extra = {}) {
  const res = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

const sql =
  'alter table public.leads add column if not exists nombre_cedula text, add column if not exists origen text;';

const attempts = {};
for (const pathTry of [
  '/pg/query',
  '/pg-meta/default/query',
  '/pg-meta/query',
]) {
  attempts[pathTry] = await postJson(pathTry, { query: sql });
}

const rpcNames = ['exec_sql', 'sql', 'execute_sql', 'run_sql'];
for (const name of rpcNames) {
  attempts[`rpc:${name}`] = await postJson(`/rest/v1/rpc/${name}`, {
    query: sql,
    q: sql,
    sql,
  });
}

const [chatSample, chatOpen, carsSample, carsOpen] = await Promise.all([
  rest('/rest/v1/n8n_chat_histories?select=*&order=id.desc&limit=1'),
  rest('/rest/v1/', { accept: 'application/openapi+json' }),
  rest('/rest/v1/interested_cars?select=*&order=id.desc&limit=1'),
  rest('/rest/v1/interested_cars?select=*&limit=0'),
]);

const defs = chatOpen.body?.definitions ?? chatOpen.body?.components?.schemas ?? {};
const chatCols = defs.n8n_chat_histories?.properties
  ? Object.keys(defs.n8n_chat_histories.properties)
  : null;
const carCols = defs.interested_cars?.properties
  ? Object.keys(defs.interested_cars.properties)
  : null;

fs.writeFileSync(
  path.resolve(process.cwd(), 'scripts', 'backfill-probe.out.json'),
  JSON.stringify(
    {
      attempts,
      chatSample,
      carsSample,
      chatCols,
      carCols,
    },
    null,
    2,
  ),
);
console.log('ok');
