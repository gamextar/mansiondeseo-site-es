import { getStories } from './api';

let videoFeedChunkPromise = null;
let videoFeedDataPromise = null;

function markVideoFeedPrefetched() {
  try {
    sessionStorage.setItem('vf_prefetched', '1');
  } catch {}
}

export function preloadVideoFeedChunk() {
  if (!videoFeedChunkPromise) {
    videoFeedChunkPromise = import('../pages/VideoFeedPage');
    markVideoFeedPrefetched();
  }
  return videoFeedChunkPromise;
}

export function preloadVideoFeedData() {
  if (!videoFeedDataPromise) {
    videoFeedDataPromise = getStories().catch(() => null);
    markVideoFeedPrefetched();
  }
  return videoFeedDataPromise;
}

export function warmVideoFeed() {
  preloadVideoFeedChunk();
  preloadVideoFeedData();
}
