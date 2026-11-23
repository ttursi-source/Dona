export interface GeoCoords {
  lat: number;
  lng: number;
}

export async function geocodeLocality(text: string): Promise<GeoCoords | undefined> {
  const query = text.trim();
  if (!query) return undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ar&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return undefined;
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = rows[0];
    if (!first) return undefined;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return { lat, lng };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
