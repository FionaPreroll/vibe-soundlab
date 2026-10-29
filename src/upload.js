// Checks files people drop into the player before they become tracks.

export const MAX_UPLOAD_BYTES = 256 * 1024;
const ALLOWED = /\.(js|mjs|txt|strudel)$/i;

/** Returns an error message for a file that can't be a Strudel track, or null. */
export function checkFile({ name = '', size = 0 } = {}) {
  if (!ALLOWED.test(name)) return `${name || 'This file'} is not a Strudel file (.js, .txt or .strudel).`;
  if (size > MAX_UPLOAD_BYTES) return `${name} is larger than ${MAX_UPLOAD_BYTES / 1024} KB.`;
  if (size === 0) return `${name} is empty.`;
  return null;
}

/** Returns an error message for file contents that can't be a track, or null. */
export function checkCode(name, code) {
  if (typeof code !== 'string' || code.trim() === '') return `${name} is empty.`;
  if (code.includes('\u0000')) return `${name} looks like a binary file, not code.`;
  return null;
}

/** Reads a File (or anything with name, size and text()) into { name, code } or { name, error }. */
export async function readUpload(file) {
  const fileError = checkFile(file);
  if (fileError) return { name: file?.name, error: fileError };
  const code = await file.text();
  const codeError = checkCode(file.name, code);
  if (codeError) return { name: file.name, error: codeError };
  return { name: file.name, code };
}
