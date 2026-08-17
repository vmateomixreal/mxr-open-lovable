export function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.') || host === 'localhost') {
      return false;
    }
    return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host);
  } catch {
    return false;
  }
}
