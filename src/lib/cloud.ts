// Everything that talks to the shared back end (Supabase). The page works without any of it:
// browsing, search and personal marks never wait for the network.
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { Kind, Marks } from './marks';

export type Stat = { avg: number; votes: number };

let clientPromise: Promise<SupabaseClient> | null = null;

/** The sign-in library is only downloaded when it is actually needed. */
export function getClient(): Promise<SupabaseClient> {
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return clientPromise;
}

/** True when there is a saved session, or we just came back from Google with a code in the address. */
export function hasStoredSession(): boolean {
  try {
    if (/[?&]code=|access_token=/.test(location.search + location.hash)) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true;
    }
  } catch {
    /* storage blocked */
  }
  return false;
}

// ---- public numbers (no sign-in needed, no library needed) ----
export async function fetchStats(): Promise<Record<string, Stat>> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/tmx_recipe_stats?select=recipe_id,avg_score,votes`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!r.ok) return {};
    const out: Record<string, Stat> = {};
    for (const row of (await r.json()) as { recipe_id: string; avg_score: number | string; votes: number }[]) {
      out[row.recipe_id] = { avg: Number(row.avg_score), votes: row.votes };
    }
    return out;
  } catch {
    return {};
  }
}

// ---- sign-in ----
export async function signInWithGoogle(redirectTo: string): Promise<string | null> {
  const c = await getClient();
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
  return error?.message ?? null;
}

export async function sendEmailCode(email: string): Promise<string | null> {
  const c = await getClient();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? (error.status === 429 ? 'rate' : 'failed') : null;
}

export async function verifyEmailCode(email: string, token: string): Promise<string | null> {
  const c = await getClient();
  const { error } = await c.auth.verifyOtp({ email, token, type: 'email' });
  return error ? 'invalid' : null;
}

export async function signOut(): Promise<void> {
  const c = await getClient();
  await c.auth.signOut();
}

export async function onAuthChange(cb: (session: Session | null) => void): Promise<void> {
  const c = await getClient();
  // Never call the library from inside this callback directly (it can deadlock): hand off to the next tick.
  c.auth.onAuthStateChange((_event, session) => setTimeout(() => cb(session), 0));
}

// ---- my ratings ----
export async function fetchMyRatings(): Promise<Record<string, number>> {
  const c = await getClient();
  const { data } = await c.from('tmx_ratings').select('recipe_id,score');
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.recipe_id as string] = r.score as number;
  return out;
}

export async function saveRating(userId: string, recipeId: string, score: number): Promise<boolean> {
  const c = await getClient();
  const { error } = await c
    .from('tmx_ratings')
    .upsert({ user_id: userId, recipe_id: recipeId, score, updated_at: new Date().toISOString() }, { onConflict: 'user_id,recipe_id' });
  return !error;
}

export async function removeRating(recipeId: string): Promise<boolean> {
  const c = await getClient();
  const { error } = await c.from('tmx_ratings').delete().eq('recipe_id', recipeId); // row level security limits this to my own row
  return !error;
}

// ---- my marks (favorite / made it), synced across devices ----
export async function pullMarks(): Promise<Marks> {
  const c = await getClient();
  const { data } = await c.from('tmx_user_marks').select('kind,recipe_id,ts');
  const out: Marks = { fav: {}, made: {} };
  for (const r of data ?? []) out[r.kind as Kind][r.recipe_id as string] = Number(r.ts);
  return out;
}

export type MarkRow = { kind: Kind; recipe_id: string; ts: number };

export async function pushMarks(userId: string, rows: MarkRow[]): Promise<boolean> {
  if (!rows.length) return true;
  const c = await getClient();
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ user_id: userId, ...r }));
    const { error } = await c.from('tmx_user_marks').upsert(chunk, { onConflict: 'user_id,kind,recipe_id' });
    if (error) return false;
  }
  return true;
}
