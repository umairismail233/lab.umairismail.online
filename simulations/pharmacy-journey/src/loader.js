// Pharmacy Journey Sim - model loading: CDN first with same-origin fallback,
// plus a small concurrency pool so boot fetches overlap instead of queueing.
//
// Models live in the dedicated public repo umairismail233/pharmacy-journey-assets
// (the Lab repo itself stays private, and jsDelivr only serves public repos).
// CDN_BASE is pinned to a commit, not a branch, so bytes cannot move under the URL.
// To update models later: push to the assets repo, then update the pin here.
// If the CDN ever fails, the same-origin fallback in loadModel still catches it.
export const CDN_BASE = 'https://cdn.jsdelivr.net/gh/umairismail233/pharmacy-journey-assets@482624c7ca4b641d49dbe0d61ca06c468188b7fb/';

// Load one model, CDN first when enabled, same-origin fallback on any failure.
// `url` is a repo-relative path like 'src/models/pharmacy-room.glb' (a leading
// './' is tolerated). All runtime GLBs are self-contained (no external URIs),
// so a CDN copy resolves exactly like a local copy.
export async function loadModel(loader, url) {
  const rel = url.replace(/^\.\//, '');
  if (CDN_BASE) {
    try {
      return await loader.loadAsync(CDN_BASE + rel);
    } catch (e) {
      console.warn('CDN model failed, same-origin fallback:', rel);
    }
  }
  return loader.loadAsync('./' + rel);
}

// Run `fn` over items with at most `limit` in flight, results in input order.
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
