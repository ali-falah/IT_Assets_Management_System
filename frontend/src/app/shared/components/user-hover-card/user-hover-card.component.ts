import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { User } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-hover-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="visible && user" 
         [style.top.px]="safeTop" 
         [style.left.px]="safeLeft"
         class="user-hover-card-content fixed z-45 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3.5 space-y-3 pointer-events-auto animate-in fade-in zoom-in-95 duration-100 select-none"
         (mouseenter)="onCardEnter()"
         (mouseleave)="onCardLeave()">
      
      <!-- User Profile Header -->
      <div class="flex items-start gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
          {{ user.name.charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1">
            <h4 class="text-xs font-bold text-slate-800 truncate" [title]="user.name">{{ user.name }}</h4>
            <span *ngIf="user.role" [ngClass]="user.role.colorClass || 'bg-slate-100 text-slate-700'"
              class="px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0">
              {{ user.role.name }}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 truncate mt-0.5">{{ user.email || 'No email registered' }}</p>
        </div>
      </div>

      <!-- Hardware Custody Breakdown -->
      <div class="bg-slate-50/90 rounded-xl p-2.5 border border-slate-100 space-y-1.5">
        <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>Equipment in Custody</span>
          <span class="text-indigo-600">{{ user.assets?.length || 0 }} total</span>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <span *ngIf="hasLaptop()" class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-bold">
            <lucide-icon name="laptop" [size]="11"></lucide-icon>
            <span>Laptop ({{ getLaptopCount() }})</span>
          </span>

          <span *ngIf="hasMonitors()" class="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md text-[10px] font-bold">
            <lucide-icon name="monitor" [size]="11"></lucide-icon>
            <span>Monitor ({{ getMonitorCount() }})</span>
          </span>

          <span *ngIf="(!user.assets || user.assets.length === 0)" class="text-slate-400 text-[11px] font-medium italic">
            No active hardware assigned
          </span>
        </div>
      </div>

      <!-- Footer Action -->
      <div class="flex items-center justify-end pt-1">
        <button (click)="onViewProfile($event)" 
          class="text-xs font-bold text-primary hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer focus:outline-none">
          <span>View Full Profile</span>
          <lucide-icon name="arrow-right" [size]="12"></lucide-icon>
        </button>
      </div>

    </div>
  `
})
export class UserHoverCardComponent {
  @Input() user: User | null = null;
  @Input() visible = false;
  @Input() position: { x: number; y: number; triggerTop?: number; triggerBottom?: number } = { x: 0, y: 0 };
  @Output() viewProfile = new EventEmitter<string>();
  @Output() cardHoverChange = new EventEmitter<boolean>();

  private hideTimer: any = null;

  @HostListener('document:pointermove', ['$event'])
  onDocumentPointerMove(event: PointerEvent) {
    if (!this.visible) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Inside the hover card itself?
    if (target.closest('.user-hover-card-content')) {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      return;
    }

    // Over an active user trigger element?
    if (target.closest('[data-user-hover]')) {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      return;
    }

    // Pointer is outside both hover card and trigger element!
    const cardEl = document.querySelector('.user-hover-card-content') as HTMLElement;
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      const margin = 20;
      const isFar =
        event.clientX < rect.left - margin ||
        event.clientX > rect.right + margin ||
        event.clientY < rect.top - margin ||
        event.clientY > rect.bottom + margin;

      if (isFar) {
        // Outside tolerance boundary -> hide immediately!
        if (this.hideTimer) clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.cardHoverChange.emit(false);
        return;
      }
    }

    // Short grace delay when near boundary
    if (!this.hideTimer) {
      this.hideTimer = setTimeout(() => {
        this.cardHoverChange.emit(false);
        this.hideTimer = null;
      }, 70);
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  @HostListener('window:scroll')
  @HostListener('document:scroll')
  @HostListener('document:keydown.escape')
  onDismissEvent(event?: any) {
    if (this.visible) {
      if (event?.type === 'pointerdown' && event.target?.closest('.user-hover-card-content')) {
        return;
      }
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      this.cardHoverChange.emit(false);
    }
  }

  get safeTop(): number {
    if (typeof window === 'undefined') return this.position.y;
    const cardHeight = 220;
    const triggerBottom = this.position.triggerBottom ?? this.position.y;
    const triggerTop = this.position.triggerTop ?? this.position.y;
    const spaceBelow = window.innerHeight - triggerBottom;
    const spaceAbove = triggerTop;

    if (spaceBelow >= 230 || spaceBelow >= spaceAbove) {
      // Position below trigger with 6px clearance
      return Math.min(triggerBottom + 6, window.innerHeight - cardHeight - 12);
    } else {
      // Position above trigger with 6px clearance
      return Math.max(12, triggerTop - cardHeight - 6);
    }
  }

  get safeLeft(): number {
    if (typeof window === 'undefined') return this.position.x;
    const cardWidth = 300;
    if (this.position.x + cardWidth > window.innerWidth) {
      return Math.max(12, window.innerWidth - cardWidth - 16);
    }
    return Math.max(12, this.position.x);
  }

  onCardEnter() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.cardHoverChange.emit(true);
  }

  onCardLeave() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.cardHoverChange.emit(false);
      this.hideTimer = null;
    }, 60);
  }

  onViewProfile(event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.cardHoverChange.emit(false);
    if (this.user?.id) {
      this.viewProfile.emit(this.user.id);
    }
  }

  hasLaptop(): boolean {
    return (this.user?.assets || []).some(a => (a.category?.name || a.name || '').toLowerCase().includes('laptop'));
  }

  getLaptopCount(): number {
    return (this.user?.assets || []).filter(a => (a.category?.name || a.name || '').toLowerCase().includes('laptop')).length;
  }

  hasMonitors(): boolean {
    return (this.user?.assets || []).some(a => (a.category?.name || a.name || '').toLowerCase().includes('monitor') || (a.category?.name || a.name || '').toLowerCase().includes('screen'));
  }

  getMonitorCount(): number {
    return (this.user?.assets || []).filter(a => (a.category?.name || a.name || '').toLowerCase().includes('monitor') || (a.category?.name || a.name || '').toLowerCase().includes('screen')).length;
  }
}
