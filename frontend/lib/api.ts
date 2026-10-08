export async function api<T>(path:string,init?:RequestInit):Promise<T> {
  const response = await fetch(`/api${path}`,{...init,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Store-Request':'1',...init?.headers}});
  if(!response.ok) {
    let message = response.status===401?'Please sign in.':response.status===429?'Too many requests. Please try again shortly.':'The store is temporarily unavailable.';
    try { const error = await response.json(); message = error.message ?? message; } catch {}
    throw new Error(message);
  }
  return response.status===204 || response.headers.get('content-length')==='0' ? undefined as T : await response.json().catch(()=>undefined);
}
