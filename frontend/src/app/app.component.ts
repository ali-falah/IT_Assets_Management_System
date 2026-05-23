import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataSyncService } from './core/services/data-sync.service';
import { ServerConfigService } from './core/services/server-config.service';
import { StatePreservationService } from './core/services/state-preservation.service';
import { MobileSetupComponent } from './shared/components/mobile-setup/mobile-setup.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MobileSetupComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  title = 'frontend';
  private dataSync = inject(DataSyncService);
  private serverConfig = inject(ServerConfigService);
  private preservation = inject(StatePreservationService);

  /**
   * Controls the first-run setup overlay.
   * Always false on web — `ServerConfigService.needsSetup()` is web-safe.
   */
  needsMobileSetup = false;

  ngOnInit() {
    // Initialize routing tracking and focus/lifecycle listeners
    this.preservation.init();
    
    // Attempt path rehydration
    this.preservation.restorePath();

    // Web: needsSetup() returns false → overlay never shown.
    // Mobile: shows overlay only when no server URL is saved yet.
    this.needsMobileSetup = this.serverConfig.needsSetup();
    this.dataSync.syncAll();
  }

  onMobileConfigured(): void {
    this.needsMobileSetup = false;
  }
}
