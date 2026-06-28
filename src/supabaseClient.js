import { createClient } from '@supabase/supabase-js';

// Retrieve credentials from localStorage if present, or fallback to Vite env variables
export function getSupabaseCredentials() {
  const url = localStorage.getItem('cricdeck_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('cricdeck_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const matchId = localStorage.getItem('cricdeck_supabase_match_id') || '';
  return { url, key, matchId };
}

// Save credentials to localStorage
export function saveSupabaseCredentials(urlOrConfig, key, matchId) {
  let url = urlOrConfig;
  let anonKey = key;
  let mId = matchId;

  if (urlOrConfig && typeof urlOrConfig === 'object') {
    url = urlOrConfig.url;
    anonKey = urlOrConfig.key;
    mId = urlOrConfig.matchId;
  }

  if (url) localStorage.setItem('cricdeck_supabase_url', url);
  else localStorage.removeItem('cricdeck_supabase_url');

  if (anonKey) localStorage.setItem('cricdeck_supabase_anon_key', anonKey);
  else localStorage.removeItem('cricdeck_supabase_anon_key');

  if (mId) localStorage.setItem('cricdeck_supabase_match_id', mId);
  else localStorage.removeItem('cricdeck_supabase_match_id');
}

let supabase = null;

export function getSupabaseClient() {
  const { url, key } = getSupabaseCredentials();
  if (url && key) {
    try {
      if (!supabase) {
        supabase = createClient(url, key);
      }
      return supabase;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return null;
}

export function resetSupabaseClient() {
  supabase = null;
}
