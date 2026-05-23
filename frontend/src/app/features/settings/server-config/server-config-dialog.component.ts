import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ServerConfigService } from '../../../core/services/server-config.service';

type TestStatus = 'testing' | 'success' | 'fail' | null;

/**
 * ServerConfigDialogComponent — In-app server URL editor.
 *
 * Mounted inside the Settings page (mobile only).
 * Allows the user to change the NestJS backend address at any time.
 * Changes take effect immediately for all subsequent HTTP requests.
 *
 * Emits `(closed)` when the dialog should be dismissed.
 */
@Component({
  selector: 'app-server-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './server-config-dialog.component.html',
  styleUrls: ['./server-config-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerConfigDialogComponent implements OnInit {

  @Output() closed = new EventEmitter<void>();

  /** Currently active URL (shown as badge). */
  currentUrl = '';
  /** Value bound to the input field. */
  newUrl = '';

  urlError: string | null = null;
  testStatus: TestStatus = null;
  isTesting = false;
  history: string[] = [];

  constructor(
    private serverConfig: ServerConfigService,
    private toastr: ToastrService
  ) {
    this.history = this.serverConfig.getHistory();
  }

  ngOnInit(): void {
    this.currentUrl = this.serverConfig.getApiUrl();
    this.newUrl = this.currentUrl;
  }

  // ---------------------------------------------------------------------------

  selectHistory(url: string): void {
    this.newUrl = url;
    this.urlError = null;
    this.testStatus = null;
  }

  // ---------------------------------------------------------------------------

  async onTest(): Promise<void> {
    if (!this.validate()) return;

    this.isTesting = true;
    this.testStatus = 'testing';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const normalizedUrl = this.newUrl.trim().replace(/\/+$/, '');

      await fetch(`${normalizedUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
      });

      clearTimeout(timeout);
      this.testStatus = 'success';
    } catch {
      this.testStatus = 'fail';
    } finally {
      this.isTesting = false;
    }
  }

  onSave(): void {
    if (!this.validate()) return;
    this.serverConfig.setApiUrl(this.newUrl);
    this.currentUrl = this.serverConfig.getApiUrl();
    this.toastr.success('Server address updated. Changes apply immediately.', 'Saved');
    this.closed.emit();
  }

  onReset(): void {
    this.serverConfig.clearConfig();
    this.newUrl = this.serverConfig.getApiUrl();
    this.currentUrl = this.newUrl;
    this.testStatus = null;
    this.toastr.info('Server address reset to default.', 'Reset');
  }

  onClose(): void {
    this.closed.emit();
  }

  /** Closes when clicking the backdrop (outside the card). */
  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-backdrop')) {
      this.closed.emit();
    }
  }

  // ---------------------------------------------------------------------------

  private validate(): boolean {
    this.urlError = null;
    const url = this.newUrl.trim();

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
      this.urlError = 'Invalid URL. Example: http://192.168.1.100:3000';
      return false;
    }
    return true;
  }
}
