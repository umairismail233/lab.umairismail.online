// Pharmacy Journey Sim - model loading: CDN first with same-origin fallback,
// plus a small concurrency pool so boot fetches overlap instead of queueing.
//
// CDN_BASE stays empty while the repo is not publicly readable: jsDelivr only
// serves public GitHub repos, and unauthenticated reads of
// umairismail233/lab.umairismail.online return 404 (checked 2026-10-24:
// api.github.com, raw.githubusercontent.com and the jsDelivr data API all
// 404). Wiring a CDN base in while the repo reads private would make every
// load pay a failed CDN attempt before falling back, i.e. slower, not faster.
// To enable once the repo is public, set CDN_BASE to the verified pinned base:
//   'https://cdn.jsdelivr.net/gh/umairismail233/lab.umairismail.online@65db2f539145ca1b0a87dc0c6325c647d1930c38/simulations/pharmacy-journey/'
// and re-verify every file returns 200 with bytes identical to the local copy
// before shipping. The pin is a commit, not a branch, so bytes cannot move
// under the URL.
export const CDN_BASE = '';

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
