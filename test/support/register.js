// @strudel/core imports '@kabelsalat/web', whose package.json points Node at a
// browser IIFE build. This hook sends Node to the package's ES module build instead.
import { register } from 'node:module';

register('./resolve-hooks.js', import.meta.url);
