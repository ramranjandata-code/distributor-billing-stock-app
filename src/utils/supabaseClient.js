import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase URL & Anon Key from localStorage or environment variables
export const getSupabaseConfig = () => {
  const url = localStorage.getItem('distro_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('distro_supabase_key') || import.meta.env.VITE_SUPABASE_KEY || '';
  return { url, key };
};

export const getSupabaseClient = () => {
  const { url, key } = getSupabaseConfig();
  if (url && url.startsWith('http') && key) {
    try {
      return createClient(url, key);
    } catch (err) {
      console.error('Supabase initialization error:', err);
      return null;
    }
  }
  return null;
};

export const updateSupabaseCredentials = (url, key) => {
  if (url) localStorage.setItem('distro_supabase_url', url.trim());
  if (key) localStorage.setItem('distro_supabase_key', key.trim());
  return getSupabaseClient();
};

export const isSupabaseConnected = () => {
  const client = getSupabaseClient();
  return !!client;
};
