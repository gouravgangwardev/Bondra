// src/hooks/useAuth.ts
// FIX Bug 7: Previously this hook maintained its own parallel auth state
// (separate useState, separate localStorage reads) alongside AuthContext.
// Two sources of truth caused state drift between the hook and the context.
// Fix: this file now re-exports from AuthContext so all call sites get the
// same single source of truth without a breaking import change.
export { useAuthContext as useAuth } from '../context/AuthContext';
