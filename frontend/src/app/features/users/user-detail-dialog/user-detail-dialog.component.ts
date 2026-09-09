import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnInit, OnChanges, Output, SimpleChanges, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { User, UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-detail-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, LucideAngularModule, RouterModule],
  templateUrl: './user-detail-dialog.component.html',
  styleUrls: ['./user-detail-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailDialogComponent implements OnInit, OnChanges {
  @Input() userId!: string | null;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  private userService = inject(UserService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  user: User | null = null;
  loading = true;
  saving = false;
  activeTab: 'overview' | 'assets' | 'history' | 'edit' = 'overview';
  
  userForm!: FormGroup;
  roles: any[] = [];

  ngOnInit() {
    this.initForm();
    this.loadRoles();
    this.loadUser();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['userId'] && !changes['userId'].firstChange) {
      this.loadUser();
    }
  }

  navigateToAsset(assetId: string) {
    this.close.emit();
    this.router.navigate(['/assets', assetId, 'edit']);
  }

  loadUser() {
    if (!this.userId) return;
    this.ngZone.run(() => {
      this.loading = true;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });

    // Check if userId is a standard UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.userId);

    if (isUuid) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          this.ngZone.run(() => {
            this.user = user;
            this.loading = false;
            this.patchForm();
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.fallbackFindUser();
        }
      });
    } else {
      this.fallbackFindUser();
    }
  }

  private fallbackFindUser() {
    if (!this.userId) return;
    const query = this.userId.toLowerCase().trim();
    this.userService.getUsers().subscribe({
      next: (users) => {
        const found = users.find(u => 
          u.id === this.userId || 
          u.name?.toLowerCase().trim() === query || 
          (u.email && u.email.toLowerCase().trim() === query) ||
          (u.name && query.includes(u.name.toLowerCase().trim())) ||
          (u.name && u.name.toLowerCase().trim().includes(query))
        );
        if (found) {
          this.ngZone.run(() => {
            this.user = found;
            this.loading = false;
            this.patchForm();
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          });

          // Fetch complete user profile by UUID to include full relations
          this.userService.getUserById(found.id).subscribe({
            next: (fullUser) => {
              this.ngZone.run(() => {
                this.user = fullUser;
                this.loading = false;
                this.patchForm();
                this.cdr.markForCheck();
                this.cdr.detectChanges();
              });
            },
            error: () => {
              this.ngZone.run(() => {
                this.loading = false;
                this.cdr.markForCheck();
                this.cdr.detectChanges();
              });
            }
          });
        } else {
          this.ngZone.run(() => {
            this.user = {
              id: this.userId!,
              name: this.userId!,
              email: '',
              isActive: true,
              role: { id: '', name: 'employee' } as any,
              assets: [],
              assignments: []
            } as any;
            this.loading = false;
            this.patchForm();
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          });
        }
      },
      error: () => {
        this.ngZone.run(() => {
          this.user = {
            id: this.userId!,
            name: this.userId!,
            email: '',
            isActive: true,
            role: { id: '', name: 'employee' } as any,
            assets: [],
            assignments: []
          } as any;
          this.loading = false;
          this.patchForm();
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  loadRoles() {
    this.userService.getRoles().subscribe(roles => {
      this.ngZone.run(() => {
        this.roles = roles;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      });
    });
  }

  initForm() {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.email]],
      roleId: ['', Validators.required],
      isActive: [true],
      password: [''] // Optional
    });
  }

  patchForm() {
    if (this.user && this.userForm) {
      this.userForm.patchValue({
        name: this.user.name || '',
        email: this.user.email || '',
        roleId: this.user.role?.id || (this.roles.length > 0 ? this.roles[0]?.id : ''),
        isActive: this.user.isActive ?? true
      });
    }
  }

  onSubmit() {
    if (this.userForm.invalid || !this.user) return;

    this.saving = true;
    this.cdr.markForCheck();
    const formData = { ...this.userForm.value };
    if (!formData.password) delete formData.password;

    this.userService.updateUser(this.user.id, formData).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.toastr.success('User updated successfully');
          this.saving = false;
          this.updated.emit();
          this.loadUser();
          this.activeTab = 'overview';
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.toastr.error(err.error?.message || 'Failed to update user');
          this.saving = false;
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      }
    });
  }

  onDelete() {
    if (!this.user) return;
    
    this.userService.deleteUser(this.user.id).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.toastr.success('User deleted successfully');
          this.updated.emit();
          this.close.emit();
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        if (err.status === 409) {
          if (confirm(`${err.error.message}\n\nDo you want to unassign all assets and delete this user?`)) {
            this.userService.deleteUser(this.user!.id, true).subscribe({
              next: () => {
                this.ngZone.run(() => {
                  this.toastr.success('User deleted successfully');
                  this.updated.emit();
                  this.close.emit();
                  this.cdr.markForCheck();
                  this.cdr.detectChanges();
                });
              },
              error: () => {
                this.ngZone.run(() => {
                  this.toastr.error('Failed to delete user');
                  this.cdr.markForCheck();
                  this.cdr.detectChanges();
                });
              }
            });
          }
        } else {
          this.ngZone.run(() => {
            this.toastr.error('Failed to delete user');
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          });
        }
      }
    });
  }
}
