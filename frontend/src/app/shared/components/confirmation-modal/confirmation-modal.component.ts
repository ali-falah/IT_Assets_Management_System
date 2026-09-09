import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div *ngIf="show" class="fixed inset-0 z-[100] overflow-y-auto" style="z-index: 100;" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center p-4">
        <!-- Background backdrop covering entire screen including drawer -->
        <div (click)="onCancel()" class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" style="z-index: 100;" aria-hidden="true"></div>

        <!-- Modal panel -->
        <div class="inline-block bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all my-8 align-middle max-w-md w-full relative z-[101] animate-in zoom-in-95 duration-150 border border-slate-200" style="z-index: 101;">
          <div class="bg-white px-5 pt-5 pb-4">
            <div class="sm:flex sm:items-start">
              <div [ngClass]="iconBgClass || 'bg-rose-50 text-rose-600'" 
                   class="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full sm:mx-0">
                <lucide-icon [name]="iconName || 'alert-triangle'" [size]="20"></lucide-icon>
              </div>
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <div class="flex justify-between items-center">
                  <h3 class="text-base leading-6 font-bold text-slate-900" id="modal-title">{{ title }}</h3>
                  <button (click)="onCancel()" class="text-slate-400 hover:text-slate-600 transition-colors">
                    <lucide-icon name="x" [size]="18"></lucide-icon>
                  </button>
                </div>
                <div class="mt-2">
                  <p class="text-xs sm:text-sm text-slate-600" [innerHTML]="message"></p>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-slate-50 px-5 py-3 flex flex-row-reverse gap-2 border-t border-slate-100">
            <button (click)="onConfirm()" type="button" 
              [ngClass]="confirmButtonClass || 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'"
              class="inline-flex justify-center rounded-xl border border-transparent px-4 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer">
              {{ confirmText }}
            </button>
            <button (click)="onCancel()" type="button" 
              class="inline-flex justify-center rounded-xl border border-slate-200 shadow-2xs px-4 py-2 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer">
              {{ cancelText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationModalComponent {
  @Input() show = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed? This action cannot be undone.';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() confirmButtonClass = '';
  @Input() iconName = 'alert-triangle';
  @Input() iconBgClass = 'bg-rose-50 text-rose-600';

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm() {
    this.confirm.emit();
  }

  onCancel() {
    this.cancel.emit();
  }
}
