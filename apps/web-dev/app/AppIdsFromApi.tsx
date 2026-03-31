type ConfigCheck = { app_ids?: (string | null)[] };

export async function AppIdsFromApi({ apiBase }: { apiBase: string }) {
  const url = `${apiBase}/api/v1/meta/config-check`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return (
        <p className="mt-4 text-xs text-muted">
          app_id: не удалось загрузить ({res.status})
        </p>
      );
    }
    const data = (await res.json()) as ConfigCheck;
    const ids = (data.app_ids || []).filter((x): x is string => Boolean(x));
    if (ids.length === 0) {
      return (
        <p className="mt-4 text-xs text-muted">app_id: список пуст</p>
      );
    }
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-medium text-foreground">
          app_id из GET /api/v1/meta/config-check
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {ids.map((id) => (
            <li key={id}>
              <code className="rounded-md bg-black/40 px-2 py-1 text-xs text-accent">
                {id}
              </code>
            </li>
          ))}
        </ul>
      </div>
    );
  } catch {
    return (
      <p className="mt-4 text-xs text-muted">
        app_id: ошибка сети при запросе к API
      </p>
    );
  }
}
