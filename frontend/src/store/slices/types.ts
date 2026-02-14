// Shared types for store slices
// StoreSet and StoreGet allow each slice to access the full combined store

export type StoreSet = (partial: Record<string, unknown> | ((state: Record<string, unknown>) => Record<string, unknown>)) => void;
export type StoreGet = () => Record<string, unknown>;
