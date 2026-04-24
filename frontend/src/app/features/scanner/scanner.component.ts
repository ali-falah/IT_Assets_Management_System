import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, TriangleAlert, CheckCircle, Package, Scan, Trash2, X, Plus } from 'lucide-angular';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { AssetService, Asset } from '../../core/services/asset.service';
import { UserService } from '../../core/services/user.service';
import { MasterDataService, Status } from '../../core/services/master-data.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ZXingScannerModule, SearchableSelectComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css']
})
export class ScannerComponent implements OnInit {
  private assetService = inject(AssetService);
  private userService = inject(UserService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private router = inject(Router);

  hasPermission = false;
  cameras: MediaDeviceInfo[] = [];
  currentDevice: MediaDeviceInfo | undefined = undefined;
  scannerEnabled = true;

  statuses: Status[] = [];
  availableStatusId: string | null = null;
  assignedStatusId: string | null = null;

  formatsEnabled: BarcodeFormat[] = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.CODABAR,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX
  ];

  torchEnabled = false;
  torchAvailable = false;
  scannedAsset: Asset | null = null;
  notFoundCode: string | null = null;
  loading = false;
  lastScannedCode: string | null = null;
  lastScannedTime: number = 0;

  batchMode = false;
  batchAssets: Asset[] = [];
  isScanningPaused = false;
  scanFlash: 'success' | 'error' | null = null;

  employees: any[] = [];
  selectedEmployeeId: string | null = null;
  isActionLoading = false;

  private audioCtx: AudioContext | null = null;

  get filteredEmployees() {
    if (!this.scannedAsset?.assignedUserId) return this.employees;
    return this.employees.filter(e => e.id !== this.scannedAsset?.assignedUserId);
  }

  ngOnInit() {
    this.loadEmployees();
    this.loadStatuses();
  }

  loadEmployees() {
    this.userService.getUsers().subscribe(users => {
      this.employees = users
        .filter((u: any) => u.role?.name === 'employee' || u.role === 'employee')
        .map((u: any) => ({
          id: u.id,
          name: u.name
        }));
    });
  }

  loadStatuses() {
    this.masterDataService.getStatuses().subscribe(res => {
      this.statuses = res;
      this.availableStatusId = res.find(s => s.slug === 'available' || s.slug === 'stock' || s.name.toLowerCase().includes('available') || s.name.toLowerCase().includes('stock'))?.id || null;
      this.assignedStatusId = res.find(s => s.slug === 'assigned' || s.slug === 'in-use' || s.name.toLowerCase().includes('assigned'))?.id || null;
    });
  }

  toggleScanner() {
    this.scannerEnabled = !this.scannerEnabled;
    if (this.scannerEnabled) {
      this.isScanningPaused = false;
    }
  }

  toggleBatchMode() {
    this.batchMode = !this.batchMode;
    this.resetScanner();
    this.toastr.info(this.batchMode ? 'Batch Mode Enabled' : 'Single Scan Mode Enabled');
  }

  onCodeResult(resultString: string) {
    if (this.isScanningPaused) return;

    const now = Date.now();
    if (resultString === this.lastScannedCode && now - this.lastScannedTime < 2000) return;

    this.lastScannedCode = resultString;
    this.lastScannedTime = now;
    
    if (this.batchMode) {
      this.isScanningPaused = true;
      this.searchAsset(resultString);
    } else {
      this.scannerEnabled = false;
      this.searchAsset(resultString);
    }
  }

  searchAsset(term: string) {
    this.loading = !this.batchMode;
    const normalizedTerm = term.trim().toUpperCase();
    this.assetService.getAssets({ search: normalizedTerm }).subscribe({
      next: (res) => {
        if (res.data.length > 0) {
          const asset = res.data[0];
          this.playBeep('success');
          this.triggerFlash('success');
          this.triggerHaptic('success');

          if (this.batchMode) {
            const exists = this.batchAssets.some(a => a.id === asset.id);
            if (!exists) {
              this.batchAssets.unshift(asset);
              this.toastr.success(`Added: ${asset.name}`);
            } else {
              this.toastr.warning('Asset already in batch');
            }
            this.resumeScanning();
          } else {
            this.scannedAsset = asset;
          }
        } else {
          this.playBeep('error');
          this.triggerFlash('error');
          this.triggerHaptic('error');
          if (this.batchMode) {
            this.toastr.error(`Not found: ${normalizedTerm}`);
            this.resumeScanning();
          } else {
            this.notFoundCode = normalizedTerm;
            this.scannerEnabled = false;
          }
        }
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Error searching for asset');
        this.loading = false;
        if (this.batchMode) {
          this.resumeScanning();
        } else {
          this.scannerEnabled = true;
        }
      }
    });
  }

  private resumeScanning() {
    setTimeout(() => {
      this.isScanningPaused = false;
    }, 2000);
  }

  private triggerFlash(type: 'success' | 'error') {
    this.scanFlash = type;
    setTimeout(() => {
      this.scanFlash = null;
    }, 500);
  }

  private playBeep(type: 'success' | 'error') {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, this.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  }

