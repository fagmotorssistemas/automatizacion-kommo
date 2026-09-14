const fs = require('fs');
const wf = JSON.parse(
  fs.readFileSync(
    'c:/Users/Usuario/Downloads/automatización-kommo.json',
    'utf8',
  ),
);

const skip = new Set(['157134', '187553']);
const rows = [];

for (const node of wf.nodes) {
  const url = String(node.parameters?.url || '');
  const body = String(node.parameters?.jsonBody || '');
  if (!url.includes('salesbot/run')) {
    continue;
  }
  const match = body.match(/bot_id["'\s:]+(\d+)/);
  if (!match || skip.has(match[1])) {
    continue;
  }
  rows.push({ prefix: node.name, botId: match[1] });
}

rows.sort((a, b) => a.prefix.localeCompare(b.prefix));
console.log(JSON.stringify(rows, null, 2));
console.error('COUNT', rows.length);
