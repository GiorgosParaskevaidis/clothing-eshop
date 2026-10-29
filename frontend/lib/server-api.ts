import 'server-only';
export class ServerApiError extends Error {
  constructor(public readonly status: number) {
    super('Store unavailable');
  }
}
export async function serverApi<T>(path: string): Promise<T> {
  const response = await fetch(
    `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:5080'}/api${path}`,
    { cache: 'no-store', signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new ServerApiError(response.status);
  return response.json();
}
