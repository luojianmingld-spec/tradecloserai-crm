// HTML Sanitizer - XSS Protection
export function sanitizeHtml(html) {
  if (!html) return "";
  let clean = String(html);
  // Remove script tags and content
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove on* event handlers
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: protocol
  clean = clean.replace(/javascript\s*:/gi, "");
  // Remove iframe, object, embed, form
  clean = clean.replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  clean = clean.replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, "");
  // Remove expression() and url(javascript:)
  clean = clean.replace(/expression\s*\(/gi, "");
  clean = clean.replace(/url\s*\(\s*['"]?\s*javascript:/gi, "");
  // Remove data:text/html
  clean = clean.replace(/data\s*:\s*text\/html/gi, "");
  return clean;
}
