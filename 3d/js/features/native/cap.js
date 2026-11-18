// features/native — the Capacitor bridge, the way the classic 2D game reaches it
// (src/10c-ads.js, src/10h-haptics.js): no bundler, no @capacitor/core import.
// Inside the iOS app Capacitor's native bridge injects window.Capacitor before
// any page script runs, with every installed plugin under Capacitor.Plugins
// (AdMob — which also carries App Tracking Transparency —, Haptics, App…).
// On the web (lulu.boats) none of it exists and everything here is null.

/** True only inside the native iOS / Android app. */
export function isNative() {
    try {
        const cap = window.Capacitor;
        return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
    } catch (e) { return false; }
}

/** A native plugin by name (Capacitor.Plugins[name]), or null on the web / when it isn't installed. */
export function plugin(name) {
    try {
        if (!isNative()) return null;
        const p = window.Capacitor.Plugins;
        return (p && p[name]) || null;
    } catch (e) { return null; }
}

/** "ios" | "android" | "web". */
export function platformName() {
    try { return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || "web"; }
    catch (e) { return "web"; }
}

/** Call a plugin method that may return a promise, never throwing. Resolves to its result or undefined. */
export function call(p, method, arg) {
    try {
        if (!p || typeof p[method] !== "function") return Promise.resolve(undefined);
        return Promise.resolve(arg === undefined ? p[method]() : p[method](arg)).catch(() => undefined);
    } catch (e) { return Promise.resolve(undefined); }
}
