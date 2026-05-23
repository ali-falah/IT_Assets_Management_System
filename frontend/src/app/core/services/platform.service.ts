import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlatformService {

  readonly isTauri: boolean;
  readonly isMobile: boolean;
  readonly isWeb: boolean;

  constructor() {
    this.isTauri = typeof window !== 'undefined' &&
                   !!(window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];

    this.isMobile = (environment.platform as string) === 'mobile';
    this.isWeb    = !this.isMobile;
  }

  async invoke<T>(
    command: string,
    args?: Record<string, unknown>
  ): Promise<T | null> {
    if (!this.isTauri) {
      console.warn(`[PlatformService] invoke("${command}") called on web — skipping.`);
      return null;
    }

    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  async isOnline(): Promise<boolean> {
    if (!this.isTauri) {
      return navigator.onLine;
    }
    const result = await this.invoke<boolean>('check_connectivity');
    return result ?? navigator.onLine;
  }

  get platformLabel(): string {
    if (this.isMobile) return 'Tauri/Android';
    return 'Web Browser';
  }
}
