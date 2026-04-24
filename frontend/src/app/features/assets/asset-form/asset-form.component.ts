import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Location as AngularLocation } from '@angular/common';
import { LucideAngularModule, ArrowLeft, Image as ImageIcon, X, Save, Loader, History, User as UserIcon, Clock, Calendar } from 'lucide-angular';
import { AssetService } from '../../../core/services/asset.service';
import { MasterDataService, Category, Location, Status } from '../../../core/services/master-data.service';
import { UserService, User } from '../../../core/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select/searchable-select.component';

@Component({
  selector: 'app-asset-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, LucideAngularModule, SearchableSelectComponent],
  templateUrl: './asset-form.component.html',
  styleUrls: ['./asset-form.component.css']
})
export class AssetFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(AngularLocation);
  private assetService = inject(AssetService);
  private masterDataService = inject(MasterDataService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private http = inject(HttpClient);

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

  ngOnInit() {
    this.initForm();
    this.loadMasterData();

    this.assetId = this.route.snapshot.paramMap.get('id');
    if (this.assetId) {
      this.isEditMode = true;
      this.loadAssetData(this.assetId);
    } else {
      const serial = this.route.snapshot.queryParamMap.get('serialNumber');
      if (serial) {
        this.assetForm.patchValue({ serialNumber: serial.toUpperCase() });
      }
    }
  }
  
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
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imageUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
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

  async onSubmit() {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const formValue = { ...this.assetForm.getRawValue() };
    if (formValue.serialNumber) {
      formValue.serialNumber = formValue.serialNumber.trim().toUpperCase();
    }

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
      this.router.navigate(['/assets']);
    } catch (error) {
      this.toastr.error(this.isEditMode ? 'Failed to update asset' : 'Failed to create asset');
    } finally {
      this.loading = false;
    }
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