  private triggerHaptic(type: 'success' | 'error') {
    if ('vibrate' in navigator) {
      if (type === 'success') {
        navigator.vibrate(100);
      } else {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }

  removeFromBatch(index: number) {
    this.batchAssets.splice(index, 1);
  }

  clearBatch() {
    this.batchAssets = [];
  }

  bulkAssign() {
    if (!this.selectedEmployeeId || this.batchAssets.length === 0 || !this.assignedStatusId) return;
    this.isActionLoading = true;
    const ids = this.batchAssets.map(a => a.id);
    this.assetService.bulkUpdateAssets(ids, {
      assignedUserId: this.selectedEmployeeId,
      statusId: this.assignedStatusId || undefined
    }).subscribe({
      next: () => {
        this.toastr.success(`Assigned ${ids.length} assets successfully`);
        this.clearBatch();
        this.isActionLoading = false;
      },
      error: () => {
        this.toastr.error('Bulk assignment failed');
        this.isActionLoading = false;
      }
    });
  }

  bulkReturn() {
    if (this.batchAssets.length === 0 || !this.availableStatusId) return;
    this.isActionLoading = true;
    const ids = this.batchAssets.map(a => a.id);
    this.assetService.bulkUpdateAssets(ids, {
      assignedUserId: null,
      statusId: this.availableStatusId || undefined
    }).subscribe({
      next: () => {
        this.toastr.success(`Returned ${ids.length} assets to stock`);
        this.clearBatch();
        this.isActionLoading = false;
      },
      error: () => {
        this.toastr.error('Bulk return failed');
        this.isActionLoading = false;
      }
    });
  }

  bulkMaintenance() {
    if (this.batchAssets.length === 0) return;
    const maintenanceStatusId = this.statuses.find(s => s.name.toLowerCase().includes('maintenance'))?.id;
    if (!maintenanceStatusId) return;

    this.isActionLoading = true;
    const ids = this.batchAssets.map(a => a.id);
    this.assetService.bulkUpdateAssets(ids, {
      statusId: maintenanceStatusId,
      assignedUserId: null
    }).subscribe({
      next: () => {
        this.toastr.success(`Marked ${ids.length} assets for maintenance`);
        this.clearBatch();
        this.isActionLoading = false;
      },
      error: () => {
        this.toastr.error('Bulk update failed');
        this.isActionLoading = false;
      }
    });
  }

  onTorchCompatible(event: boolean) {
    this.torchAvailable = event;
  }

  toggleTorch() {
    this.torchEnabled = !this.torchEnabled;
  }

  onPermissionResponse(result: boolean) {
    this.hasPermission = result;
  }

  requestPermission() {
    this.hasPermission = true;
    this.scannerEnabled = true;
  }

  onCamerasFound(devices: MediaDeviceInfo[]) {
    this.cameras = devices;
    if (devices && devices.length > 0 && !this.currentDevice) {
      const backCamera = devices.find(d => /back|rear|environment/i.test(d.label));
      this.currentDevice = backCamera || devices[0];
    }
  }

  switchCamera() {
    if (this.cameras.length > 1) {
      const currentIndex = this.currentDevice ? this.cameras.indexOf(this.currentDevice) : 0;
      const nextIndex = (currentIndex + 1) % this.cameras.length;
      this.currentDevice = this.cameras[nextIndex];
    }
  }

  onScanError(error: any) {
    console.warn('Scanner error:', error);
  }

  manualSearch(term: string) {
    if (!term.trim()) return;
    this.searchAsset(term.trim());
  }

  resetScanner() {
    this.scannedAsset = null;
    this.notFoundCode = null;
    this.selectedEmployeeId = null;
    this.scannerEnabled = true;
    this.isScanningPaused = false;
  }

  async quickAssign() {
    if (!this.scannedAsset || !this.selectedEmployeeId || !this.assignedStatusId) return;
    this.isActionLoading = true;
    this.assetService.updateAsset(this.scannedAsset.id, {
      assignedUserId: this.selectedEmployeeId,
      statusId: this.assignedStatusId || undefined
    }).subscribe({
      next: () => {
        this.toastr.success('Asset assigned successfully');
        this.reloadAsset();
      },
      error: () => {
        this.toastr.error('Assignment failed');
        this.isActionLoading = false;
      }
    });
  }

  quickUnassign() {
    if (!this.scannedAsset || !this.availableStatusId) return;
    this.isActionLoading = true;
    this.assetService.updateAsset(this.scannedAsset.id, {
      assignedUserId: null,
      statusId: this.availableStatusId || undefined
    }).subscribe({
      next: () => {
        this.toastr.success('Assignment removed');
        this.reloadAsset();
      },
      error: () => {
        this.toastr.error('Failed to remove assignment');
        this.isActionLoading = false;
      }
    });
  }

  async quickTransfer() {
    this.quickAssign();
  }

  markMaintenance() {
    this.bulkMaintenance();
  }

  goToEdit() {
    if (this.scannedAsset) {
      this.router.navigate(['/assets', this.scannedAsset.id, 'edit']);
    }
  }

  private reloadAsset() {
    if (!this.scannedAsset) return;
    this.assetService.getAsset(this.scannedAsset.id).subscribe(asset => {
      this.scannedAsset = asset;
      this.selectedEmployeeId = null;
      this.isActionLoading = false;
    });
  }
}