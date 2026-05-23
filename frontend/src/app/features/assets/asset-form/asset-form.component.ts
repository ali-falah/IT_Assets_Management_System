import { Location as AngularLocation, CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AssetService } from '../../../core/services/asset.service';
import { Category, Location, MasterDataService, Status } from '../../../core/services/master-data.service';
import { User, UserService } from '../../../core/services/user.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';

const DRAFT_KEY = 'asset_form_draft';

@Component({
  selector: 'app-asset-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LucideAngularModule, SearchableSelectComponent, ConfirmationModalComponent],
  templateUrl: './asset-form.component.html',
  styleUrls: ['./asset-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(AngularLocation);
  private assetService = inject(AssetService);
  private masterDataService = inject(MasterDataService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  assetForm!: FormGroup;
  isEditMode = false;
  assetId: string | null = null;
  loading = false;
  
  categories: Category[] = [];
  locations: Location[] = [];
  statuses: Status[] = [];
  users: User[] = [];
  
  selectedFile: File | null = null;
  imageUrl: string | null = null;
  fullAsset: any | null = null;
  showLaptopWarningModal = false;
  pendingSubmission: any = null;
  laptopWarningMessage = 'This employee already has a laptop assigned. Do you want to proceed?';

  // Draft auto-save
  draftInfo: { savedAt: Date; data: any } | null = null;
  showDraftBanner = false;
  private formSub?: Subscription;

  // Drag & Drop
  isDragging = false;

  ngOnInit() {
    this.initForm();
    this.loadMasterData();

    this.assetId = this.route.snapshot.paramMap.get('id');
    if (this.assetId) {
      this.isEditMode = true;
      this.loadAssetData(this.assetId);
    } else {
      // Check for clone data from navigation state (history.state persists after nav)
      const cloneData = history.state?.['cloneData'];
      if (cloneData) {
        this.assetForm.patchValue({
          name: cloneData.name ? `${cloneData.name} (Copy)` : '',
          categoryId: cloneData.categoryId || '',
          statusId: cloneData.statusId || '',
          locationId: cloneData.locationId || '',
          notes: cloneData.notes || ''
          // intentionally exclude serialNumber — must be unique
        });
        this.imageUrl = cloneData.imageUrl || null;
        this.clearDraft(); // don't restore old draft when cloning
      } else {
        const serial = this.route.snapshot.queryParamMap.get('serialNumber');
        if (serial) {
          this.assetForm.patchValue({ serialNumber: serial.toUpperCase() });
        }
        // Check for saved draft
        this.checkForDraft();
      }

      // Auto-save draft on form changes (new mode only)
      this.formSub = this.assetForm.valueChanges.pipe(debounceTime(1500)).subscribe(() => {
        if (!this.isEditMode) this.saveDraft();
      });
    }
  }

  ngOnDestroy() {
    this.formSub?.unsubscribe();
  }

  // ── Draft Management ──────────────────────────────────────────────

  private checkForDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.data && parsed?.savedAt) {
        this.draftInfo = { savedAt: new Date(parsed.savedAt), data: parsed.data };
        this.showDraftBanner = true;
      }
    } catch { /* ignore */ }
  }

  restoreDraft() {
    if (!this.draftInfo) return;
    this.assetForm.patchValue(this.draftInfo.data);
    this.showDraftBanner = false;
  }

  discardDraft() {
    this.clearDraft();
    this.showDraftBanner = false;
    this.draftInfo = null;
  }

  private saveDraft() {
    try {
      const data = { data: this.assetForm.value, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  private clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  // ── Drag & Drop ───────────────────────────────────────────────────

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this.processFile(file);
    } else if (file) {
      this.toastr.warning('Only image files are supported for asset photos');
    }
  }

  private processFile(file: File) {
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => { this.imageUrl = reader.result as string; };
    reader.readAsDataURL(file);
  }

  // ── Standard Methods ──────────────────────────────────────────────

  goBack() {
    this.location.back();
  }

  initForm() {
    this.assetForm = this.fb.group({
      name: ['', Validators.required],
      serialNumber: ['', Validators.required],
      categoryId: ['', Validators.required],
      statusId: ['', Validators.required],
      locationId: ['', Validators.required],
      assignedUserId: [null],
      notes: ['']
    });
  }

  loadMasterData() {
    this.masterDataService.getCategories().subscribe(res => this.categories = res);
    this.masterDataService.getLocations().subscribe(res => this.locations = res);
    this.masterDataService.getStatuses().subscribe(res => {
      this.statuses = res;
      if (!this.isEditMode && this.statuses.length > 0) {
        this.assetForm.patchValue({ statusId: this.statuses[0].id });
      }
    });
    this.userService.getUsers().subscribe(res => this.users = res);
  }

  loadAssetData(id: string) {
    this.assetService.getAsset(id).subscribe({
      next: (asset) => {
        this.fullAsset = asset;
        this.assetForm.patchValue({
          name: asset.name,
          serialNumber: asset.serialNumber,
          categoryId: asset.categoryId,
          statusId: asset.status?.id || asset.statusId,
          locationId: asset.locationId,
          assignedUserId: asset.assignedUserId || null,
          notes: asset.notes
        });
        if (asset.assignedUserId) {
          this.assetForm.get('statusId')?.disable();
        } else {
          this.assetForm.get('statusId')?.enable();
        }
        
        if (asset.imageUrl) {
          this.imageUrl = asset.imageUrl;
        }
      },
      error: () => {
        this.toastr.error('Failed to load asset details');
        this.router.navigate(['/assets']);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.processFile(file);
  }

  removeImage() {
    this.selectedFile = null;
    this.imageUrl = null;
  }

  async uploadImage(): Promise<string | null> {
    if (!this.selectedFile) return null;
    
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('folder', 'assets');
    
    try {
      const response = await this.http.post<{url: string}>(`${environment.apiUrl}/files/upload`, formData).toPromise();
      return response?.url || null;
    } catch (error) {
      this.toastr.error('Image upload failed');
      return null;
    }
  }

  /** Navigate to /assets/new pre-filled with current asset's data (minus serial) */
  duplicateAsset() {
    const raw = this.assetForm.getRawValue();
    this.router.navigate(['/assets/new'], {
      state: {
        cloneData: {
          name: raw.name,
          categoryId: raw.categoryId,
          statusId: raw.statusId,
          locationId: raw.locationId,
          notes: raw.notes,
          imageUrl: this.imageUrl
        }
      }
    });
  }

  async onSubmit() {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      return;
    }

    const formValue = { ...this.assetForm.getRawValue() };
    if (formValue.serialNumber) {
      formValue.serialNumber = formValue.serialNumber.trim().toUpperCase();
    }

    const category = this.categories.find(c => c.id === formValue.categoryId);
    const catName = category?.name?.toLowerCase() || '';
    const isLaptop = catName === 'laptop' || catName === 'laptops' || catName.includes('laptop');
    const newUserId = formValue.assignedUserId;
    const newUserName = this.users.find(u => u.id === newUserId)?.name || 'Unassigned';

    // Case A: Block direct transfer of an in-use laptop
    if (this.isEditMode && this.fullAsset) {
      const oldUserId = this.fullAsset.assignedUserId;
      const oldUserName = this.users.find(u => u.id === oldUserId)?.name || 'Unassigned';
      
      if (isLaptop && oldUserId && newUserId && newUserId !== oldUserId) {
        this.loading = true;
        this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
          next: (res: any) => {
            this.ngZone.run(() => {
              this.loading = false;
              const existingLaptop = res.data.find((a: any) => 
                a.id !== this.assetId && 
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
              this.loading = false;
              this.toastr.error(`This laptop is currently assigned to ${oldUserName} and must be returned to stock before transferring.`);
              this.cdr.detectChanges();
            });
          }
        });
        return;
      }
    }

    // Case B: Normal assignment flow (laptop is in stock / unassigned)
    if (isLaptop && newUserId) {
      this.loading = true;
      this.assetService.getAssets({ assignedUserId: newUserId }).subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            const existingLaptop = res.data.find((a: any) => 
              a.id !== this.assetId && 
              (a.category?.name?.toLowerCase() === 'laptop' || 
               a.category?.name?.toLowerCase() === 'laptops' || 
               a.category?.name?.toLowerCase().includes('laptop'))
            );
            if (existingLaptop) {
              this.pendingSubmission = formValue;
              this.laptopWarningMessage = `This employee already has a laptop assigned (Serial: ${existingLaptop.serialNumber || 'N/A'}). Do you want to proceed?`;
              this.showLaptopWarningModal = true;
              this.loading = false;
              this.cdr.detectChanges();
            } else {
              this.executeFormSubmit(formValue);
            }
          });
        },
        error: () => {
          this.ngZone.run(() => {
            this.executeFormSubmit(formValue);
          });
        }
      });
    } else {
      this.executeFormSubmit(formValue);
    }
  }

  async executeFormSubmit(formValue: any) {
    this.loading = true;
    try {
      if (this.selectedFile) {
        const uploadedUrl = await this.uploadImage();
        if (uploadedUrl) {
          formValue.imageUrl = uploadedUrl;
        }
      }

      if (this.isEditMode && this.assetId) {
        await this.assetService.updateAsset(this.assetId, formValue).toPromise();
        this.toastr.success('Asset updated successfully');
      } else {
        await this.assetService.createAsset(formValue).toPromise();
        this.toastr.success('Asset created successfully');
      }
      this.clearDraft();
      this.router.navigate(['/assets']);
    } catch (error) {
      this.toastr.error(this.isEditMode ? 'Failed to update asset' : 'Failed to create asset');
    } finally {
      this.loading = false;
    }
  }

  confirmLaptopAssignment() {
    this.showLaptopWarningModal = false;
    this.cdr.detectChanges();
    if (this.pendingSubmission) {
      this.executeFormSubmit(this.pendingSubmission);
      this.pendingSubmission = null;
    }
  }

  cancelLaptopAssignment() {
    this.showLaptopWarningModal = false;
    this.cdr.detectChanges();
    this.pendingSubmission = null;
    this.toastr.info('Assignment cancelled');
  }

  createNewCategory(name: string) {
    this.masterDataService.createCategory({ name }).subscribe({
      next: (category) => {
        this.categories = [...this.categories, category];
        this.assetForm.patchValue({ categoryId: category.id });
        this.toastr.success(`Category "${name}" created`);
      },
      error: () => this.toastr.error('Failed to create category')
    });
  }

  createNewLocation(name: string) {
    this.masterDataService.createLocation({ name }).subscribe({
      next: (location) => {
        this.locations = [...this.locations, location];
        this.assetForm.patchValue({ locationId: location.id });
        this.toastr.success(`Location "${name}" created`);
      },
      error: () => this.toastr.error('Failed to create location')
    });
  }
}
