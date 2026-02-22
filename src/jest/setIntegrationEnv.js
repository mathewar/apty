// Jest 24 vm sandbox doesn't inherit all Node.js globals; expose them explicitly
if (typeof AbortController === 'undefined') {
    global.AbortController = globalThis.AbortController;
}
if (typeof AbortSignal === 'undefined') {
    global.AbortSignal = globalThis.AbortSignal;
}
