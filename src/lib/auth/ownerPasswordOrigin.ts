export function isOwnerPasswordOriginAllowed(origin: string | null, baseUrl: string | undefined) {
  if (!origin || !baseUrl) return false;
  try {
    const configured = new URL(baseUrl);
    const secure = configured.protocol === "https:" ||
      (configured.protocol === "http:" && ["localhost", "127.0.0.1"].includes(configured.hostname));
    return secure && !configured.username && !configured.password && origin === configured.origin;
  } catch { return false; }
}
