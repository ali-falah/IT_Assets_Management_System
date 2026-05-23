import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { map } from 'rxjs';
import { Asset, AssetService } from '../../core/services/asset.service';
import { Location, MasterDataService, Status } from '../../core/services/master-data.service';
import { OfflineManagerService } from '../../core/services/offline-manager.service';
import { UserService } from '../../core/services/user.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationModalComponent } from '../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, ZXingScannerModule, SearchableSelectComponent, ConfirmationModalComponent, FormsModule, ReactiveFormsModule],
  templateUrl: './scanner.component.html',
  styleUrls: ['./scanner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannerComponent implements OnInit, OnDestroy {
  private assetService = inject(AssetService);
  private userService = inject(UserService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private offlineManager = inject(OfflineManagerService);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  isOffline$ = this.offlineManager.getOnlineStatus().pipe(map(online => !online));

  hasPermission = false;
  cameras: MediaDeviceInfo[] = [];
  currentDevice: MediaDeviceInfo | undefined = undefined;
  scannerEnabled = true;

  statuses: Status[] = [];
  availableStatusId: string | null = null;
  assignedStatusId: string | null = null;

  locations: any[] = [];
  selectedLocationId: string | null = null;
  selectedStatusId: string | null = null;

  showLaptopWarningModal = false;
  laptopWarningMessage = '';
  pendingSavePayload: any = null;

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

  videoConstraints: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'environment'
  };

  zoomLevel = 1;
  minZoom = 1;
  maxZoom = 5;
  zoomSupported = false;
  videoTrack: MediaStreamTrack | null = null;

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
    this.loadLocations();
  }

  ngOnDestroy() {}

  loadLocations() {
    this.masterDataService.getLocations().subscribe(res => {
      this.locations = res.map((l: any) => ({
        id: l.id,
        name: l.name
      }));
    });
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

    this.isScanningPaused = true;
    this.searchAsset(resultString);
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
            this.selectedEmployeeId = asset.assignedUserId || null;
            this.selectedLocationId = asset.locationId || null;
            this.selectedStatusId = asset.statusId || null;
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
            this.isScanningPaused = true;
          }
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Error searching for asset');
        this.loading = false;
        if (this.batchMode) {
          this.resumeScanning();
        } else {
          this.isScanningPaused = false;
        }
        this.cdr.detectChanges();
      }
    });
  }

  private resumeScanning() {
    setTimeout(() => {
      this.isScanningPaused = false;
      this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Bulk assignment failed');
        this.isActionLoading = false;
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Bulk return failed');
        this.isActionLoading = false;
        this.cdr.detectChanges();
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
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Bulk update failed');
        this.isActionLoading = false;
        this.cdr.detectChanges();
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
    setTimeout(() => this.checkZoomCapabilities(), 2000);
  }

  onDeviceChange(device: MediaDeviceInfo) {
    this.currentDevice = device;
    this.zoomSupported = false;
    setTimeout(() => this.checkZoomCapabilities(), 2000);
  }

  private checkZoomCapabilities() {
    const videoElement = document.querySelector('zxing-scanner video') as HTMLVideoElement;
    if (!videoElement || !videoElement.srcObject) return;

    const stream = videoElement.srcObject as MediaStream;
    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      this.videoTrack = tracks[0];
      const capabilities = this.videoTrack.getCapabilities() as any;
      if (capabilities && capabilities.zoom) {
        this.zoomSupported = true;
        this.minZoom = capabilities.zoom.min;
        this.maxZoom = capabilities.zoom.max;
        this.zoomLevel = (this.videoTrack.getSettings() as any).zoom || this.minZoom;
      }
    }
  }

  onZoomChange(event: any) {
    const value = parseFloat(event.target.value);
    this.zoomLevel = value;
    if (this.videoTrack) {
      try {
        const constraints: any = {
          advanced: [{ zoom: value }]
        };

        const capabilities = this.videoTrack.getCapabilities() as any;
        if (capabilities.imageStabilizationMode) {
          constraints.advanced.push({ imageStabilizationMode: 'cinematic' });
        }

        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          constraints.advanced.push({ focusMode: 'continuous' });
        }

        this.videoTrack.applyConstraints(constraints);
      } catch (e) {
        console.error('Failed to apply constraints:', e);
      }
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
    this.selectedLocationId = null;
    this.selectedStatusId = null;
    this.scannerEnabled = true;
    this.isScanningPaused = false;
    this.lastScannedCode = null;
    this.cdr.detectChanges();
  }

  saveScannedAssetChanges() {
    if (!this.scannedAsset) return;

    const payload = {
      assignedUserId: this.selectedEmployeeId,
      locationId: this.selectedLocationId,
      statusId: this.selectedStatusId
    };

    const catName = this.scannedAsset.category?.name?.toLowerCase() || '';
    const isLaptop = catName === 'laptop' || catName === 'laptops' || catName.includes('laptop');
    const newUserId = this.selectedEmployeeId;
    const oldUserId = this.scannedAsset.assignedUserId;
    const oldUserName = this.scannedAsset.assignedUser?.name || 'Unassigned';
    const newUserName = this.employees.find(u => u.id === newUserId)?.name || 'Unassigned';

    if (isLaptop && oldUserId && newUserId && newUserId !== oldUserId) {
      this.isActionLoading = true;
      this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            this.isActionLoading = false;
            const existingLaptop = res.data.find((a: any) => 
              a.id !== this.scannedAsset!.id && 
              (a.category?.name?.toLowerCase() === 'laptop' || 
               a.category?.name?.toLowerCase() === 'laptops' || 
               a.category?.name?.toLowerCase().includes('laptop'))
            );
            if (existingLaptop) {
              this.toastr.error(
                `This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring. Additionally, ${newUserName} already has a laptop assigned with serial ${existingLaptop.serialNumber || 'N/A'}.`,
                'Transfer Blocked',
                { timeOut: 8000 }
              );
            } else {
              this.toastr.error(
                `This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring.`,
                'Transfer Blocked',
                { timeOut: 6000 }
              );
            }
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.isActionLoading = false;
            this.toastr.error(`This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring.`);
            this.cdr.detectChanges();
          });
        }
      });
      return;
    }

    if (isLaptop && newUserId && !oldUserId) {
      this.isActionLoading = true;
      this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            this.isActionLoading = false;
            const existingLaptop = res.data.find((a: any) => 
              a.id !== this.scannedAsset!.id && 
              (a.category?.name?.toLowerCase() === 'laptop' || 
               a.category?.name?.toLowerCase() === 'laptops' || 
               a.category?.name?.toLowerCase().includes('laptop'))
            );
            if (existingLaptop) {
              this.pendingSavePayload = payload;
              this.laptopWarningMessage = `This employee already has a laptop assigned (Serial: ${existingLaptop.serialNumber || 'N/A'}). Do you want to proceed?`;
              this.showLaptopWarningModal = true;
              this.cdr.detectChanges();
            } else {
              this.executeSaveScannedAssetChanges(payload);
            }
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.isActionLoading = false;
            this.executeSaveScannedAssetChanges(payload);
          });
        }
      });
      return;
    }

    this.executeSaveScannedAssetChanges(payload);
  }

  private executeSaveScannedAssetChanges(payload: any) {
    if (!this.scannedAsset) return;
    this.isActionLoading = true;
    this.assetService.updateAsset(this.scannedAsset.id, payload).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.toastr.success('Asset updated successfully');
          this.reloadAsset();
        });
      },
      error: (err: any) => {
        this.ngZone.run(() => {
          this.toastr.error(err.error?.message || 'Failed to update asset');
          this.isActionLoading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  confirmLaptopAssignment() {
    this.showLaptopWarningModal = false;
    this.cdr.detectChanges();
    if (this.pendingSavePayload) {
      this.executeSaveScannedAssetChanges(this.pendingSavePayload);
      this.pendingSavePayload = null;
    }
  }

  cancelLaptopAssignment() {
    this.showLaptopWarningModal = false;
    this.cdr.detectChanges();
    this.pendingSavePayload = null;
    this.toastr.info('Assignment cancelled');
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
    this.assetService.getAsset(this.scannedAsset.id).subscribe({
      next: (asset) => {
        this.scannedAsset = asset;
        this.selectedEmployeeId = null;
        this.isActionLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        console.warn('Could not reload asset after action, using existing local data.');
        this.isActionLoading = false;
        this.cdr.detectChanges();
      }
    });
  }
}
