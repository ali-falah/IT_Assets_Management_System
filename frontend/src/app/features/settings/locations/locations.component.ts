import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Location, MasterDataService } from '../../../core/services/master-data.service';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, DataTableComponent, ConfirmationModalComponent],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationsComponent implements OnInit {
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('actionsTemplate', { static: true }) actionsTemplate!: TemplateRef<any>;

  locations: Location[] = [];
  loading = false;
  
  addingLoc = false;
  newLoc: Partial<Location> = { name: '', address: '' };
  
  editingLoc: string | null = null;
  editLocData: Partial<Location> = {};

  showConfirmDelete = false;
  locationToDelete: Location | null = null;

  columns: TableColumn[] = [
    { key: 'name', label: 'Location Name', template: null },
    { key: 'address', label: 'Address', template: null }
  ];

  ngOnInit() {
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

  saveNewLocation() {
    if (!this.newLoc.name?.trim()) return;
    this.masterDataService.createLocation(this.newLoc).subscribe({
      next: () => {
        this.toastr.success('Location created');
        this.addingLoc = false;
        this.newLoc = { name: '', address: '' };
        this.loadLocations();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to create location');
        this.cdr.detectChanges();
      }
    });
  }

  startEditLocation(loc: Location) {
    this.editingLoc = loc.id;
    this.editLocData = { name: loc.name, address: loc.address };
  }

  saveLocation() {
    if (!this.editingLoc || !this.editLocData.name?.trim()) return;
    this.masterDataService.updateLocation(this.editingLoc, this.editLocData).subscribe({
      next: () => {
        this.toastr.success('Location updated');
        this.editingLoc = null;
        this.loadLocations();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to update location');
        this.cdr.detectChanges();
      }
    });
  }

  deleteLocation(loc: Location) {
    this.locationToDelete = loc;
    this.showConfirmDelete = true;
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
