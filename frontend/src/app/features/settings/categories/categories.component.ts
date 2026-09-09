import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, TemplateRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Category, MasterDataService } from '../../../core/services/master-data.service';
import { PageHeaderService } from '../../../core/services/page-header.service';
import { PageHeaderActionsDirective } from '../../../shared/directives/page-header-actions.directive';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterModule, 
    LucideAngularModule, 
    DataTableComponent, 
    ConfirmationModalComponent, 
    PageHeaderActionsDirective, 
    DialogComponent
  ],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesComponent implements OnInit {
  private pageHeaderService = inject(PageHeaderService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('iconTemplate', { static: true }) iconTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: true }) actionsTemplate!: TemplateRef<any>;

  categories: Category[] = [];
  loading = false;
  searchTerm = '';
  
  showCategoryModal = false;
  selectedCategory: Category | null = null;
  categoryName = '';
  categoryDescription = '';
  categoryIcon = 'package';
  categoryColor = 'indigo';
  savingCategory = false;

  iconOptions: string[] = [
    'laptop', 'monitor', 'smartphone', 'tablet', 'server', 'printer', 
    'hard-drive', 'headphones', 'camera', 'tv', 'radio', 'watch', 
    'wifi', 'cpu', 'database', 'shield', 'key', 'tool', 'package', 'box'
  ];

  colorOptions: string[] = [
    'slate', 'indigo', 'blue', 'sky', 'teal', 'emerald', 
    'green', 'amber', 'orange', 'red', 'rose', 'purple'
  ];

  showConfirmDelete = false;
  categoryToDelete: Category | null = null;

  columns: TableColumn[] = [];

  get filteredCategories() {
    if (!this.searchTerm.trim()) return this.categories;
    const term = this.searchTerm.toLowerCase();
    return this.categories.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.description && c.description.toLowerCase().includes(term))
    );
  }

  ngOnInit() {
    this.pageHeaderService.setHeader({
      title: 'Categories',
      subtitle: 'Manage asset classifications and types',
      backUrl: '/settings'
    });
    this.setupColumns();
    this.loadCategories();
  }

  setupColumns() {
    this.columns = [
      { key: 'icon', label: 'Category', template: this.iconTemplate },
      { key: 'name', label: 'Name', template: null },
      { key: 'description', label: 'Description', template: null }
    ];
  }

  loadCategories() {
    this.loading = true;
    this.cdr.markForCheck();
    this.masterDataService.getCategories().subscribe({
      next: (res) => {
        this.categories = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to load categories');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startAddCategory() {
    this.selectedCategory = null;
    this.categoryName = '';
    this.categoryDescription = '';
    this.categoryIcon = 'package';
    this.categoryColor = 'indigo';
    this.showCategoryModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  startEditCategory(cat: Category) {
    this.selectedCategory = cat;
    this.categoryName = cat.name || '';
    this.categoryDescription = cat.description || '';
    this.categoryIcon = cat.icon || 'package';
    this.categoryColor = cat.color || 'indigo';
    this.showCategoryModal = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  closeCategoryModal() {
    this.showCategoryModal = false;
    this.selectedCategory = null;
    this.categoryName = '';
    this.categoryDescription = '';
    this.savingCategory = false;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  saveCategory() {
    if (!this.categoryName.trim() || this.savingCategory) return;
    this.savingCategory = true;
    this.cdr.markForCheck();

    const payload = {
      name: this.categoryName.trim(),
      description: this.categoryDescription.trim() || undefined,
      icon: this.categoryIcon,
      color: this.categoryColor
    };

    if (this.selectedCategory) {
      this.masterDataService.updateCategory(this.selectedCategory.id, payload).subscribe({
        next: () => {
          this.toastr.success('Category updated successfully');
          this.savingCategory = false;
          this.closeCategoryModal();
          this.loadCategories();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to update category');
          this.savingCategory = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.masterDataService.createCategory(payload).subscribe({
        next: () => {
          this.toastr.success('Category created successfully');
          this.savingCategory = false;
          this.closeCategoryModal();
          this.loadCategories();
          this.cdr.detectChanges();
        },
        error: () => {
          this.toastr.error('Failed to create category');
          this.savingCategory = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onSearchChange(term: string) {
    this.searchTerm = term;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  deleteCategory(cat: Category) {
    this.categoryToDelete = cat;
    this.showConfirmDelete = true;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  cancelDelete() {
    this.showConfirmDelete = false;
    this.categoryToDelete = null;
    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  executeDelete() {
    if (!this.categoryToDelete) return;
    
    this.masterDataService.deleteCategory(this.categoryToDelete.id).subscribe({
      next: () => {
        this.toastr.success('Category deleted successfully');
        this.loadCategories();
        this.showConfirmDelete = false;
        this.categoryToDelete = null;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastr.error('Failed to delete category. It might be assigned to existing assets.');
        this.showConfirmDelete = false;
        this.cdr.detectChanges();
      }
    });
  }
}
