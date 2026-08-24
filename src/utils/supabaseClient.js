import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase URL & Anon Key from localStorage or environment variables
export const getSupabaseConfig = () => {
  const url = localStorage.getItem('distro_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('distro_supabase_key') || import.meta.env.VITE_SUPABASE_KEY || '';
  return { url: url.trim(), key: key.trim() };
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

export const testSupabaseConnection = async () => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase URL or API Key is missing.' };
  }
  try {
    const { data, error } = await client.from('products').select('count', { count: 'exact', head: true });
    if (error) {
      return { success: false, message: error.message || 'Failed to connect to Supabase.' };
    }
    return { success: true, message: 'Successfully connected to Supabase Cloud Database!' };
  } catch (err) {
    return { success: false, message: err.message || 'Connection attempt failed.' };
  }
};

