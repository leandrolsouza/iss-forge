export function rendererCsp(development = false) {
  return [
    "default-src 'self'",
    `script-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' ws://localhost:5173 https: http://localhost:* http://127.0.0.1:*' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "form-action 'none'",
  ].join('; ');
}
