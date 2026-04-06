# API JSON error shape

School and platform API routes that return JSON errors use a single top-level key:

| Key | Type | When |
|-----|------|------|
| `error` | `string` | Invalid JSON, business rule failure, auth failure, or a single human-readable validation summary (e.g. login). |
| `error` | `Record<string, string[] \| undefined>` | Zod `flatten().fieldErrors` after body validation (form field mapping). |

Clients should treat `error` as **`string | Record<string, …>`** and branch on `typeof error === "string"` vs object.

Success responses are route-specific; there is no shared `{ ok: true }` envelope.

Helpers live in `src/lib/api/api-json.ts` (`invalidJsonResponse`, `fieldValidationErrorResponse`, `messageErrorResponse`).
