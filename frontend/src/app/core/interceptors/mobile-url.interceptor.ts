import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ServerConfigService } from '../services/server-config.service';

/**
 * MobileUrlInterceptor — Mobile-only HTTP interceptor.
 *
 * Rewrites outgoing HTTP request URLs by replacing the compile-time
 * `environment.apiUrl` base with the user-configured server address
 * stored in `ServerConfigService`.
 *
 * This allows users to change the backend IP in the app settings
 * without requiring a reinstall.
 *
 * ──────────────────────────────────────────────
 * WEB PORTAL: This interceptor is a COMPLETE NO-OP on web.
 * The first guard `environment.platform !== 'mobile'` exits immediately,
 * so web behaviour is identical to before this interceptor was added.
 * ──────────────────────────────────────────────
 *
 * Example:
 *   Compile-time apiUrl : http://localhost:3000
 *   User-saved URL      : http://192.168.1.50:3000
 *   Request URL in      : http://localhost:3000/assets
 *   Request URL out     : http://192.168.1.50:3000/assets
 */
export const mobileUrlInterceptor: HttpInterceptorFn = (req, next) => {
  // ✅ Web guard — absolute no-op, zero overhead on web portal
  if ((environment.platform as string) !== 'mobile') {
    return next(req);
  }

  const serverConfig = inject(ServerConfigService);
  const configuredBase = serverConfig.getApiUrl();
  const compileTimeBase = environment.apiUrl;

  // If the URL starts with the compile-time base, replace it with the
  // user-configured base. Handles both configured and default cases.
  if (req.url.startsWith(compileTimeBase) && configuredBase !== compileTimeBase) {
    const rewrittenUrl = req.url.replace(compileTimeBase, configuredBase);
    return next(req.clone({ url: rewrittenUrl }));
  }

  return next(req);
};
