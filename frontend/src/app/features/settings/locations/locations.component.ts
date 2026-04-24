import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Plus, Edit2, Trash2, Check, X, MapPin } from 'lucide-angular';
import { MasterDataService, Location } from '../../../core/services/master-data.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  templateUrl: './locations.component.html',
  styleUrls: ['./locations.component.css']
})
export class LocationsComponent implements OnInit {
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);

  locations: Location[] = [];
  
  addingLoc = false;
  newLoc: Partial<Location> = { name: '', address: '' };
  
  editingLoc: string | null = null;
  editLocData: Partial<Location> = {};

  showConfirmDelete = false;
  locationToDelete: Location | null = null;

  ngOnInit() {
    this.loadLocations();
  }

  loadLocations() {
    this.masterDataService.getLocations().subscribe(res => this.locations = res);
  }

  saveNewLocation() {
    if (!this.newLoc.name?.trim()) return;
    this.masterDataService.createLocation(this.newLoc).subscribe({
      next: () => {
        this.toastr.success('Location created');
        this.addingLoc = false;
        this.newLoc = { name: '', address: '' };
        this.loadLocations();
      },
      error: () => this.toastr.error('Failed to create location')
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
      },
      error: () => this.toastr.error('Failed to update location')
    });
  }

  deleteLocation(loc: Location) {
    this.locationToDelete = loc;
    this.showConfirmDelete = true;
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.locationToDelete = null;
  }

  executeDelete() {
    if (!this.locationToDelete) return;
    
    this.masterDataService.deleteLocation(this.locationToDelete.id).subscribe({
      next: () => {
        this.toastr.success('Location deleted successfully');
        this.loadLocations();
        this.showConfirmDelete = false;
        this.locationToDelete = null;
      },
      error: () => {
        this.toastr.error('Failed to delete location. It might be in use by assets.');
        this.showConfirmDelete = false;
      }
    });
  }
}
