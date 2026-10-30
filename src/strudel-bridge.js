// @strudel/soundfonts imports '@strudel/core' and '@strudel/webaudio'. The import map in
// index.html points both here, so the instruments are registered with the same copy of
// Strudel the player plays with (STRUDEL_URL in engine.js; a test checks they match).
export * from 'https://cdn.jsdelivr.net/npm/@strudel/web@1.2.6/dist/index.mjs';
