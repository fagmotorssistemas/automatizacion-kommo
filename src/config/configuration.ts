export default () => ({
  port: Number(process.env.PORT ?? 3000),
  kommo: {
    baseUrl: process.env.KOMMO_BASE_URL,
    token: process.env.KOMMO_TOKEN ?? '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    embeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
});
