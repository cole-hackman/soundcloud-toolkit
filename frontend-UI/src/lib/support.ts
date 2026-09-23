/**
 * Shared support contact — the single source of truth for the address.
 *
 * Never hardcode `tracktoolkit@gmail.com` elsewhere; import SUPPORT_EMAIL (or
 * render `<SupportLink>`) instead so a future address change is one edit.
 */

export const SUPPORT_EMAIL = "tracktoolkit@gmail.com";

/**
 * Builds a `mailto:` URL to SUPPORT_EMAIL with an encoded subject and,
 * optionally, a body.
 *
 * Uses `encodeURIComponent` rather than `URLSearchParams` — the latter's
 * form-encoding turns spaces into `+`, which `mailto:` (RFC 6068) does not
 * treat as a space, so a `+` would show up literally in some mail clients.
 */
export function supportMailto(subject: string, body?: string): string {
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}?${params.join("&")}`;
}
