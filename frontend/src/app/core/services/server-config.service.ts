import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlatformService } from './platform.service';

/**
 * ServerConfigService — Mobile-only service.
 *
 * Manages the user-configured NestJS backend URL for the Android app.
 * The URL is persisted in localStorage so it survives app restarts.
 *
 * ⚠️  This service is a NO-OP on web. All methods return web defaults
 *      when `PlatformService.isMobile` is false. The web portal is
 *      completely unaffected.
 *
 * Used by:
 *   - `MobileUrlInterceptor`     — rewrites HTTP request URLs
 *   - `MobileSetupComponent`     — first-run setup overlay
 *   - `ServerConfigDialogComponent` — settings page dialog
 */
@Injectable({ providedIn: 'root' })
export class ServerConfigService {

  private readonly STORAGE_KEY = 'mobile_server_url';
  private readonly HISTORY_KEY = 'mobile_server_history';

  /** Fallback URL from compile-time environment (used until user configures one). */
  private readonly DEFAULT_URL = environment.apiUrl;

  private readonly _apiUrl$ = new BehaviorSubject<string>(this.loadSavedUrl());

  /** Observable URL — emits whenever the user changes the server address. */
  readonly apiUrl$ = this._apiUrl$.asObservable();

  constructor(private platform: PlatformService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the currently active API base URL.
   *
   * - On **web**: always returns `environment.apiUrl` (unchanged).
   * - On **mobile**: returns the user-saved URL, or the default if not yet configured.
   */
  getApiUrl(): string {
    if (!this.platform.isMobile) {
      return environment.apiUrl;
    }
    return this._apiUrl$.getValue();
  }

  /**
   * Returns a list of previously connected server URLs.
   */
  getHistory(): string[] {
    if (!this.platform.isMobile) return [];
    try {
      const saved = localStorage.getItem(this.HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Adds a URL to the connection history (keeps last 5).
   */
  private addHistory(url: string): void {
    if (!this.platform.isMobile) return;
    const history = this.getHistory();
    const updated = [url, ...history.filter(u => u !== url)].slice(0, 5);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(updated));
  }

  /**
   * Saves a new server URL and broadcasts it to all subscribers.
   * Normalizes the URL (removes trailing slash).
   *
   * Mobile-only. No-op on web.
   */
  setApiUrl(url: string): void {
    if (!this.platform.isMobile) return;

    const normalized = url.trim().replace(/\/+$/, '');
    localStorage.setItem(this.STORAGE_KEY, normalized);
    this.addHistory(normalized);
    this._apiUrl$.next(normalized);
  }

  /**
   * Returns true if the user has manually saved a server URL.
   * Always returns true on web (no configuration needed).
   */
  isConfigured(): boolean {
    if (!this.platform.isMobile) return true;
    return !!localStorage.getItem(this.STORAGE_KEY);
  }

  /**
   * Returns true when the app needs to show the first-run setup screen.
   * Only possible on mobile when no URL has been saved yet.
   */
  needsSetup(): boolean {
    return this.platform.isMobile && !this.isConfigured();
  }

  /**
   * Clears the saved URL and resets to the default.
   * Used for "Reset Connection" in settings.
   * Mobile-only. No-op on web.
   */
  clearConfig(): void {
    if (!this.platform.isMobile) return;
    localStorage.removeItem(this.STORAGE_KEY);
    this._apiUrl$.next(this.DEFAULT_URL);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private loadSavedUrl(): string {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved ?? this.DEFAULT_URL;
  }
}
