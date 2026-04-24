import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { LucideAngularModule, Search, Plus, X, UserPlus, Trash2, TriangleAlert } from 'lucide-angular';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community';
import { UserService, User, UserRole } from '../../../core/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { UserImportComponent } from '../user-import/user-import.component';
import { UserDetailDialogComponent } from '../user-detail-dialog/user-detail-dialog.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, AgGridAngular, UserImportComponent, UserDetailDialogComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private route = inject(ActivatedRoute);
  private toastr = inject(ToastrService);
  private http = inject(HttpClient);

  private gridApi!: GridApi;

  users: User[] = [];
  roles: UserRole[] = [];
  showModal = false;
  showImportModal = false;
  showDetailDialog = false;
  selectedUserId: string | null = null;
  saving = false;
  selectedCount = 0;
  showConfirmDelete = false;
  showUnassignConfirm = false;
  unassignErrorMsg = '';
  deleteType: 'single' | 'bulk' = 'single';
  userIdToDelete: string | null = null;

  newUser = { name: '', email: '', password: '', roleId: '' };

  gridIcons = {
    filter: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1; opacity: 0.8;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    sortAscending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>',
    sortDescending: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #6366f1;"><path d="m19 12-7 7-7-7"/><path d="M12 5v14"/></svg>'
  };

  columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      cellClass: 'cursor-pointer font-semibold text-slate-800 hover:underline transition-all',
      onCellClicked: (params: any) => {
        this.selectedUserId = params.data.id;
        this.showDetailDialog = true;
      }
    },
    { 
      field: 'email', 
      headerName: 'Email', 
      flex: 2,
      cellRenderer: (params: any) => {
        if (!params.value) return '-';
        return `
          <div class="flex items-center justify-between group">
            <span class="truncate">${params.value}</span>
            <button class="copy-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-primary transition-all ml-2" 
                    title="Copy to clipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </button>
          </div>
        `;
      },
      onCellClicked: (event: any) => {
        if (event.event.target.closest('.copy-btn')) {
          navigator.clipboard.writeText(event.value);
          this.toastr.success('Copied to clipboard');
        }
      }
    },
    {
      headerName: 'Assets',
      flex: 0.8,
      valueGetter: (params: any) => params.data.assets?.length || 0,
      cellRenderer: (params: any) => {
        const count = params.value;
        if (count === 0) return `<span class="text-slate-400">0</span>`;
        return `
          <div class="flex items-center">
            <span class="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs border border-indigo-100">
              ${count}
            </span>
          </div>
        `;
      }
    },
    {
      field: 'role',
      headerName: 'Role',
      flex: 1,
      valueGetter: (params: any) => params.data.role?.name,
      cellRenderer: (params: any) => {
        const role = params.data.role;
        if (!role) return '';
        const colorClass = role.colorClass || 'bg-slate-100 text-slate-700';
        return `<span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}">${role.name}</span>`;
      }
    },
    {
      field: 'isActive',
      headerName: 'Status',
      flex: 1,
      cellRenderer: (params: any) => {
        return `
          <div class="flex items-center">
            <span class="h-2 w-2 rounded-full mr-2 ${params.value ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'}"></span>
            <span class="text-xs font-medium ${params.value ? 'text-green-700' : 'text-red-700'}">${params.value ? 'Active' : 'Inactive'}</span>
          </div>
        `;
      }
    }
  ];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
    this.checkQueryParams();
  }

  checkQueryParams() {
    this.route.queryParams.subscribe((params: any) => {
      const userId = params['userId'];
      const search = params['search'];
      
      if (userId) {
        this.selectedUserId = userId;
        this.showDetailDialog = true;
      } else if (search && this.gridApi) {
        this.gridApi.setGridOption('quickFilterText', search);
      }
    });
  }

  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (res: User[]) => {
        this.users = res;
      },
      error: (err: any) => {
        this.toastr.error('Failed to load users');
      }
    });
  }

  loadRoles() {
    this.userService.getRoles().subscribe({
      next: (res: UserRole[]) => {
        this.roles = res;
        if (res.length > 0) this.newUser.roleId = res[res.length - 1].id;
      },
      error: () => this.toastr.error('Failed to load roles')
    });
  }

  openModal() {
    const defaultRoleId = this.roles.length > 0 ? this.roles[this.roles.length - 1].id : '';
    this.newUser = { name: '', email: '', password: '', roleId: defaultRoleId };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  public deleteSelectedUsers() {
    if (this.selectedCount === 0) {
      this.toastr.warning('Please select users to delete');
      return;
    }
    this.deleteType = 'bulk';
    this.showConfirmDelete = true;
  }

  deleteUser(id: string) {
    this.userIdToDelete = id;
    this.deleteType = 'single';
    this.showConfirmDelete = true;
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.showUnassignConfirm = false;
    this.userIdToDelete = null;
    this.unassignErrorMsg = '';
  }

  executeDelete(force: boolean = false) {
    console.log('User executeDelete called', { force, deleteType: this.deleteType, userIdToDelete: this.userIdToDelete });
    if (this.deleteType === 'single' && this.userIdToDelete) {
      this.userService.deleteUser(this.userIdToDelete, force).subscribe({
        next: () => {
          this.toastr.success('User deleted successfully');
          this.loadUsers();
          this.showConfirmDelete = false;
          this.showUnassignConfirm = false;
          this.userIdToDelete = null;
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error(err.error?.message || 'Failed to delete user');
            this.showConfirmDelete = false;
          }
        }
      });
    } else if (this.deleteType === 'bulk') {
      const selectedNodes = this.gridApi.getSelectedNodes();
      const ids = selectedNodes.map(node => node.data.id);
      this.userService.bulkDeleteUsers(ids, force).subscribe({
        next: (res: any) => {
          if (res.errors && res.errors.length > 0 && !force) {
            this.unassignErrorMsg = `Some selected users have assets assigned. Do you want to unassign assets and delete them?`;
            this.showUnassignConfirm = true;
          } else {
            const deletedCount = res.count || 0;
            const errorCount = res.errors?.length || 0;
            
            if (deletedCount > 0) {
              this.toastr.success(`${deletedCount} users deleted successfully`);
            }
            
            if (errorCount > 0) {
              this.toastr.error(`${errorCount} users failed to delete (Check if admin or self).`);
            }

            if (deletedCount > 0 || errorCount === 0) {
              this.loadUsers();
              this.selectedCount = 0;
              this.showConfirmDelete = false;
              this.showUnassignConfirm = false;
            }
          }
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error('Failed to delete users');
          }
        }
      });
    }
  }

  createUser() {
    if (!this.newUser.name.trim() || !this.newUser.email.trim() || !this.newUser.password.trim()) {
      this.toastr.warning('Please fill in all required fields');
      return;
    }
    this.saving = true;
    this.http.post(`${environment.apiUrl}/auth/register`, this.newUser).subscribe({
      next: () => {
        this.toastr.success('User created successfully');
        this.showModal = false;
        this.loadUsers();
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message || 'Failed to create user');
      },
      complete: () => { this.saving = false; }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
  }

  public onSelectionChanged() {
    this.selectedCount = this.gridApi.getSelectedNodes().length;
  }

  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    this.gridApi.setGridOption('quickFilterText', target.value);
  }
}
