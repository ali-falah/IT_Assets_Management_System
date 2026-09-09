import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, forwardRef, HostListener, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="relative w-full" (clickOutside)="isOpen = false">
      <div 
        (click)="toggleDropdown()"
        class="w-full min-h-[42px] px-4 border border-slate-200 rounded-lg bg-white cursor-pointer flex justify-between items-center hover:border-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-200 shadow-sm"
        [class.ring-2]="isOpen"
        [class.ring-primary]="isOpen"
        [class.border-primary]="isOpen"
      >
        <span [class.text-slate-400]="!selectedItem" class="truncate text-sm py-2">
          {{ selectedItem ? selectedItem.name : placeholder }}
        </span>
        <div class="flex items-center justify-center ml-2">
          <lucide-icon 
            [name]="isOpen ? 'chevron-up' : 'chevron-down'" 
            [size]="16" 
            class="text-slate-400 shrink-0 transition-transform duration-200"
          ></lucide-icon>
        </div>
      </div>

      <!-- Dropdown -->
      <div *ngIf="isOpen" 
           class="absolute z-[9999] w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
           [class.mt-1.5]="direction === 'down'"
           [class.bottom-full]="direction === 'up'"
           [class.mb-1.5]="direction === 'up'">
        <div class="p-2.5 border-b border-slate-100 bg-slate-50/50">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <lucide-icon 
                name="search" 
                [size]="14" 
              ></lucide-icon>
            </div>
            <input 
              #searchInput
              type="search" 
              [(ngModel)]="searchTerm" 
              (click)="$event.stopPropagation()"
              (keydown.enter)="onKeyDownEnter($event)"
              [placeholder]="searchPlaceholder" 
              [name]="searchControlName"
              [id]="searchControlName"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              inputmode="search"
              role="searchbox"
              aria-autocomplete="list"
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              class="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            >
            <button 
              *ngIf="searchTerm" 
              type="button"
              (click)="$event.stopPropagation(); searchTerm = ''" 
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 transition-colors cursor-pointer"
              title="Clear search">
              <lucide-icon name="x" [size]="13"></lucide-icon>
            </button>
          </div>
        </div>
        
        <div class="max-h-64 overflow-y-auto custom-scrollbar py-1">
          <!-- Null Option -->
          <div 
            *ngIf="nullLabel && !searchTerm"
            (click)="selectItem({id: null, name: nullLabel})"
            class="px-4 py-2.5 text-sm hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors italic text-slate-500"
            [class.bg-indigo-50]="value === null"
          >
            <span>{{ nullLabel }}</span>
            <lucide-icon *ngIf="value === null" name="check" [size]="14" class="text-primary"></lucide-icon>
          </div>

          <div 
            *ngFor="let item of filteredItems" 
            (click)="selectItem(item)"
            class="px-4 py-2.5 text-sm hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between transition-colors"
            [class.bg-indigo-50]="value === item.id"
            [class.text-primary]="value === item.id"
            [class.font-semibold]="value === item.id"
          >
            <span class="truncate">{{ item.name }}</span>
            <lucide-icon *ngIf="value === item.id" name="check" [size]="14"></lucide-icon>
          </div>
          
          <!-- Add New Option -->
          <div 
            *ngIf="canAdd && searchTerm && !exactMatch"
            (click)="addNew()"
            class="px-4 py-3 text-sm text-primary hover:bg-primary/5 cursor-pointer flex items-center border-t border-slate-100 bg-slate-50/30 sticky bottom-0 group"
          >
            <div class="p-1 bg-primary/10 rounded mr-3 group-hover:bg-primary/20 transition-colors">
              <lucide-icon name="plus" [size]="14" class="text-primary"></lucide-icon>
            </div>
            <span>Create new "{{ searchTerm }}"</span>
          </div>

          <div *ngIf="filteredItems.length === 0 && (!canAdd || !searchTerm)" class="px-4 py-10 text-center text-sm text-slate-400">
            <lucide-icon name="search" [size]="24" class="mx-auto mb-2 opacity-20"></lucide-icon>
            No results found for "{{ searchTerm }}"
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .animate-in {
      animation: enter 0.2s ease-out;
    }
    @keyframes enter {
      from { opacity: 0; transform: translateY(-10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    input[type="search"]::-webkit-search-decoration,
    input[type="search"]::-webkit-search-cancel-button,
    input[type="search"]::-webkit-search-results-button,
    input[type="search"]::-webkit-search-results-decoration {
      -webkit-appearance: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchableSelectComponent implements ControlValueAccessor, OnChanges {
  @Input() items: any[] = [];
  @Input() placeholder: string = 'Select item';
  @Input() label: string = 'item';
  @Input() nullLabel: string | null = null;
  @Input() canAdd: boolean = false;
  @Input() direction: 'up' | 'down' = 'down';

  @Output() add = new EventEmitter<string>();

  private cdr = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);

  searchControlName = 'select_search_' + Math.random().toString(36).substring(2, 9);

  get searchPlaceholder(): string {
    const clean = (this.label || '').toLowerCase();
    if (clean === 'user' || clean === 'employee') {
      return 'Search assignee or staff...';
    }
    return `Search ${this.label}...`;
  }

  isOpen = false;
  searchTerm = '';
  value: any = null;

  onChange: any = () => {};
  onTouched: any = () => {};

  ngOnChanges(changes: SimpleChanges) {
    if (changes['items'] || changes['placeholder']) {
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.isOpen) {
        this.isOpen = false;
        this.cdr.markForCheck();
      }
    }
  }

  get filteredItems() {
    if (!this.searchTerm.trim()) return this.items;
    const term = this.searchTerm.toLowerCase();
    return this.items.filter(item => item.name?.toLowerCase().includes(term));
  }

  get exactMatch() {
    if (!this.searchTerm.trim()) return true;
    const term = this.searchTerm.toLowerCase();
    return this.items.some(item => item.name?.toLowerCase() === term);
  }

  get selectedItem() {
    return this.items.find(i => String(i.id) === String(this.value));
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
    this.cdr.markForCheck();
    if (this.isOpen) {
      this.searchTerm = '';
      setTimeout(() => {
        const input = this.elementRef.nativeElement.querySelector('input');
        if (input) input.focus();
      }, 0);
    }
  }

  selectItem(item: any) {
    this.value = item.id;
    this.onChange(this.value);
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  addNew() {
    if (this.searchTerm.trim()) {
      this.add.emit(this.searchTerm.trim());
      this.isOpen = false;
      this.cdr.markForCheck();
    }
  }

  onKeyDownEnter(event: any) {
    event.preventDefault();
    event.stopPropagation();
    
    const filtered = this.filteredItems;
    if (this.canAdd && this.searchTerm.trim() && !this.exactMatch) {
      this.addNew();
    } else if (filtered.length > 0) {
      this.selectItem(filtered[0]);
    }
  }

  writeValue(value: any): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
}
