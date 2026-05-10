// -----------------------------------------------------------------------------
// Utilidades para trabajar con referencias de Mongoose que pueden estar
// populated o no.
// -----------------------------------------------------------------------------

/**
 * Extrae el `_id` como string desde una referencia que puede venir:
 *  - como `string` (si vos pasaste un id),
 *  - como `Types.ObjectId` (default de Mongoose, sin populate),
 *  - como objeto populated (`{ _id, ...campos }`).
 *
 * Útil para comparaciones de "¿este usuario participa en el caso?" que tienen
 * que funcionar tanto si el caso vino populated (consumido por el portal)
 * como si no.
 */
export function idOf(ref: unknown): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  const maybe = ref as { _id?: unknown; toString?: () => string };
  if (maybe._id != null) return String(maybe._id);
  return maybe.toString ? maybe.toString() : String(ref);
}
