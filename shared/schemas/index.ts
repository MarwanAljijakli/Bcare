// Domain zod schemas. Used by web (form validation, API request/response parsing)
// and db (insert validation). Drizzle row types live separately in @bluecare/db.
//
// Schemas are added incrementally as modules are built. This file currently
// re-exports the foundation schemas only; per-feature schemas live in sibling files.

export * from './common';
export * from './waitlist';
