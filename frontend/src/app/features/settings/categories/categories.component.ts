import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Plus, Pencil, Trash2, Check, X, Tags } from 'lucide-angular';
import { MasterDataService, Category } from '../../../core/services/master-data.service';
import { ToastrService } from 'ngx-toastr';
import { DataTableComponent, TableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule, DataTableComponent, ConfirmationModalComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);

  @ViewChild('iconTemplate', { static: true }) iconTemplate!: TemplateRef<any>;
  @ViewChild('actionsTemplate', { static: true }) actionsTemplate!: TemplateRef<any>;

  categories: Category[] = [];
  loading = false;
  searchTerm = '';
  
  addingCat = false;
  newCat: Partial<Category> = { name: '', description: '' };
  
  editingCat: string | null = null;
  editCatData: Partial<Category> = {};

  showConfirmDelete = false;
  categoryToDelete: Category | null = null;

  columns: TableColumn[] = [];

  iconOptions = [
    'laptop', 'monitor', 'smartphone', 'tablet', 'tv', 
    'printer', 'server', 'network', 'wifi', 'router',
    'plug', 'camera', 'mouse-pointer', 'cable', 'headphones', 
    'hard-drive', 'battery', 'cpu', 'radio', 'projector',
    'briefcase', 'key', 'bluetooth', 'package', 'armchair', 
    'layers', 'component', 'database', 'shield', 'user'
  ];

  colorOptions = [
    'blue', 'indigo', 'emerald', 'teal', 'cyan', 
    'rose', 'purple', 'violet', 'amber', 'orange', 
    'slate', 'pink'
  ];

  get filteredCategories() {
    if (!this.searchTerm.trim()) return this.categories;
    const term = this.searchTerm.toLowerCase();
    return this.categories.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.description && c.description.toLowerCase().includes(term))
    );
  }

  ngOnInit() {
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
    this.masterDataService.getCategories().subscribe({
      next: (res) => {
        this.categories = res;
        this.loading = false;
      },
      error: () => {
        this.toastr.error('Failed to load categories');
        this.loading = false;
      }
    });
  }

  saveNewCategory() {
    if (!this.newCat.name?.trim()) return;
    this.masterDataService.createCategory(this.newCat).subscribe({
      next: () => {
        this.toastr.success('Category created');
        this.addingCat = false;
        this.newCat = { name: '', description: '' };
        this.loadCategories();
      },
      error: () => this.toastr.error('Failed to create category')
    });
  }

  startEditCategory(cat: Category) {
    this.editingCat = cat.id;
    this.editCatData = { 
      name: cat.name, 
      description: cat.description,
      icon: cat.icon || 'package',
      color: cat.color || 'slate'
    };
  }

  saveCategory() {
    if (!this.editingCat || !this.editCatData.name?.trim()) return;
    this.masterDataService.updateCategory(this.editingCat, this.editCatData).subscribe({
      next: () => {
        this.toastr.success('Category updated');
        this.editingCat = null;
        this.loadCategories();
      },
      error: () => this.toastr.error('Failed to update category')
    });
  }

  deleteCategory(cat: Category) {
    this.categoryToDelete = cat;
    this.showConfirmDelete = true;
  }

  executeDelete() {
    if (!this.categoryToDelete) return;
    
    this.masterDataService.deleteCategory(this.categoryToDelete.id).subscribe({
      next: () => {
        this.toastr.success('Category deleted successfully');
        this.loadCategories();
        this.showConfirmDelete = false;
        this.categoryToDelete = null;
      },
      error: () => {
        this.toastr.error('Failed to delete category. It might be assigned to existing assets.');
        this.showConfirmDelete = false;
      }
    });
  }
}
