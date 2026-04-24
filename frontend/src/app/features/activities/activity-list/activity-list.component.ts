import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ArrowLeftRight, ArrowUpRight, ArrowDownLeft, Clock, User, Laptop, Search, RefreshCw, History } from 'lucide-angular';
import { AssignmentService, Assignment } from '../../../core/services/assignment.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  templateUrl: './activity-list.component.html',
  styleUrls: ['./activity-list.component.css']
})
export class ActivityListComponent implements OnInit {
  private assignmentService = inject(AssignmentService);
  private toastr = inject(ToastrService);

  activities: Assignment[] = [];
  loading = true;
  searchTerm = '';

  ngOnInit() {
    this.loadActivities();
  }

  get filteredActivities() {
    if (!this.searchTerm.trim()) return this.activities;
    
    const term = this.searchTerm.toLowerCase();
    return this.activities.filter(a => {
      const assetName = (a.asset?.name || '').toLowerCase();
      const serial = (a.asset?.serialNumber || '').toLowerCase();
      const userName = (a.user?.name || '').toLowerCase();
      const date = this.formatDate(a.returnedAt || a.assignedAt).toLowerCase();
      const type = (a.returnedAt ? 'Asset Returned' : 'Asset Assigned').toLowerCase();
      
      return assetName.includes(term) || 
             serial.includes(term) || 
             userName.includes(term) || 
             date.includes(term) ||
             type.includes(term);
    });
  }

  loadActivities() {
    this.loading = true;
    this.assignmentService.getAssignments().subscribe({
      next: (res) => {
        this.activities = res;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load activity history');
        this.loading = false;
      }
    });
  }

  formatDate(date: string) {
    return new Date(date).toLocaleString();
  }
}
