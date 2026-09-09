import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Location, MasterDataService } from '../../../core/services/master-data.service';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../../shared/directives/page-header-actions.directive';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    LucideAngularModule, 
    DataTableComponent, 
    ConfirmationModalComponent, 
    PageHeaderActionsDirective, 
    DialogComponent
  ],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsComponent implements OnInit {
  private pageHeaderService = inject(PageHeaderService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('actionsTemplate', { static: true }) actionsTemplate!: TemplateRef<any>;

  locations: Location[] = [];
  loading = false;
  
  showLocationModal = false;
  selectedLocation: Location | null = null;
  locationName = '';
  locationAddress = '';
  savingLocation = false;

  showConfirmDelete = false;
  locationToDelete: Location | null = null;

  columns: TableColumn[] = [
    { key: 'name', label: 'Location Name', template: null },
    { key: 'address', label: 'Address', template: null }
  ];

  ngOnInit() {
    this.pageHeaderService.setHeader({
      title: 'Locations',
      subtitle: 'Define physical locations and addresses',
      backUrl: '/settings'
    });
    this.loadLocations();
  }

  loadLocations() {
    this.loading = true;
    this.cdr.markForCheck();
    this.masterDataService.getLocations().subscribe({
      next: (res) => {
        this.locations = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load locations');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startAddLocation() {
    this.selectedLocation = null;
    this.locationName = '';
    this.locationAddress = '';
    this.showLocationModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  startEditLocation(loc: Location) {
    this.selectedLocation = loc;
    this.locationName = loc.name || '';
    this.locationAddress = loc.address || '';
    this.showLocationModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  closeLocationModal() {
    this.showLocationModal = false;
    this.selectedLocation = null;
    this.locationName = '';
    this.locationAddress = '';
    this.savingLocation = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  saveLocation() {
    if (!this.locationName.trim() || this.savingLocation) return;
    this.savingLocation = true;
    this.cdr.markForCheck();

    const payload = {
      name: this.locationName.trim(),
      address: this.locationAddress.trim() || undefined
    };

    if (this.selectedLocation) {
      this.masterDataService.updateLocation(this.selectedLocation.id, payload).subscribe({
        next: () => {
          this.toastr.success('Location updated successfully');
          this.savingLocation = false;
          this.closeLocationModal();
          this.loadLocations();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to update location');
          this.savingLocation = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.masterDataService.createLocation(payload).subscribe({
        next: () => {
          this.toastr.success('Location created successfully');
          this.savingLocation = false;
          this.closeLocationModal();
          this.loadLocations();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to create location');
          this.savingLocation = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  deleteLocation(loc: Location) {
    this.locationToDelete = loc;
    this.showConfirmDelete = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.locationToDelete = null;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.locationToDelete) return;
    
    this.masterDataService.deleteLocation(this.locationToDelete.id).subscribe({
      next: () => {
        this.toastr.success('Location deleted successfully');
        this.loadLocations();
        this.showConfirmDelete = false;
        this.locationToDelete = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to delete location. It might be in use by assets.');
        this.showConfirmDelete = false;
        this.cdr.detectChanges();
      }
    });
  }
}
