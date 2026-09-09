import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { AssetLabelService, LabelData, LabelTemplate } from '../../../core/services/asset-label.service';

@Component({
  selector: 'app-asset-label-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="show" class="fixed inset-0 z-[120] overflow-y-auto" aria-labelledby="label-modal-title" role="dialog" aria-modal="true">
      <div class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center p-3 sm:p-4">
        <!-- Backdrop -->
        <div (click)="onClose()" class="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" aria-hidden="true"></div>

        <!-- Modal Box -->
        <div class="inline-block bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all my-6 align-middle max-w-lg w-full relative z-[121] animate-in zoom-in-95 duration-150 border border-slate-200">
          
          <!-- Header -->
          <div class="bg-slate-50/80 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/60 shadow-2xs">
                <lucide-icon name="printer" [size]="18"></lucide-icon>
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-800" id="label-modal-title">Print Asset Label</h3>
                <p class="text-[11px] text-slate-500 font-mono">{{ asset?.serialNumber || 'No Serial' }} • {{ asset?.name }}</p>
              </div>
            </div>
            <button (click)="onClose()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
              <lucide-icon name="x" [size]="16"></lucide-icon>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4">
            
            <!-- Template Size Picker -->
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Label Format & Size</label>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" 
                  (click)="setTemplate('standard')"
                  [ngClass]="selectedTemplate === 'standard' 
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold ring-2 ring-emerald-500/20' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'"
                  class="p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between cursor-pointer">
                  <div class="font-bold flex items-center justify-between">
                    <span>Standard</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100/80 text-emerald-700 font-semibold">QR+Bar</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">70 × 38 mm</div>
                </button>

                <button type="button" 
                  (click)="setTemplate('compact')"
                  [ngClass]="selectedTemplate === 'compact' 
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold ring-2 ring-emerald-500/20' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'"
                  class="p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between cursor-pointer">
                  <div class="font-bold flex items-center justify-between">
                    <span>Compact</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">Barcode</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">50 × 25 mm</div>
                </button>

                <button type="button" 
                  (click)="setTemplate('qr')"
                  [ngClass]="selectedTemplate === 'qr' 
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-900 font-bold ring-2 ring-emerald-500/20' 
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'"
                  class="p-2.5 rounded-xl border text-left transition-all text-xs flex flex-col justify-between cursor-pointer">
                  <div class="font-bold flex items-center justify-between">
                    <span>QR Sticker</span>
                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">Square</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">35 × 35 mm</div>
                </button>
              </div>
            </div>

            <!-- Live Label Preview Card -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Preview</span>
                <span class="text-[10px] text-slate-400 font-medium">300 DPI Scaled Print Area</span>
              </div>

              <!-- Preview Canvas Area -->
              <div class="bg-slate-100/90 rounded-2xl p-4 sm:p-6 flex items-center justify-center border border-slate-200/80 min-h-[170px]">
                
                <!-- STANDARD PREVIEW (70x38mm) -->
                <div *ngIf="selectedTemplate === 'standard'" 
                  class="bg-white border-2 border-slate-900 rounded-lg p-3 shadow-md w-full max-w-[340px] text-slate-900 select-none">
                  <div class="flex items-center justify-between border-b border-slate-200 pb-1 mb-1.5">
                    <span class="text-[9px] font-extrabold uppercase tracking-wider text-slate-900">{{ orgName }}</span>
                    <span *ngIf="showCategory && asset?.category?.name" class="text-[8px] font-bold uppercase bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                      {{ asset.category.name }}
                    </span>
                  </div>
                  <div class="text-xs font-black truncate text-slate-900 mb-1.5" [title]="asset?.name">{{ asset?.name }}</div>
                  <div class="flex items-center gap-3">
                    <div class="w-18 h-18 shrink-0 bg-white border border-slate-200 rounded p-1 flex items-center justify-center">
                      <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR" class="w-full h-full object-contain">
                      <div *ngIf="!qrDataUrl" class="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[8px] font-bold text-slate-400 uppercase tracking-wide">SERIAL NO.</div>
                      <div class="font-mono text-xs font-extrabold tracking-wider text-slate-900 truncate">{{ asset?.serialNumber || 'UNKNOWN' }}</div>
                      <div class="my-0.5 w-full">
                        <img *ngIf="barcodeDataUrl" [src]="barcodeDataUrl" alt="Barcode" class="w-full h-6 object-fill">
                      </div>
                      <div *ngIf="showLocation" class="text-[9px] font-semibold text-slate-600 truncate">
                        📍 {{ asset?.location?.name || 'Unspecified' }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- COMPACT PREVIEW (50x25mm) -->
                <div *ngIf="selectedTemplate === 'compact'" 
                  class="bg-white border-2 border-slate-900 rounded-md p-2 shadow-md w-full max-w-[280px] text-slate-900 select-none">
                  <div class="flex items-center justify-between border-b border-slate-200 pb-0.5 text-[8px] font-bold uppercase tracking-wider">
                    <span>{{ orgName }}</span>
                    <span *ngIf="showCategory && asset?.category?.name" class="text-slate-500">{{ asset.category.name }}</span>
                  </div>
                  <div class="text-[11px] font-extrabold truncate mt-0.5" [title]="asset?.name">{{ asset?.name }}</div>
                  <div class="my-1">
                    <img *ngIf="barcodeDataUrl" [src]="barcodeDataUrl" alt="Barcode" class="w-full h-5 object-fill">
                  </div>
                  <div class="flex items-center justify-between text-[9px]">
                    <span class="font-mono font-bold tracking-wide">{{ asset?.serialNumber || 'UNKNOWN' }}</span>
                    <span *ngIf="showLocation" class="text-slate-500 truncate max-w-[100px]">{{ asset?.location?.name }}</span>
                  </div>
                </div>

                <!-- SQUARE QR PREVIEW (35x35mm) -->
                <div *ngIf="selectedTemplate === 'qr'" 
                  class="bg-white border-2 border-slate-900 rounded-md p-2.5 shadow-md w-[180px] text-slate-900 text-center select-none flex flex-col items-center">
                  <div class="text-[7.5px] font-extrabold uppercase tracking-wider mb-1">{{ orgName }}</div>
                  <div class="w-20 h-20 bg-white p-0.5 flex items-center justify-center">
                    <img *ngIf="qrDataUrl" [src]="qrDataUrl" alt="QR" class="w-full h-full object-contain">
                  </div>
                  <div class="font-mono text-[10px] font-extrabold tracking-wider mt-1 truncate w-full">{{ asset?.serialNumber }}</div>
                  <div class="text-[8px] text-slate-500 truncate w-full">{{ asset?.name }}</div>
                </div>

              </div>
            </div>

            <!-- Customization Options -->
            <div class="flex items-center gap-4 text-xs text-slate-600 pt-1">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="showLocation" class="rounded text-emerald-600 focus:ring-emerald-500">
                <span class="font-medium">Show Location</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" [(ngModel)]="showCategory" class="rounded text-emerald-600 focus:ring-emerald-500">
                <span class="font-medium">Show Category</span>
              </label>
            </div>

          </div>

          <!-- Footer Actions -->
          <div class="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <button type="button" (click)="onClose()" 
              class="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all">
              Cancel
            </button>
            <div class="flex items-center gap-2">
              <button type="button" 
                (click)="onDownloadPng()"
                [disabled]="generating"
                class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                <lucide-icon name="download" [size]="14"></lucide-icon>
                <span>Save PNG</span>
              </button>
              <button type="button" 
                (click)="onPrint()"
                [disabled]="generating"
                class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                <lucide-icon name="printer" [size]="14"></lucide-icon>
                <span>Print Label</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class AssetLabelModalComponent implements OnChanges {
  @Input() show = false;
  @Input() asset: any = null;
  @Output() close = new EventEmitter<void>();

  private labelService = inject(AssetLabelService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  selectedTemplate: LabelTemplate = 'standard';
  qrDataUrl = '';
  barcodeDataUrl = '';
  orgName = 'IT ASSET MANAGEMENT';
  showLocation = true;
  showCategory = true;
  generating = false;

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['asset'] || changes['show']) && this.show && this.asset) {
      this.generateCodes();
    }
  }

  setTemplate(tpl: LabelTemplate): void {
    this.selectedTemplate = tpl;
    this.cdr.markForCheck();
  }

  async generateCodes(): Promise<void> {
    if (!this.asset) return;
    this.generating = true;
    this.cdr.markForCheck();

    const serial = this.asset.serialNumber || 'UNKNOWN';
    // Barcode uses serial
    this.barcodeDataUrl = this.labelService.generateBarcodeDataUrl(serial);
    // QR Code uses serial or deep URL
    this.qrDataUrl = await this.labelService.generateQrDataUrl(serial);

    this.generating = false;
    this.cdr.markForCheck();
  }

  getLabelData(): LabelData {
    return {
      name: this.asset?.name || 'Unnamed Asset',
      serialNumber: this.asset?.serialNumber || 'UNKNOWN',
      categoryName: this.asset?.category?.name || '',
      locationName: this.asset?.location?.name || '',
      assignedUserName: this.asset?.assignedUser?.name || '',
      orgName: this.orgName,
      showLocation: this.showLocation,
      showCategory: this.showCategory
    };
  }

  onPrint(): void {
    if (!this.asset) return;
    try {
      this.labelService.printLabel(
        this.getLabelData(),
        this.selectedTemplate,
        this.qrDataUrl,
        this.barcodeDataUrl
      );
      this.toastr.success('Print dialog opened', '', { timeOut: 2000 });
    } catch (e) {
      console.error('Print error:', e);
      this.toastr.error('Failed to open print dialog');
    }
  }

  async onDownloadPng(): Promise<void> {
    if (!this.asset) return;
    try {
      await this.labelService.downloadLabelPng(
        this.getLabelData(),
        this.selectedTemplate,
        this.qrDataUrl,
        this.barcodeDataUrl
      );
      this.toastr.success('Label image downloaded');
    } catch (e) {
      console.error('Download error:', e);
      this.toastr.error('Failed to download label image');
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
