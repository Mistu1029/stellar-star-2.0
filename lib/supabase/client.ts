import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const _configured = !!(supabaseUrl && supabaseAnonKey);

if (!_configured && typeof window !== "undefined") {
  console.warn(
    "[StellarStar] Supabase not configured - running in offline/demo mode. " +
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable cloud sync."
  );
}

/** Returns true when Supabase env vars are present and the client is usable. */
export function isSupabaseConfigured(): boolean {
  return _configured;
}

export const supabase: SupabaseClient | null = _configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export function createAuthenticatedClient(walletAddress?: string): SupabaseClient {
  if (!_configured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  const token = typeof window !== "undefined" ? localStorage.getItem("StellarStar:authToken") : null;
  if (!token) throw new Error("Authentication token is required for authenticated requests");
  
  // TODO: Implement authenticated client caching and reuse:
  // 1. Declare a module-level cache variable: `const clientCache = new Map<string, SupabaseClient>();`
  // 2. Resolve the cache key using `walletAddress` (or fall back to a default key if not provided).
  // 3. Before creating a client, check the cache: `if (clientCache.has(key)) return clientCache.get(key);`
  // 4. Create the new client instance if not cached: `const client = createClient(...)`
  // 5. Store it in the cache: `clientCache.set(key, client);`
  // 6. Return the client.
  //
  // TODO: Add an exported clear cache function called on disconnect:
  // ```typescript
  // export function clearAuthenticatedClientCache(walletAddress?: string) {
  //   if (walletAddress) {
  //     clientCache.delete(walletAddress);
  //   } else {
  //     clientCache.clear();
  //   }
  // }
  // ```

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
