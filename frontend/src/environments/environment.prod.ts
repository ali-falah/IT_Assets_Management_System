export const environment = {
  production: true,
  platform: 'web' as const,
  apiUrl: `https://${typeof window !== 'undefined' ? window.location.hostname : '192.168.40.149'}:3000`,
};
