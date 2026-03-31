/** Тот же ключ, что в браузере (localStorage) — единый профиль Spektors в экосистеме. */
export const SPEKTORS_PROFILE_STORAGE_KEY = "spektors.profile.v1";

export type SpektorsProfileV1 = {
  displayName: string;
  email?: string;
};

export function profileInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.charAt(0);
    const b = parts[1]!.charAt(0);
    return (a + b).toUpperCase();
  }
  if (parts[0]) return parts[0]!.slice(0, 2).toUpperCase();
  return "?";
}

export function loadSpektorsProfile(): SpektorsProfileV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SPEKTORS_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return null;
    const displayName = (o as { displayName?: unknown }).displayName;
    if (typeof displayName !== "string") return null;
    const email = (o as { email?: unknown }).email;
    return {
      displayName: displayName.trim() || "Гость",
      email: typeof email === "string" ? email.trim() : undefined,
    };
  } catch {
    return null;
  }
}

export function saveSpektorsProfile(p: SpektorsProfileV1): void {
  if (typeof window === "undefined") return;
  const body: SpektorsProfileV1 = {
    displayName: p.displayName.trim() || "Гость",
    email: p.email?.trim() || undefined,
  };
  try {
    localStorage.setItem(SPEKTORS_PROFILE_STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* private mode */
  }
}
