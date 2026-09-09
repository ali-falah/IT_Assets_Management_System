import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { MasterDataService, Status } from '../../../core/services/master-data.service';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../../shared/directives/page-header-actions.directive';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';

export interface ColorPreset {
  name: string;
  class: string;
  bgClass: string;
}

@Component({
  selector: 'app-statuses',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    LucideAngularModule, 
    PageHeaderActionsDirective, 
    ConfirmationModalComponent, 
    DialogComponent
  ],
  templateUrl: './statuses.component.html',
  styleUrls: ['./statuses.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusesComponent implements OnInit {
  private pageHeaderService = inject(PageHeaderService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  statuses: Status[] = [];
  showStatusModal = false;
  selectedStatus: Status | null = null;
  statusName = '';
  statusColorClass = 'bg-slate-100 text-slate-700';
  savingStatus = false;

  showConfirmDelete = false;
  statusToDelete: Status | null = null;

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
    this.pageHeaderService.setHeader({
      title: 'Statuses',
      subtitle: 'Configure asset lifecycle states and colors',
      backUrl: '/settings'
    });
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

  startAddStatus() {
    this.selectedStatus = null;
    this.statusName = '';
    this.statusColorClass = 'bg-slate-100 text-slate-700';
    this.showStatusModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  startEditStatus(status: Status) {
    if (status.isSystem) return;
    this.selectedStatus = status;
    this.statusName = status.name || '';
    this.statusColorClass = status.colorClass || 'bg-slate-100 text-slate-700';
    this.showStatusModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  closeStatusModal() {
    this.showStatusModal = false;
    this.selectedStatus = null;
    this.statusName = '';
    this.statusColorClass = 'bg-slate-100 text-slate-700';
    this.savingStatus = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  saveStatus() {
    if (!this.statusName.trim() || this.savingStatus) return;
    this.savingStatus = true;
    this.cdr.markForCheck();

    const nameStr = this.statusName.trim();
    const slug = nameStr
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    const payload = {
      name: nameStr,
      slug,
      colorClass: this.statusColorClass
    };

    if (this.selectedStatus) {
      this.masterDataService.updateStatus(this.selectedStatus.id, payload).subscribe({
        next: () => {
          this.toastr.success('Status updated successfully');
          this.savingStatus = false;
          this.closeStatusModal();
          this.loadStatuses();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to update status');
          this.savingStatus = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.masterDataService.createStatus(payload).subscribe({
        next: () => {
          this.toastr.success('Status created successfully');
          this.savingStatus = false;
          this.closeStatusModal();
          this.loadStatuses();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to create status');
          this.savingStatus = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  confirmDeleteStatus(status: Status) {
    if (status.isSystem) return;
    this.statusToDelete = status;
    this.showConfirmDelete = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.statusToDelete = null;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.statusToDelete) return;

    this.masterDataService.deleteStatus(this.statusToDelete.id).subscribe({
      next: () => {
        this.toastr.success('Status deleted successfully');
        this.loadStatuses();
        this.showConfirmDelete = false;
        this.statusToDelete = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to delete status. It might be in use by assets.');
        this.showConfirmDelete = false;
        this.cdr.detectChanges();
      }
    });
  }
}
