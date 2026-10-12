/**
 * Node resolve hook so research scripts can import the app's ES modules, whose
 * imports have no extension (Vite resolves them; Node does not):
 *
 *   node --import ./research/tools/ext-loader.mjs research/tools/screen-check.mjs ...
 */
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND' || !/^\\.{1,2}\\//.test(specifier)) throw err;
    return next(specifier + '.js', context);
  }
}`),
  import.meta.url,
);
