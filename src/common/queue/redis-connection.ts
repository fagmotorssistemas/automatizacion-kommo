/** BullMQ exige maxRetriesPerRequest: null. No reutilizar REDIS_CLIENT. */
export function redisConnectionFromUrl(url: string) {
  const parsed = new URL(url);
  const dbPath = parsed.pathname.replace(/^\//, '');

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.username
      ? { username: decodeURIComponent(parsed.username) }
      : {}),
    ...(parsed.password
      ? { password: decodeURIComponent(parsed.password) }
      : {}),
    ...(dbPath ? { db: Number(dbPath) } : {}),
    maxRetriesPerRequest: null as null,
  };
}
