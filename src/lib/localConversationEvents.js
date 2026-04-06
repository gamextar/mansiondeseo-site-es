const CHANNEL_NAME = 'mansion-local-conversations';
const FALLBACK_EVENT = 'mansion:local-conversation-update';

let channel = null;

function getChannel() {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function publishLocalConversationUpdate(payload) {
  if (typeof window === 'undefined' || !payload) return;

  try {
    const bc = getChannel();
    bc?.postMessage(payload);
  } catch {
    // ignore
  }

  window.dispatchEvent(new CustomEvent(FALLBACK_EVENT, { detail: payload }));
}

export function subscribeLocalConversationUpdates(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  const handleFallback = (event) => {
    callback(event.detail);
  };

  window.addEventListener(FALLBACK_EVENT, handleFallback);

  const bc = getChannel();
  const handleMessage = (event) => {
    callback(event.data);
  };
  bc?.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener(FALLBACK_EVENT, handleFallback);
    bc?.removeEventListener('message', handleMessage);
  };
}
