// @strudel/soundfonts also imports sfumato, for .sf2 soundfont files. The player only
// uses the General MIDI instruments, so the import map in index.html points it here.
const unsupported = () => {
  throw new Error('.sf2 soundfonts are not supported in this player.');
};

export const loadSoundfont = unsupported;
export const startPresetNote = unsupported;
