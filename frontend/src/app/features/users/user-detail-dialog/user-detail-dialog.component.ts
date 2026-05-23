import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, OnInit, OnChanges, Output, SimpleChanges, ChangeDetectorRef } from '@angular/core';
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

  user: User | null = null;
  loading = true;
  saving = false;
  activeTab: 'overview' | 'assets' | 'history' | 'edit' = 'overview';
  
  userForm!: FormGroup;
  roles: any[] = [];

  ngOnInit() {
    this.loadUser();
    this.loadRoles();
    this.initForm();
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
    this.loading = true;
    this.cdr.markForCheck();
    this.userService.getUserById(this.userId).subscribe({
      next: (user) => {
        this.user = user;
        this.loading = false;
        this.patchForm();
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load user details');
        this.close.emit();
        this.cdr.detectChanges();
      }
    });
  }

  loadRoles() {
    this.userService.getRoles().subscribe(roles => {
      this.roles = roles;
      this.cdr.detectChanges();
    });
  }

  initForm() {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      roleId: ['', Validators.required],
      isActive: [true],
      password: [''] // Optional
    });
  }

  patchForm() {
    if (this.user) {
      this.userForm.patchValue({
        name: this.user.name,
        email: this.user.email,
        roleId: this.user.role?.id,
        isActive: this.user.isActive
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
        this.toastr.success('User updated successfully');
        this.saving = false;
        this.updated.emit();
        this.loadUser();
        this.activeTab = 'overview';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update user');
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  onDelete() {
    if (!this.user) return;
    
    this.userService.deleteUser(this.user.id).subscribe({
      next: () => {
        this.toastr.success('User deleted successfully');
        this.updated.emit();
        this.close.emit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 409) {
          if (confirm(`${err.error.message}\n\nDo you want to unassign all assets and delete this user?`)) {
            this.userService.deleteUser(this.user!.id, true).subscribe({
              next: () => {
                this.toastr.success('User deleted successfully');
                this.updated.emit();
                this.close.emit();
                this.cdr.detectChanges();
              },
              error: () => {
                this.toastr.error('Failed to delete user');
                this.cdr.detectChanges();
              }
            });
          }
        } else {
          this.toastr.error('Failed to delete user');
          this.cdr.detectChanges();
        }
      }
    });
  }
}
