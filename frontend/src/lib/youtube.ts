function toWatchUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl.trim());
    if (url.hostname.includes("youtu.be")) {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
    const videoId = url.searchParams.get("v");
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  } catch {
    return rawUrl.trim();
  }
  return rawUrl.trim();
}

export async function fetchYoutubeTitle(rawUrl: string) {
  const watchUrl = toWatchUrl(rawUrl);
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
  ];
  for (const endpoint of endpoints) {
    const response = await fetch(endpoint);
    if (!response.ok) continue;
    const data = (await response.json()) as { title?: string };
    if (data.title) return data.title;
  }
  throw new Error("Could not find video");
}
