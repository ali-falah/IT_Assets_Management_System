import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div (click)="onBackdropClick()" 
         class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
         role="dialog"
         aria-modal="true">
      <div (click)="$event.stopPropagation()"
           [class]="'bg-white w-full rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 ' + maxWidthClass">
        
        <!-- Optional Custom Header Projection -->
        <ng-content select="[dialogHeader]"></ng-content>

        <!-- Standard Header -->
        <div *ngIf="showHeader" class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <div *ngIf="icon" [class]="'p-1.5 rounded-lg flex items-center justify-center shrink-0 ' + (iconBgClass || 'bg-slate-100')">
              <lucide-icon [name]="icon" [size]="18" [class]="iconClass"></lucide-icon>
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate">{{ title }}</h3>
              <p *ngIf="subtitle" class="text-xs text-slate-500 truncate mt-0.5">{{ subtitle }}</p>
            </div>
          </div>
          <button *ngIf="showCloseButton" 
                  type="button"
                  (click)="onClose()" 
                  class="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0 ml-2"
                  title="Close">
            <lucide-icon name="x" [size]="18"></lucide-icon>
          </button>
        </div>

        <!-- Body (scrollable) -->
        <div class="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          <ng-content></ng-content>
        </div>

        <!-- Optional Custom Footer Projection -->
        <ng-content select="[dialogFooter]"></ng-content>

        <!-- Standard Footer -->
        <div *ngIf="showFooter" class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end items-center gap-3 shrink-0">
          <button *ngIf="secondaryButtonText" 
                  type="button"
                  (click)="onClose()" 
                  class="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-semibold text-xs transition-all cursor-pointer">
            {{ secondaryButtonText }}
          </button>
          <button type="button"
                  (click)="onPrimaryAction()"
                  [disabled]="primaryButtonDisabled || primaryButtonLoading"
                  [class]="'px-6 py-2 rounded-xl font-semibold text-xs transition-all shadow-md shadow-indigo-100 disabled:opacity-50 active:scale-95 cursor-pointer flex items-center justify-center ' + primaryButtonClass">
            <span *ngIf="primaryButtonLoading" class="mr-2 w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            {{ primaryButtonText }}
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';
  @Input() iconClass = 'text-primary';
  @Input() iconBgClass = 'bg-primary/10';
  @Input() maxWidth: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' = 'md';
  @Input() primaryButtonText = 'Save';
  @Input() primaryButtonDisabled = false;
  @Input() primaryButtonLoading = false;
  @Input() primaryButtonClass = 'bg-primary hover:bg-indigo-600 text-white';
  @Input() secondaryButtonText = 'Cancel';
  @Input() showHeader = true;
  @Input() showFooter = true;
  @Input() showCloseButton = true;
  @Input() closeOnBackdropClick = true;
  @Input() closeOnEscape = true;

  @Output() close = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.closeOnEscape) {
      this.close.emit();
    }
  }

  get maxWidthClass(): string {
    switch (this.maxWidth) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-lg';
      case 'xl': return 'max-w-xl';
      case '2xl': return 'max-w-2xl';
      case '3xl': return 'max-w-3xl';
      case '4xl': return 'max-w-4xl';
      default: return 'max-w-md';
    }
  }

  onBackdropClick() {
    if (this.closeOnBackdropClick) {
      this.close.emit();
    }
  }

  onClose() {
    this.close.emit();
  }

  onPrimaryAction() {
    if (!this.primaryButtonDisabled && !this.primaryButtonLoading) {
      this.primaryAction.emit();
    }
  }
}
