// Shared tRPC HTTP fetch helpers used across screens

const API = 'https://app.kolasys.ai/api/trpc';

/** Fire a tRPC GET query and return the typed result. */
export async function trpcGet<T>(
  procedure: string,
  input: Record<string, unknown>,
  token: string | null,
  signal?: AbortSignal,
): Promise<T> {
  const inputParam = encodeURIComponent(JSON.stringify({ '0': { json: input } }));
  const url = `${API}/${procedure}?batch=1&input=${inputParam}`;

  const res = await fetch(url, {
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const raw = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const item = Array.isArray(raw) ? raw[0] : raw;
  if (item?.error) throw new Error(item.error.message ?? 'tRPC error');
  return item?.result?.data?.json ?? item?.result?.data;
}

/** Fire a tRPC POST mutation and return the typed result. */
export async function trpcPost<T = void>(
  procedure: string,
  input: Record<string, unknown>,
  token: string | null,
): Promise<T> {
  const url = `${API}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify([{ json: input }]),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const raw = await res.json().catch(() => null);
  const item = Array.isArray(raw) ? raw[0] : raw;
  return (item?.result?.data?.json ?? item?.result?.data) as T;
}
