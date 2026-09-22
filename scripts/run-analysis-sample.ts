import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { AnalysisLlmClient } from '../src/modules/analysis/analysis-llm.client';
import { AnalysisRepository } from '../src/modules/analysis/analysis.repository';
import { AnalysisService } from '../src/modules/analysis/analysis.service';

function loadEnv(): Record<string, string> {
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

async function main(): Promise<void> {
  const env = loadEnv();
  const repository = new AnalysisRepository({
    url: env.SUPABASE_URL ?? '',
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });
  const llm = new AnalysisLlmClient({
    apiKey: env.OPENAI_API_KEY ?? '',
    model: env.OPENAI_MODEL || 'gpt-4.1-mini',
    embeddingModel: 'text-embedding-3-small',
  });
  const service = new AnalysisService(repository, llm);

  if (process.argv[2] === 'ids') {
    const ids = process.argv.slice(3).filter((id) => /^\d+$/.test(id));
    const result = await service.reanalyze(ids, { purge: false });
    console.log(JSON.stringify({ ...result, sesiones: ids.length }));
    return;
  }

  if (process.argv[2] === 'rehacer') {
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from('lead_conversation_analysis')
      .select('session_id');
    if (error) {
      throw error;
    }
    const ids = (data ?? [])
      .map((row) => String(row.session_id))
      .filter(Boolean);
    const result = await service.reanalyze(ids, { purge: false });
    console.log(JSON.stringify({ ...result, sesiones: ids.length }));
    return;
  }

  const limit = Number(process.argv[2] ?? 20);
  const result = await service.runOnce(limit, { purge: false });
  console.log(JSON.stringify(result));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
