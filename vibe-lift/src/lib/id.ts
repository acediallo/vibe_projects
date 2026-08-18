// Small, dependency-free ID generator. Sortable-ish by time prefix.
export function newId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  return `${t}-${r}`
}
