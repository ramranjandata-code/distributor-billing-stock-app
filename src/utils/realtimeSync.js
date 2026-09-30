import { getSupabaseClient, getSupabaseConfig } from './supabaseClient';
import { fetchCloudData } from './storage';

// Unique instance ID so the sender ignores its own broadcast echoes
export const INSTANCE_ID = 'distro_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

let realtimeChannel = null;
let localBus = null;
let isChannelSubscribed = false;
const registeredListeners = new Set();
let isCurrentlyPulling = false;

// 1. Initialize Local BroadcastChannel for 0ms cross-window / cross-tab communication
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBus = new BroadcastChannel('distropulse_realtime_bus');
    localBus.onmessage = async (event) => {
      const data = event?.data;
      if (data && data.senderId !== INSTANCE_ID) {
        handleIncomingPulse({ source: 'local_broadcast', ...data });
      }
    };
  }
} catch (err) {
  console.warn('[RealtimeSync] Local BroadcastChannel not available:', err);
}

// 2. Setup or reconnect Supabase Realtime WebSocket Channel
export const setupRealtimeSubscription = (onRemoteUpdate) => {
  if (onRemoteUpdate) {
    registeredListeners.add(onRemoteUpdate);
  }

  const client = getSupabaseClient();
  const { url, key } = getSupabaseConfig();

  if (!client || !url || !key) {
    return () => {
      if (onRemoteUpdate) registeredListeners.delete(onRemoteUpdate);
    };
  }

  // If already subscribed to a healthy channel, just return cleanup
  if (realtimeChannel && isChannelSubscribed) {
    return () => {
      if (onRemoteUpdate) registeredListeners.delete(onRemoteUpdate);
    };
  }

  // Clean up any stale channel before subscribing
  if (realtimeChannel) {
    try {
      client.removeChannel(realtimeChannel);
    } catch (e) {}
    realtimeChannel = null;
    isChannelSubscribed = false;
  }

  try {
    // Persistent channel with broadcast + postgres_changes
    realtimeChannel = client.channel('distropulse_live_channel', {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: INSTANCE_ID }
      }
    });

    // Sub-100ms WebSocket Broadcast listener across all connected devices
    realtimeChannel.on('broadcast', { event: 'distro_sync_pulse' }, async (event) => {
      const payload = event?.payload;
      if (payload && payload.senderId !== INSTANCE_ID) {
        handleIncomingPulse({ source: 'websocket_broadcast', ...payload });
      }
    });

    // Postgres CDC changes listener on distro_cloud_store table
    realtimeChannel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'distro_cloud_store'
    }, async (payload) => {
      handleIncomingPulse({ source: 'postgres_cdc', payload });
    });

    realtimeChannel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        isChannelSubscribed = true;
        console.log('⚡ [RealtimeSync] Connected to Supabase WebSocket! Millisecond sync active.');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        isChannelSubscribed = false;
        if (err) console.warn('[RealtimeSync] Channel disconnected:', err);
      }
    });
  } catch (err) {
    console.warn('[RealtimeSync] Subscription initialization warning:', err);
  }

  return () => {
    if (onRemoteUpdate) registeredListeners.delete(onRemoteUpdate);
  };
};

// 3. Broadcast pulse immediately on local save (Millisecond latency)
export const broadcastRealtimePulse = (changeType = 'ALL') => {
  const pulse = {
    ts: Date.now(),
    senderId: INSTANCE_ID,
    changeType
  };

  // Broadcast to local tabs/windows on same device (0ms latency)
  if (localBus) {
    try {
      localBus.postMessage(pulse);
    } catch (e) {}
  }

  // Broadcast to remote devices via Supabase WebSocket (10-50ms latency)
  if (realtimeChannel && isChannelSubscribed) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'distro_sync_pulse',
        payload: pulse
      });
    } catch (e) {
      console.warn('[RealtimeSync] Failed to send broadcast pulse:', e);
    }
  }
};

// 4. Handle incoming pulse from WebSocket or local bus
const handleIncomingPulse = async (pulseData) => {
  if (isCurrentlyPulling) return;
  isCurrentlyPulling = true;

  try {
    // Pull latest data instantly with forced merge
    const hasUpdated = await fetchCloudData(true);
    if (hasUpdated || pulseData.source === 'local_broadcast') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('distro_data_changed'));
      }
      registeredListeners.forEach(listener => {
        try {
          listener(pulseData);
        } catch (e) {}
      });
    }
  } catch (err) {
    console.warn('[RealtimeSync] Error handling incoming pulse:', err);
  } finally {
    isCurrentlyPulling = false;
  }
};

// 5. Check if realtime WebSocket is active
export const isRealtimeActive = () => {
  return isChannelSubscribed;
};
