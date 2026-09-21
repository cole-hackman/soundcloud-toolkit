/**
 * Shared support contact for server-side responses.
 *
 * This is the backend twin of `frontend-UI/src/lib/support.ts` — the two
 * cannot share an import across the frontend/backend boundary, so keep them
 * in sync by hand if the address ever changes. Never hardcode the address
 * elsewhere; import SUPPORT_EMAIL from here instead.
 */

export const SUPPORT_EMAIL = 'tracktoolkit@gmail.com';
