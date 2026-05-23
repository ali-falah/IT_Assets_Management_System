import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PlatformService } from './platform.service';

@Injectable({ providedIn: 'root' })
export class StatePreservationService {
  private router = inject(Router);
  private platform = inject(PlatformService);

  private readonly PATH_KEY = 'preserved_app_path';
  private readonly STATE_PREFIX = 'preserved_state_';

  init(): void {
    // 1. Monitor Route changes and save current path continuously
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || event.url;
        if (url && !url.includes('/login')) {
          localStorage.setItem(this.PATH_KEY, url);
        }
      });

    // 2. Listen to standard browser suspension events
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.onSuspend());
      window.addEventListener('visibilitychange', () => {
        if (document.hidden) this.onSuspend();
      });
    }

    // 3. Listen to Tauri mobile lifecycle events
    if (this.platform.isTauri) {
      this.setupTauriLifecycleListener();
    }
  }

  private async setupTauriLifecycleListener() {
    try {
      const { listen } = await import('@tauri-apps/api/event');
      await listen('mobile-lifecycle', (event) => {
        if (event.payload === 'pause') {
          this.onSuspend();
        }
      });
    } catch (err) {
      console.error('Failed to setup native lifecycle listener', err);
    }
  }

  private onSuspend() {
    console.log('[StatePreservationService] App is pausing/suspending, ensuring localStorage sync...');
  }

  restorePath(): boolean {
    const savedPath = localStorage.getItem(this.PATH_KEY);
    const token = localStorage.getItem('token');

    if (savedPath && token && savedPath !== '/' && !savedPath.includes('/login')) {
      console.log(`[StatePreservationService] Rehydrating route: ${savedPath}`);
      this.router.navigateByUrl(savedPath);
      return true;
    }
    return false;
  }

  saveState(key: string, data: any): void {
    localStorage.setItem(this.STATE_PREFIX + key, JSON.stringify(data));
  }

  getState<T>(key: string): T | null {
    const data = localStorage.getItem(this.STATE_PREFIX + key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  clearState(key: string): void {
    localStorage.removeItem(this.STATE_PREFIX + key);
  }
}
