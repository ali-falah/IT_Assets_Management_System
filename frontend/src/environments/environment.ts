export const environment = {
  production: false,
  platform: 'web' as const,
  apiUrl: `https://${window.location.hostname}:3000`, // Dynamically uses the current host's IP
};
