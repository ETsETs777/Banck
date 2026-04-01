export const SIDEBAR_CARD_ORDER_DEFAULT = [
  "repo",
  "services",
  "docker",
  "api",
  "env",
  "customServers",
  "snippets",
] as const;

export type SidebarCardId = (typeof SIDEBAR_CARD_ORDER_DEFAULT)[number];

export const LAUNCHER_CARD_DRAG_MIME = "application/x-launcher-card";

export function isSidebarCardId(id: string): id is SidebarCardId {
  return (SIDEBAR_CARD_ORDER_DEFAULT as readonly string[]).includes(id);
}

export function normalizeSidebarOrder(raw: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw ?? []) {
    if (isSidebarCardId(id) && !seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  for (const id of SIDEBAR_CARD_ORDER_DEFAULT) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/** Вставить fromId перед toId (перетаскивание в списке). */
export function reorderSidebarCards(
  order: string[],
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return order;
  const next = order.filter((x) => x !== fromId);
  const idx = next.indexOf(toId);
  if (idx < 0) return [...next, fromId];
  next.splice(idx, 0, fromId);
  return next;
}
