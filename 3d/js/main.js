// Bootstrap: make sure this device can run the 3D game (WebGL), then load it.
// If it can't (e.g. the PlayStation's built-in browser), index.html's classic
// fallback script shows a friendly card that links to the 2D game instead.
window.__lulu3dBooted = true;

function webglOK() {
    if (/[?&]nowebgl\b/.test(location.search)) return false;   // test hook
    try {
        const c = document.createElement("canvas");
        return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
}

if (webglOK()) {
    import("./app.js").catch(e => {
        console.error("Lulu3D failed to load", e);
        if (window.__lulu3dFallback) window.__lulu3dFallback("load");
    });
} else if (window.__lulu3dFallback) {
    window.__lulu3dFallback("webgl");
}
