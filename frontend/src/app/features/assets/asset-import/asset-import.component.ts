import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { AssetService } from '../../../core/services/asset.service';
import { MasterDataService } from '../../../core/services/master-data.service';

interface ImportRow {
  name: string;
  serialNumber: string;
  status: string;
  location?: string;
  category?: string;
  notes?: string;
}

@Component({
  selector: 'app-asset-import',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FormsModule],
  templateUrl: './asset-import.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetImportComponent implements OnInit {
  private assetService = inject(AssetService);
  private masterDataService = inject(MasterDataService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

  // Master Data
  locations: any[] = [];
  categories: any[] = [];
  statuses: any[] = [];

  // Quick Paste Options
  quickPasteText = '';
  bulkLocationId = '';
  bulkCategory = '';
  bulkStatus = '';

  previewData: ImportRow[] = [];
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

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Skip header row and map data
      // Expected columns: Name, Serial, Status, Notes, Location
      const rawRows = jsonData.slice(1);

      this.previewData = rawRows
        .filter(row => {
          const hasName = !!row[0];
          const hasSerial = !!row[1] && String(row[1]).trim() !== '' && String(row[1]).trim() !== '--';
          return hasName && hasSerial;
        })
        .map(row => ({
          name: String(row[0] || ''),
          serialNumber: String(row[1] || '').trim(),
          status: String(row[2] || 'Stock'),
          notes: String(row[3] || ''),
          location: String(row[4] || '')
        }));

      if (rawRows.length > this.previewData.length) {
        console.warn(`${rawRows.length - this.previewData.length} rows were ignored because they were missing a Name or a valid Serial Number (e.g. empty or '--').`);
      }

      if (this.previewData.length === 0) {
        this.toastr.warning('No valid data found in the Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  onImport() {
    if (!this.previewData.length) return;

    this.importing = true;
    this.cdr.markForCheck();
    this.assetService.importAssets(this.previewData).subscribe({
      next: (res) => {
        this.toastr.success(`Successfully imported ${res.imported} assets. ${res.skipped} skipped.`);
        if (res.errors?.length) {
          console.warn('Import errors:', res.errors);
        }
        this.importing = false;
        this.imported.emit();
        this.onClose();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.toastr.error('Failed to import assets: ' + (err.error?.message || 'Server error'));
        this.importing = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    this.loadMasterData();
  }

  loadMasterData() {
    this.cdr.markForCheck();
    this.masterDataService.getLocations().subscribe(res => {
      this.locations = res;
      this.cdr.detectChanges();
    });
    this.masterDataService.getCategories().subscribe(res => {
      this.categories = res;
      this.cdr.detectChanges();
    });
    this.masterDataService.getStatuses().subscribe(res => {
      this.statuses = res;
      this.cdr.detectChanges();
    });
  }

  onQuickPasteProcess() {
    if (!this.quickPasteText.trim()) return;

    const lines = this.quickPasteText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      this.toastr.warning('No valid lines found to import');
      return;
    }

    const parsedRows: ImportRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let name = '';
      let serial = '';

      // Support multi-format separators: Tab (\t), Colon (:), or Pipe (|)
      if (line.includes('\t')) {
        const parts = line.split('\t');
        name = parts[0].trim();
        serial = parts.slice(1).join('\t').trim();
      } else if (line.includes(':')) {
        const parts = line.split(':');
        name = parts[0].trim();
        serial = parts.slice(1).join(':').trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        name = parts[0].trim();
        serial = parts.slice(1).join('|').trim();
      }

      if (!name || !serial) {
        errors.push(`Line ${i + 1}: "${line}" is missing a serial number. Format: "Name : Serial"`);
        continue;
      }

      parsedRows.push({
        name,
        serialNumber: serial,
        status: this.bulkStatus,
        location: this.bulkLocationId,
        category: this.bulkCategory,
        notes: 'Quick pasted asset'
      });
    }

    if (errors.length > 0) {
      // Toast the first 3 errors so we don't overwhelm the user
      errors.slice(0, 3).forEach(err => this.toastr.error(err));
      if (errors.length > 3) {
        this.toastr.error(`...and ${errors.length - 3} other lines have parsing issues.`);
      }
      return;
    }

    this.previewData = parsedRows;
  }

  downloadTemplate() {
    const data = [
      ['Model Name/Number', 'Serial Number', 'Status', 'Comments/Notes', 'Location'],
      ['Xerox Workcentre 7545', 'SN123456789', 'In-Use', 'Main office printer', 'Rumila Office'],
      ['Cisco Catalyst 2960-X', 'FCW224CB435', 'In-Use', 'Network switch', 'Rumila Office'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Asset_Import_Template.xlsx');
  }

  reset() {
    this.previewData = [];
    this.quickPasteText = '';
    this.bulkLocationId = '';
    this.bulkCategory = '';
    this.bulkStatus = '';
  }

  onClose() {
    this.close.emit();
  }
}
