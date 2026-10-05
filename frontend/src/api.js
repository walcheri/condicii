export async function api(path, body, signal) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    signal,
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (response.status === 401 && !path.startsWith("/auth/"))
    window.dispatchEvent(new Event("pc:unauthorized"));
  if (!response.ok)
    throw Object.assign(
      new Error(data.error || "Не удалось выполнить запрос."),
      { status: response.status },
    );
  return data;
}
