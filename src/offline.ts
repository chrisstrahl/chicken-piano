// Home-screen app: the service worker (src/sw.js, copied to dist/sw.js by build.mjs) keeps the page,
// the chicken's voice clips and the fonts so the app opens without wifi. The page itself is always
// fetched fresh when online, so a new build shows up on the next launch.
export function startOffline(): void {
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || local)) return;
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then((reg) => {
    // ask the browser not to clear our cache when space runs low
    try { navigator.storage?.persist?.(); } catch (e) {}
    // download every voice clip in the background, once the app has settled
    setTimeout(() => reg.active?.postMessage('fill-voice'), 5000);
  }).catch(() => {});
}
