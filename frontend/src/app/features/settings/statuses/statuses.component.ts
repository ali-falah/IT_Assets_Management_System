import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { MasterDataService, Status } from '../../../core/services/master-data.service';

interface ColorPreset {
  name: string;
  class: string;
  bgClass: string;
}

@Component({
  selector: 'app-statuses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  templateUrl: './statuses.component.html',
  styleUrls: ['./statuses.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusesComponent implements OnInit {
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  statuses: Status[] = [];
  
  addingStatus = false;
  newStatus: Partial<Status> = { name: '', colorClass: 'bg-slate-100 text-slate-700' };
  
  editingStatus: string | null = null;
  editStatusData: Partial<Status> = {};

  colorPresets: ColorPreset[] = [
    { name: 'Slate', class: 'bg-slate-100 text-slate-700', bgClass: 'bg-slate-500' },
    { name: 'Red', class: 'bg-red-100 text-red-700', bgClass: 'bg-red-500' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-700', bgClass: 'bg-orange-500' },
    { name: 'Amber', class: 'bg-amber-100 text-amber-700', bgClass: 'bg-amber-500' },
    { name: 'Green', class: 'bg-green-100 text-green-700', bgClass: 'bg-green-500' },
    { name: 'Emerald', class: 'bg-emerald-100 text-emerald-700', bgClass: 'bg-emerald-500' },
    { name: 'Teal', class: 'bg-teal-100 text-teal-700', bgClass: 'bg-teal-500' },
    { name: 'Cyan', class: 'bg-cyan-100 text-cyan-700', bgClass: 'bg-cyan-500' },
    { name: 'Blue', class: 'bg-blue-100 text-blue-700', bgClass: 'bg-blue-500' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-700', bgClass: 'bg-indigo-500' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-700', bgClass: 'bg-purple-500' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-700', bgClass: 'bg-pink-500' },
  ];

  ngOnInit() {
    this.loadStatuses();
  }

  loadStatuses() {
    this.cdr.markForCheck();
    this.masterDataService.getStatuses().subscribe({
      next: (res) => {
        this.statuses = res;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load statuses');
        this.cdr.detectChanges();
      }
    });
  }

  saveNewStatus() {
    if (!this.newStatus.name?.trim()) return;
    const nameStr = this.newStatus.name.trim();
    const slug = nameStr
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    const payload = {
      ...this.newStatus,
      slug
    };

    this.masterDataService.createStatus(payload).subscribe({
      next: () => {
        this.toastr.success('Status created');
        this.addingStatus = false;
        this.newStatus = { name: '', colorClass: 'bg-slate-100 text-slate-700' };
        this.loadStatuses();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to create status');
        this.cdr.detectChanges();
      }
    });
  }

  startEditStatus(status: Status) {
    if (status.isSystem) return;
    this.editingStatus = status.id;
    this.editStatusData = { name: status.name, colorClass: status.colorClass };
  }

  saveStatus() {
    if (!this.editingStatus || !this.editStatusData.name?.trim()) return;
    const nameStr = this.editStatusData.name.trim();
    const slug = nameStr
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    const payload = {
      ...this.editStatusData,
      slug
    };

    this.masterDataService.updateStatus(this.editingStatus, payload).subscribe({
      next: () => {
        this.toastr.success('Status updated');
        this.editingStatus = null;
        this.loadStatuses();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to update status');
        this.cdr.detectChanges();
      }
    });
  }

  deleteStatus(status: Status) {
    if (status.isSystem) return;
    if (confirm(`Are you sure you want to delete status "${status.name}"?`)) {
      this.masterDataService.deleteStatus(status.id).subscribe({
        next: () => {
          this.toastr.success('Status deleted');
          this.loadStatuses();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to delete status. It might be in use.');
          this.cdr.detectChanges();
        }
      });
    }
  }

  selectColorForNew(colorClass: string) {
    this.newStatus.colorClass = colorClass;
  }

  selectColorForEdit(colorClass: string) {
    this.editStatusData.colorClass = colorClass;
  }
}
