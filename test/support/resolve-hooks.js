export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  if (specifier === '@kabelsalat/web') return { ...result, url: result.url.replace(/index\.js$/, 'index.mjs') };
  return result;
}
