import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="animate-pulse bg-slate-200 rounded"
      [ngClass]="customClass"
      [style.width]="width"
      [style.height]="height"
    ></div>
  `,
  styles: [`
    :host {
      display: inline-block;
      width: 100%;
    }
    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .5; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoaderComponent {
  @Input() width: string = '100%';
  @Input() height: string = '20px';
  @Input() customClass: string = '';
}
