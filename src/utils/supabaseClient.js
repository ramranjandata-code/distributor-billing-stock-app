import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase URL & Anon Key from localStorage or environment variables
export const getSupabaseConfig = () => {
  const url = localStorage.getItem('distro_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('distro_supabase_key') || import.meta.env.VITE_SUPABASE_KEY || '';
  return { url: url.trim(), key: key.trim() };
};

let cachedClient = null;
let cachedConfigKey = '';

export const getSupabaseClient = () => {
  const { url, key } = getSupabaseConfig();
  if (url && url.startsWith('http') && key) {
    const configKey = `${url}___${key}`;
    if (cachedClient && cachedConfigKey === configKey) {
      return cachedClient;
    }
    try {
      cachedClient = createClient(url, key, {
        realtime: {
          params: {
            eventsPerSecond: 20
          }
        },
        auth: {
          persistSession: false
        }
      });
      cachedConfigKey = configKey;
      return cachedClient;
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
  cachedClient = null;
  cachedConfigKey = '';
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

// --- 1-CLICK MULTI-DEVICE PAIRING ENGINE (PHONE & LAPTOPS) ---

export const generateCloudPairingCode = () => {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return '';
  const obj = { u: url, k: key, t: Date.now() };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  } catch (e) {
    return '';
  }
};

export const generateCloudPairingLink = () => {
  const code = generateCloudPairingCode();
  if (!code) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ramranjandata-code.github.io';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/distributor-billing-stock-app/';
  return `${origin}${pathname}#cloud_connect=${code}`;
};

export const applyCloudPairingCode = (code) => {
  if (!code) return false;
  try {
    const raw = decodeURIComponent(escape(atob(code.trim())));
    const parsed = JSON.parse(raw);
    if (parsed.u && parsed.k) {
      updateSupabaseCredentials(parsed.u, parsed.k);
      return true;
    }
  } catch (e) {
    console.error('Failed to decode cloud pairing code:', e);
  }
  return false;
};

