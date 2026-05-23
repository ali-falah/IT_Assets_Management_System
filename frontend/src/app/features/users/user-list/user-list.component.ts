import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../environments/environment';
import { PlatformService } from '../../../core/services/platform.service';
import { User, UserRole, UserService } from '../../../core/services/user.service';
import { ExcelExportService } from '../../../shared/services/excel-export.service';
import { UserDetailDialogComponent } from '../user-detail-dialog/user-detail-dialog.component';
import { UserImportComponent } from '../user-import/user-import.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, AgGridAngular, UserImportComponent, UserDetailDialogComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private excelExportService = inject(ExcelExportService);
  private platform = inject(PlatformService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  openUserDetail(userId: string) {
    this.selectedUserId = userId;
    this.showDetailDialog = true;
    this.cdr.detectChanges();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId },
      queryParamsHandling: 'merge'
    });
  }

  closeUserDetail() {
    this.showDetailDialog = false;
    this.selectedUserId = null;
    this.cdr.detectChanges();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId: null },
      queryParamsHandling: 'merge'
    });
  }

  private gridApi!: GridApi;

  loading = false;
  users: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
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

  isMobile = this.platform.isMobile;

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
        this.openUserDetail(params.data.id);
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
    },
    {
      headerName: 'Actions',
      width: 110,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      pinned: 'right' as const,
      cellRenderer: (params: any) => {
        return `
          <div class="flex items-center gap-1 h-full">
            <button class="user-view-btn p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-primary rounded-lg transition-all" title="View Details">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="user-delete-btn p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-all" title="Delete User">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        `;
      },
      onCellClicked: (params: any) => {
        const target = params.event?.target as HTMLElement;
        if (target?.closest('.user-delete-btn')) {
          this.deleteUser(params.data.id);
        } else if (target?.closest('.user-view-btn')) {
          this.openUserDetail(params.data.id);
        }
      }
    }
  ];

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
  };

  saveTableState() {
    const state = {
      searchTerm: this.searchTerm,
      gridFilterModel: this.gridApi ? this.gridApi.getFilterModel() : null
    };
    localStorage.setItem('users_table_state', JSON.stringify(state));
  }

  ngOnInit() {
    const savedStateStr = localStorage.getItem('users_table_state');
    if (savedStateStr) {
      try {
        const state = JSON.parse(savedStateStr);
        this.searchTerm = state.searchTerm || '';
      } catch (e) {
        console.warn('Could not restore user table state:', e);
      }
    }

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
      } else if (search) {
        this.searchTerm = search;
        this.applyFilter();
        if (this.gridApi) {
          this.gridApi.setGridOption('quickFilterText', search);
        }
        this.saveTableState();
      }
    });
  }

  loadUsers() {
    this.loading = true;
    this.cdr.markForCheck();
    this.userService.getUsers().subscribe({
      next: (res: User[]) => {
        this.users = res;
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toastr.error('Failed to load users');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRoles() {
    this.userService.getRoles().subscribe({
      next: (res: UserRole[]) => {
        this.roles = res;
        if (res.length > 0) this.newUser.roleId = res[res.length - 1].id;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load roles');
        this.cdr.detectChanges();
      }
    });
  }

  openModal() {
    const defaultRoleId = this.roles.length > 0 ? this.roles[this.roles.length - 1].id : '';
    this.newUser = { name: '', email: '', password: '', roleId: defaultRoleId };
    this.showModal = true;
    this.showDetailDialog = false;
    this.selectedUserId = null;
    this.cdr.detectChanges();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { userId: null },
      queryParamsHandling: 'merge'
    });
  }

  closeModal() {
    this.showModal = false;
    this.cdr.detectChanges();
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
    if (this.deleteType === 'single' && this.userIdToDelete) {
      this.userService.deleteUser(this.userIdToDelete, force).subscribe({
        next: () => {
          this.toastr.success('User deleted successfully');
          this.loadUsers();
          this.showConfirmDelete = false;
          this.showUnassignConfirm = false;
          this.userIdToDelete = null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error(err.error?.message || 'Failed to delete user');
            this.showConfirmDelete = false;
          }
          this.cdr.detectChanges();
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
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err.status === 409) {
            this.unassignErrorMsg = err.error.message;
            this.showUnassignConfirm = true;
          } else {
            this.toastr.error('Failed to delete users');
          }
          this.cdr.detectChanges();
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
    this.cdr.markForCheck();
    this.http.post(`${environment.apiUrl}/auth/register`, this.newUser).subscribe({
      next: () => {
        this.toastr.success('User created successfully');
        this.showModal = false;
        this.loadUsers();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.toastr.error(err?.error?.message || 'Failed to create user');
        this.cdr.detectChanges();
      },
      complete: () => {
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    
    // Restore quick filter text
    if (this.searchTerm) {
      this.gridApi.setGridOption('quickFilterText', this.searchTerm);
    }

    // Restore column filter model
    const savedStateStr = localStorage.getItem('users_table_state');
    if (savedStateStr) {
      try {
        const state = JSON.parse(savedStateStr);
        if (state.gridFilterModel && Object.keys(state.gridFilterModel).length > 0) {
          setTimeout(() => {
            this.gridApi.setFilterModel(state.gridFilterModel);
          }, 200);
        }
      } catch (e) {
        console.warn('Could not restore user AG Grid filter model:', e);
      }
    }
  }

  onFilterChanged() {
    this.saveTableState();
  }

  public onSelectionChanged() {
    this.selectedCount = this.gridApi.getSelectedNodes().length;
  }

  async exportToExcel() {
    const dataToExport = this.users.map(user => ({
      'Name': user.name,
      'Email': user.email,
      'Role': user.role?.name || '',
      'Status': user.isActive ? 'Active' : 'Inactive',
      'Assigned Assets (Serials)': user.assets?.map((a: any) => a.serialNumber).join(', ') || 'None'
    }));
    await this.excelExportService.exportToExcel(dataToExport, 'users');
  }

  applyFilter() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredUsers = [...this.users];
    } else {
      this.filteredUsers = this.users.filter(user => 
        (user.name?.toLowerCase().includes(term)) ||
        (user.email?.toLowerCase().includes(term)) ||
        (user.role?.name?.toLowerCase().includes(term))
      );
    }
  }

  onSearch(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.applyFilter();
    if (this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.searchTerm);
    }
    this.saveTableState();
  }
}
