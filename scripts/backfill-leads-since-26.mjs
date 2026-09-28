import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const CUTOFF = '2026-09-26T16:11:00.000Z';
const SELLERS = {
  13895303: '16a2bf26-6cba-4aa6-8ede-6c0a87a5443c',
  13894775: 'ecce58a4-3962-4f14-970b-b0a0c9873803',
  14438079: 'b374c77b-3516-4d64-a94d-6c33ee49ddbf',
  15528168: 'c787d41f-16fb-422d-9b57-f145b941e437',
};
const DEFAULT_ASSIGNEE = '920fe992-8f4a-4866-a9b6-02f6009fc7b3';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OUT = path.resolve(process.cwd(), 'scripts', 'backfill-leads-since-26.out.json');

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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});
const kommoUrl = env.KOMMO_BASE_URL.replace(/\/$/, '');
const kommoToken = env.KOMMO_TOKEN;

const summary = {
  startedAt: new Date().toISOString(),
  contacts: 0,
  alreadyInLeads: 0,
  inserted: [],
  skipped: [],
  cars: { inserted: 0, skipped: 0 },
  errors: [],
};

function save() {
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

function extractPhone(contact) {
  const fields = contact?.custom_fields_values;
  if (!Array.isArray(fields)) {
    return null;
  }
  const phoneField = fields.find(
    (field) => field.field_code === 'PHONE' || field.field_name === 'Phone',
  );
  const value = phoneField?.values?.[0]?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function inventoryIdFromAi(content) {
  if (typeof content !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(content);
    const id = parsed?.meta?.vehiculo?.inventory_id;
    return typeof id === 'string' && UUID.test(id.trim()) ? id.trim() : null;
  } catch {
    return null;
  }
}

async function pageQuery(build) {
  const pageSize = 100;
  const rows = [];
  let from = 0;
  for (;;) {
    let attempt = 0;
    let data;
    let error;
    for (;;) {
      const result = await build(from, from + pageSize - 1);
      data = result.data;
      error = result.error;
      if (!error) {
        break;
      }
      attempt += 1;
      if (attempt >= 6) {
        throw new Error(error.message);
      }
      await sleep(400 * attempt);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) {
      break;
    }
    from += pageSize;
    await sleep(60);
  }
  return rows;
}

async function kommo(path, attempt = 1) {
  try {
    const res = await fetch(`${kommoUrl}${path}`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${kommoToken}`,
      },
    });
    if (res.status === 204) {
      return null;
    }
    const text = await res.text();
    if (!res.ok) {
      return { _error: res.status };
    }
    return JSON.parse(text);
  } catch (error) {
    if (attempt >= 5) {
      return { _error: 'network' };
    }
    await sleep(500 * attempt);
    return kommo(path, attempt + 1);
  }
}

console.log('leyendo logs webhook desde', CUTOFF);
const logRows = await pageQuery((from, to) =>
  supabase
    .from('automation_run_logs')
    .select('contact_id,lead_id,step,detail,created_at')
    .gte('created_at', CUTOFF)
    .eq('step', 'webhook')
    .order('created_at', { ascending: true })
    .range(from, to),
);
console.log('logs webhook', logRows.length);

const byContact = new Map();
for (const row of logRows) {
  const contactId = String(row.contact_id ?? '').trim();
  if (!contactId) {
    continue;
  }
  const current = byContact.get(contactId) ?? {
    contactId,
    leadIdKommo: null,
    phone: null,
    source: 'waba',
    photosAt: null,
    inventoryIds: new Set(),
  };
  if (row.lead_id) {
    current.leadIdKommo = String(row.lead_id);
  }
  const phone = row.detail?.phone;
  if (typeof phone === 'string' && phone.trim()) {
    current.phone = phone.trim();
  }
  if (row.detail?.route === 'waba' || row.detail?.origin === 'waba') {
    current.source = 'waba';
  } else if (typeof row.detail?.origin === 'string' && row.detail.origin.trim()) {
    current.source = row.detail.origin.trim();
  }
  byContact.set(contactId, current);
}

console.log('leyendo logs agent/outbound');
const extraLogs = await pageQuery((from, to) =>
  supabase
    .from('automation_run_logs')
    .select('contact_id,lead_id,step,detail,created_at')
    .gte('created_at', CUTOFF)
    .in('step', ['agent', 'outbound'])
    .order('created_at', { ascending: true })
    .range(from, to),
);
for (const row of extraLogs) {
  const contactId = String(row.contact_id ?? '').trim();
  if (!contactId) {
    continue;
  }
  const current = byContact.get(contactId);
  if (!current) {
    continue;
  }
  if (row.lead_id && !current.leadIdKommo) {
    current.leadIdKommo = String(row.lead_id);
  }
  const inventoryId = row.detail?.inventoryId;
  if (typeof inventoryId === 'string' && UUID.test(inventoryId.trim())) {
    current.inventoryIds.add(inventoryId.trim());
  }
  if (
    row.step === 'outbound' &&
    Array.isArray(row.detail?.photoBots) &&
    row.detail.photoBots.length > 0
  ) {
    current.photosAt = row.created_at;
  }
}

const contacts = [...byContact.values()];
summary.contacts = contacts.length;
console.log('contactos únicos', contacts.length);
save();

for (const [index, item] of contacts.entries()) {
  const contactId = item.contactId;
  console.log(`${index + 1}/${contacts.length} contact ${contactId}`);
  const existing = await supabase
    .from('leads')
    .select('id,contact_id,lead_id_kommo')
    .eq('contact_id', contactId)
    .limit(1)
    .maybeSingle();
  if (existing.error && !String(existing.error.message).includes('nombre_cedula')) {
    summary.errors.push({ contactId, error: existing.error.message });
    save();
    continue;
  }
  if (existing.data?.id) {
    summary.alreadyInLeads += 1;
    item.supabaseId = existing.data.id;
    item.leadIdKommo = item.leadIdKommo || String(existing.data.lead_id_kommo);
    continue;
  }

  const contact = await kommo(`/api/v4/contacts/${contactId}?with=leads`);
  await sleep(120);
  if (!contact || contact._error) {
    summary.skipped.push({ contactId, reason: `kommo_${contact?._error ?? 'empty'}` });
    save();
    continue;
  }
  const embeddedLead = contact._embedded?.leads?.[0]?.id;
  const leadIdKommo =
    item.leadIdKommo || (embeddedLead ? String(embeddedLead) : null);
  if (!leadIdKommo) {
    summary.skipped.push({ contactId, reason: 'sin_lead_kommo' });
    save();
    continue;
  }
  item.leadIdKommo = leadIdKommo;
  const kommoLead = await kommo(`/api/v4/leads/${leadIdKommo}`);
  await sleep(120);
  const responsible = Number(kommoLead?.responsible_user_id);
  const payload = {
    contact_id: Number(contactId) || contactId,
    lead_id_kommo: Number(leadIdKommo) || leadIdKommo,
    name: String(contact.name ?? '').trim() || 'sin nombre',
    phone: extractPhone(contact) || item.phone || 'Sin número',
    source: item.source || 'waba',
    assigned_to: SELLERS[responsible] || DEFAULT_ASSIGNEE,
    ...(item.photosAt ? { fotos_enviadas_at: item.photosAt } : {}),
  };
  const inserted = await supabase
    .from('leads')
    .insert(payload)
    .select('id,contact_id,lead_id_kommo')
    .single();
  if (inserted.error) {
    summary.errors.push({ contactId, leadIdKommo, error: inserted.error.message });
    save();
    continue;
  }
  item.supabaseId = inserted.data.id;
  summary.inserted.push({
    contactId,
    leadIdKommo,
    supabaseId: inserted.data.id,
  });
  save();
}

console.log('interested_cars');
for (const item of contacts) {
  if (!item.supabaseId) {
    continue;
  }
  const { data: chat } = await supabase
    .from('n8n_chat_histories')
    .select('message')
    .eq('session_id', item.contactId)
    .gte('created_at', CUTOFF)
    .order('id', { ascending: true })
    .limit(80);
  for (const row of chat ?? []) {
    const id = inventoryIdFromAi(row.message?.content);
    if (id) {
      item.inventoryIds.add(id);
    }
  }
  for (const inventoryId of item.inventoryIds) {
    const already = await supabase
      .from('interested_cars')
      .select('id')
      .eq('lead_id', item.supabaseId)
      .eq('inventory_id', inventoryId)
      .maybeSingle();
    if (already.data?.id) {
      summary.cars.skipped += 1;
      continue;
    }
    const stock = await supabase
      .from('inventoryoracle')
      .select('id')
      .eq('id', inventoryId)
      .maybeSingle();
    if (!stock.data?.id) {
      summary.cars.skipped += 1;
      continue;
    }
    const vehicleUid = item.leadIdKommo
      ? fnv1a(`${item.leadIdKommo}|${inventoryId}`)
      : null;
    const inserted = await supabase.from('interested_cars').insert({
      lead_id: item.supabaseId,
      inventory_id: inventoryId,
      vehicle_uid: vehicleUid,
    });
    if (inserted.error) {
      summary.errors.push({
        kind: 'car',
        contactId: item.contactId,
        inventoryId,
        error: inserted.error.message,
      });
      continue;
    }
    summary.cars.inserted += 1;
  }
}

const lead420 = await supabase
  .from('leads')
  .select('id,contact_id,lead_id_kommo,name,phone,source,assigned_to,fotos_enviadas_at')
  .eq('lead_id_kommo', 42063595)
  .maybeSingle();
summary.lead42063595 = lead420.data;
if (lead420.data?.id) {
  const cars = await supabase
    .from('interested_cars')
    .select('id,inventory_id,vehicle_uid')
    .eq('lead_id', lead420.data.id);
  summary.cars42063595 = cars.data;
}
summary.finishedAt = new Date().toISOString();
save();
console.log(
  JSON.stringify(
    {
      contacts: summary.contacts,
      alreadyInLeads: summary.alreadyInLeads,
      inserted: summary.inserted.length,
      skipped: summary.skipped.length,
      carsInserted: summary.cars.inserted,
      carsSkipped: summary.cars.skipped,
      errors: summary.errors.length,
      lead420: summary.lead42063595?.id ?? null,
    },
    null,
    2,
  ),
);
