import 'server-only';
export async function serverApi<T>(path:string):Promise<T> {
  const response = await fetch(`${process.env.API_INTERNAL_URL??'http://127.0.0.1:5080'}/api${path}`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok) throw new Error('Store unavailable');
  return response.json();
}
