// Builds a strudel.cc link that opens a track's code in the Strudel editor.
// Same encoding as Strudel's own code2hash: UTF-8 → base64 → URI component.

export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function strudelUrl(code, base = 'https://strudel.cc/') {
  return `${base}#${encodeURIComponent(toBase64(code))}`;
}
