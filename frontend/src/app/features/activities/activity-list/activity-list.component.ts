import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ActivityLogService, ActivityLog } from '../../../core/services/activity-log.service';
import { AssignmentService, Assignment } from '../../../core/services/assignment.service';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

export interface UnifiedActivity {
  id: string;
  action: string;
  message: string;
  entityId?: string;
  entityName?: string;
  secondaryId?: string;
  secondaryName?: string;
  date: Date;
  isAssignment?: boolean;
}

@Component({
  selector: 'app-activity-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  templateUrl: './activity-list.component.html',
  styleUrls: ['./activity-list.component.css']
})
export class ActivityListComponent implements OnInit {
  private activityLogService = inject(ActivityLogService);
  private assignmentService = inject(AssignmentService);
  private toastr = inject(ToastrService);

  activities: UnifiedActivity[] = [];
  loading = true;
  searchTerm = '';

  ngOnInit() {
    this.loadActivities();
  }

  get filteredActivities(): UnifiedActivity[] {
    if (!this.searchTerm.trim()) return this.activities;
    const term = this.searchTerm.toLowerCase();
    return this.activities.filter(a =>
      a.message.toLowerCase().includes(term) ||
      (a.entityName || '').toLowerCase().includes(term) ||
      (a.secondaryName || '').toLowerCase().includes(term) ||
      this.actionLabel(a.action).toLowerCase().includes(term)
    );
  }

  loadActivities() {
    this.loading = true;

    forkJoin({
      logs: this.activityLogService.getAll(300),
      assignments: this.assignmentService.getAssignments()
    }).subscribe({
      next: ({ logs, assignments }) => {
        // Build unified list from ActivityLog table
        const fromLogs: UnifiedActivity[] = logs.map(l => ({
          id: l.id,
          action: l.action,
          message: l.message,
          entityId: l.entityId,
          entityName: l.entityName,
          secondaryId: l.secondaryId,
          secondaryName: l.secondaryName,
          date: new Date(l.createdAt),
        }));

        // Build unified list from Assignments (assign/return events)
        const fromAssignments: UnifiedActivity[] = [];
        for (const a of assignments) {
          // Assignment event
          fromAssignments.push({
            id: `assign-${a.id}`,
            action: 'asset_assigned',
            message: `"${a.asset?.name || 'Asset'}" was assigned to ${a.user?.name || 'a user'}`,
            entityId: a.assetId,
            entityName: a.asset?.name,
            secondaryId: a.userId,
            secondaryName: a.user?.name,
            date: new Date(a.assignedAt),
            isAssignment: true,
          });
          // Return event
          if (a.returnedAt) {
            fromAssignments.push({
              id: `return-${a.id}`,
              action: 'asset_returned',
              message: `"${a.asset?.name || 'Asset'}" was returned by ${a.user?.name || 'a user'}`,
              entityId: a.assetId,
              entityName: a.asset?.name,
              secondaryId: a.userId,
              secondaryName: a.user?.name,
              date: new Date(a.returnedAt),
              isAssignment: true,
            });
          }
        }

        // Deduplicate: ActivityLog already contains asset_assigned/asset_returned from the
        // assignment service call, but we prefer the enriched assignment name. Keep only
        // assignment-derived records for those two actions.
        const nonAssignmentLogs = fromLogs.filter(
          l => l.action !== 'asset_assigned' && l.action !== 'asset_returned'
        );

        this.activities = [...nonAssignmentLogs, ...fromAssignments]
          .sort((a, b) => b.date.getTime() - a.date.getTime());

        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load activity history');
        this.loading = false;
      }
    });
  }

  actionLabel(action: string): string {
    const labels: Record<string, string> = {
      asset_created: 'Asset Added',
      asset_updated: 'Asset Updated',
      asset_deleted: 'Asset Deleted',
      asset_assigned: 'Asset Assigned',
      asset_returned: 'Asset Returned',
      user_created: 'User Added',
      user_deleted: 'User Deleted',
    };
    return labels[action] || action;
  }

  actionIcon(action: string): string {
    const icons: Record<string, string> = {
      asset_created: 'plus-circle',
      asset_updated: 'pencil',
      asset_deleted: 'trash-2',
      asset_assigned: 'arrow-up-right',
      asset_returned: 'arrow-down-left',
      user_created: 'user-plus',
      user_deleted: 'user-minus',
    };
    return icons[action] || 'clock';
  }

  actionColor(action: string): string {
    if (action === 'asset_created' || action === 'user_created') return 'bg-emerald-50 text-emerald-600';
    if (action === 'asset_deleted' || action === 'user_deleted') return 'bg-rose-50 text-rose-600';
    if (action === 'asset_assigned') return 'bg-indigo-50 text-indigo-600';
    if (action === 'asset_returned') return 'bg-teal-50 text-teal-600';
    if (action === 'asset_updated') return 'bg-amber-50 text-amber-600';
    return 'bg-slate-50 text-slate-500';
  }

  formatDate(date: Date): string {
    return date.toLocaleString();
  }
}
