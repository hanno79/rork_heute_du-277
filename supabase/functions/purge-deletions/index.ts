// deno-lint-ignore-file no-explicit-any
// Use built-in Deno.serve to avoid version issues with std/http

// This Edge Function purges users whose deletion is due
// Requires service_role key; protect via JWT verification in Supabase settings

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing service role' }), { status: 500 });
  }

  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    // Optionally validate a CRON secret header
    const cronSecret = Deno.env.get('CRON_SECRET')?.trim();
    const headerSecret = req.headers.get('x-cron-secret')?.trim() ?? '';
    const querySecret = new URL(req.url).searchParams.get('cron_secret')?.trim() ?? '';
    const providedSecret = headerSecret || querySecret;
    const hasServiceRoleAuth = authHeader === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;

    if (cronSecret) {
      const hasCron = providedSecret === cronSecret;
      if (!hasCron && !hasServiceRoleAuth) {
        console.warn('auth failed', {
          headerPresent: Boolean(headerSecret),
          queryPresent: Boolean(querySecret),
          providedLength: providedSecret ? providedSecret.length : 0,
          envLength: cronSecret.length,
          hasServiceRoleAuth,
        });
        return new Response(
          JSON.stringify({ error: 'Unauthorized', detail: 'cron_or_service_role_required' }),
          { status: 401 },
        );
      }
    }

    // Use PostgREST
    const rest = async (path: string, init?: RequestInit) => {
      return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          ...(init?.headers || {}),
        },
      });
    };

    // 1) Fetch due items
    const dueResp = await rest(
      'account_deletion_requests?status=eq.due',
      { method: 'GET' }
    );
    const dueItems = await dueResp.json();

    if (!Array.isArray(dueItems) || dueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No due deletions' }), { status: 200 });
    }

    // 2) For each user, delete favorites, profile, and auth.user
    const results: any[] = [];
    for (const item of dueItems) {
      const userId = item.user_id;

      // Delete favorites
      await rest(`user_favorites?user_id=eq.${userId}`, { method: 'DELETE' });
      // Delete profile
      await rest(`user_profiles?id=eq.${userId}`, { method: 'DELETE' });
      // Delete deletion request
      await rest(`account_deletion_requests?user_id=eq.${userId}`, { method: 'DELETE' });

      // Delete auth user using admin API
      const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });

      results.push({ userId, authDeleted: authResp.ok });
    }

    return new Response(JSON.stringify({ deleted: results }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

