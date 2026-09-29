const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const text = fs.readFileSync('.env', 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

function clip(v, n = 900) {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (typeof s !== 'string') return String(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

(async () => {
  const env = loadEnv();
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cid = '43744337';
  const since = '2026-09-29T14:28:00.000Z';
  const { data, error } = await sb
    .from('automation_run_logs')
    .select('created_at,step,status,reason,detail,error')
    .eq('contact_id', cid)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(80);
  if (error) {
    console.log('ERR', error.message);
    return;
  }
  console.log('COUNT', (data || []).length);
  for (const r of data || []) {
    const d = r.detail || {};
    console.log('\n====', r.created_at, r.step, r.status, r.reason || '');
    console.log('plan', clip(d.plan, 400));
    console.log('resumen', clip(d.resumen, 700));
    console.log('mensaje', clip(d.mensaje, 800));
    console.log('inventoryId', d.inventoryId);
    if (d.texto) console.log('texto', clip(d.texto, 300));
    if (r.error) console.log('error', r.error);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
