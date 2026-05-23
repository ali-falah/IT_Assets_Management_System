import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-import',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="onClose()"></div>

      <!-- Modal Card -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-6 animate-in fade-in zoom-in duration-200">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-50 text-primary rounded-xl">
              <lucide-icon name="user-plus" [size]="24"></lucide-icon>
            </div>
            <div>
              <h2 class="text-xl font-bold text-slate-800">Import Employees</h2>
              <p class="text-sm text-slate-500">Bulk add employees for asset assignment</p>
            </div>
          </div>
          <button (click)="onClose()" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <lucide-icon name="x" [size]="20"></lucide-icon>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Excel Import -->
          <div class="space-y-4 p-4 border border-slate-100 bg-slate-50/30 rounded-xl">
            <div class="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
              <lucide-icon name="file-spreadsheet" [size]="18" class="text-emerald-500"></lucide-icon>
              <span>Excel Import</span>
            </div>
            <p class="text-xs text-slate-500">Upload an Excel file with a column named "Name" or "Employee".</p>
            
            <div class="relative group">
              <input 
                type="file" 
                (change)="onFileChange($event)" 
                accept=".xlsx, .xls"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              >
              <div class="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center group-hover:border-primary group-hover:bg-indigo-50/30 transition-all">
                <lucide-icon name="upload-cloud" [size]="32" class="mx-auto mb-2 text-slate-400 group-hover:text-primary transition-colors"></lucide-icon>
                <p class="text-sm font-medium text-slate-600">Click or drag Excel file</p>
              </div>
            </div>
            
            <button (click)="downloadTemplate()" class="w-full py-2 text-xs font-medium text-primary hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center">
              <lucide-icon name="download" [size]="14" class="mr-1.5"></lucide-icon>
              Download Template
            </button>
          </div>

          <!-- Text Import -->
          <div class="space-y-4 p-4 border border-slate-100 bg-slate-50/30 rounded-xl">
            <div class="flex items-center space-x-2 text-slate-700 font-semibold mb-2">
              <lucide-icon name="type" [size]="18" class="text-blue-500"></lucide-icon>
              <span>Quick Paste</span>
            </div>
            <p class="text-xs text-slate-500">Paste names separated by commas or new lines.</p>
            <textarea 
              [(ngModel)]="rawNamesText" 
              (input)="onTextChange()"
              placeholder="Ali Algburi, Ruqaya, Mohamed Alaa..."
              rows="6"
              class="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <!-- Preview Section -->
        <div *ngIf="parsedNames.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-slate-700">Preview ({{ parsedNames.length }} names)</h3>
            <button (click)="clear()" class="text-xs text-red-500 hover:underline">Clear all</button>
          </div>
          <div class="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-slate-50/50 flex flex-wrap gap-2">
            <span *ngFor="let name of parsedNames; let i = index" class="px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700 flex items-center shadow-sm">
              {{ name }}
              <button (click)="removeName(i)" class="ml-1.5 text-slate-400 hover:text-red-500 transition-colors">
                <lucide-icon name="x" [size]="12"></lucide-icon>
              </button>
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100">
          <button (click)="onClose()" class="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button 
            (click)="onImport()" 
            [disabled]="parsedNames.length === 0 || importing"
            class="px-8 py-2.5 bg-primary hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <lucide-icon *ngIf="importing" name="loader" [size]="18" class="animate-spin mr-2"></lucide-icon>
            {{ importing ? 'Importing...' : 'Start Import' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-in {
      animation: enter 0.2s ease-out;
    }
    @keyframes enter {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class UserImportComponent {
  private userService = inject(UserService);
  private toastr = inject(ToastrService);

  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  rawNamesText = '';
  parsedNames: string[] = [];
  importing = false;

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      const namesFromExcel = jsonData
        .map(row => row.Name || row.name || row.Employee || row.employee || row['Full Name'])
        .filter(n => !!n && typeof n === 'string' && n.trim() !== '')
        .map(n => n.trim());

      this.addNames(namesFromExcel);
      event.target.value = ''; // Reset file input
    };
    reader.readAsArrayBuffer(file);
  }

  onTextChange() {
    // We don't automatically parse on every keystroke to avoid flickering, 
    // but the user might want immediate feedback.
    // Let's use a simpler logic for the text area.
    const names = this.rawNamesText
      .split(/[,\n]/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
    
    // We don't merge with parsedNames immediately to allow editing, 
    // but the preview should show them.
    this.parsedNames = Array.from(new Set([...names]));
  }

  addNames(newNames: string[]) {
    const merged = [...this.parsedNames, ...newNames];
    this.parsedNames = Array.from(new Set(merged));
    this.rawNamesText = this.parsedNames.join(', ');
  }

  removeName(index: number) {
    this.parsedNames.splice(index, 1);
    this.rawNamesText = this.parsedNames.join(', ');
  }

  clear() {
    this.parsedNames = [];
    this.rawNamesText = '';
  }

  onImport() {
    if (this.parsedNames.length === 0) return;

    this.importing = true;
    this.userService.importUsers(this.parsedNames).subscribe({
      next: (res) => {
        this.toastr.success(`Import complete! ${res.imported} users added, ${res.skipped} duplicates skipped.`);
        if (res.errors?.length) {
          console.warn('Import errors:', res.errors);
        }
        this.importing = false;
        this.imported.emit();
        this.onClose();
      },
      error: (err) => {
        this.toastr.error('Failed to import: ' + (err.error?.message || 'Server error'));
        this.importing = false;
      }
    });
  }

  downloadTemplate() {
    const data = [['Name'], ['Ali Algburi'], ['Ruqaya'], ['Mohamed Alaa']];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
  }

  onClose() {
    this.close.emit();
  }
}
