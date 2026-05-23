import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PlatformService } from '../../core/services/platform.service';
import { ServerConfigDialogComponent } from './server-config/server-config-dialog.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ServerConfigDialogComponent],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  /** Exposed to template for `*ngIf` guard — web always gets false. */
  readonly isMobile: boolean;
  showServerConfig = false;

  constructor(private platform: PlatformService) {
    this.isMobile = platform.isMobile;
  }
}
