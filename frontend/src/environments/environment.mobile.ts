/**
 * Mobile environment configuration (Tauri v2 / Android).
 *
 * The Angular app is bundled inside the APK and communicates
 * with the NestJS backend over the network — same APIs, no changes needed.
 *
 * ⚠️  Update `apiUrl` to your deployed NestJS server address before building.
 *     Examples:
 *       Local network  → 'http://192.168.1.100:3000'
 *       Production VPS → 'https://api.your-domain.com'
 */
export const environment = {
  production: true,
  platform: 'mobile' as const,

  /**
   * Point this to your NestJS backend.
   * For local development/testing: use your machine's LAN IP.
   * For production: use your deployed server URL.
   */
  apiUrl: 'http://192.168.1.100:3000',
};
