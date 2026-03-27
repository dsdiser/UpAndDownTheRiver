export function getProxiedUrl(originalUrl: string): string {
  const isInIframe = window.self !== window.top;
  const url = new URL(originalUrl);
  // In discord iframe can only connect to a websocket that is in proxy
  // Instead of example.com/ws, you use <appid>.discordsays.com/.proxy/ws
  // Make sure the redirect is set up in application's activity URL mappings in dev console
  if (isInIframe) {
    return `${window.location.origin}/.proxy${url.pathname}${url.search}`;
  } else {
    return originalUrl;
  }
}
