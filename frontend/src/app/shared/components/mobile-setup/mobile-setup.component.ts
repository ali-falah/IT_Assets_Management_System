import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ServerConfigService } from '../../../core/services/server-config.service';

type TestStatus = 'testing' | 'success' | 'fail' | null;

/**
 * MobileSetupComponent — First-run server configuration overlay.
 *
 * Shown on Android when no server URL has been saved yet.
 * Emits `(configured)` when the user saves a valid URL,
 * so the parent (`AppComponent`) can hide this overlay.
 *
 * This component is never rendered on web — the `*ngIf="needsSetup"`
 * guard in `app.component.html` uses `ServerConfigService.needsSetup()`
 * which always returns `false` on web.
 */
@Component({
  selector: 'app-mobile-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mobile-setup.component.html',
  styleUrls: ['./mobile-setup.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSetupComponent {

  /** Emitted when configuration is saved — parent removes the overlay. */
  @Output() configured = new EventEmitter<void>();

  serverUrl = '';
  urlError: string | null = null;
  testStatus: TestStatus = null;
  isTesting = false;
  history: string[] = [];

  constructor(private serverConfig: ServerConfigService) {
    this.history = this.serverConfig.getHistory();
  }

  // ---------------------------------------------------------------------------

  selectHistory(url: string): void {
    this.serverUrl = url;
    this.urlError = null;
    this.testStatus = null;
  }

  async onTest(): Promise<void> {
    if (!this.validate()) return;

    this.isTesting = true;
    this.testStatus = 'testing';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let targetUrl = this.serverUrl.trim().replace(/\/+$/, '');
      if (!targetUrl.endsWith('/api') && !targetUrl.includes(':3000')) {
        targetUrl = `${targetUrl}/api`;
      }

      await fetch(`${targetUrl}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      this.testStatus = 'success';
    } catch {
      try {
        let fallbackUrl = this.serverUrl.trim().replace(/\/+$/, '');
        if (!fallbackUrl.endsWith('/api') && !fallbackUrl.includes(':3000')) {
          fallbackUrl = `${fallbackUrl}/api`;
        }
        await fetch(fallbackUrl, { method: 'GET', mode: 'no-cors' });
        this.testStatus = 'success';
      } catch {
        this.testStatus = 'fail';
      }
    } finally {
      this.isTesting = false;
    }
  }

  onSave(): void {
    if (!this.validate()) return;
    this.serverConfig.setApiUrl(this.serverUrl);
    this.configured.emit();
  }

  // ---------------------------------------------------------------------------

  private validate(): boolean {
    this.urlError = null;
    const url = this.serverUrl.trim();

    if (!url) {
      this.urlError = 'Server address is required.';
      return false;
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        this.urlError = 'Must start with http:// or https://';
        return false;
      }
    } catch {
      this.urlError = 'Invalid URL format. Example: http://192.168.1.100:3000';
      return false;
    }

    return true;
  }
}
