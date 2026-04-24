import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import * as XLSX from 'xlsx';
import { AssetService } from '../../../core/services/asset.service';
import { ToastrService } from 'ngx-toastr';

interface ImportRow {
  name: string;
  serialNumber: string;
  status: string;
  location?: string;
  notes?: string;
}

@Component({
  selector: 'app-asset-import',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './asset-import.component.html'
})
export class AssetImportComponent {
  private assetService = inject(AssetService);
  private toastr = inject(ToastrService);

  @Output() close = new EventEmitter<void>();
  @Output() imported = new EventEmitter<void>();

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
    this.assetService.importAssets(this.previewData).subscribe({
      next: (res) => {
        this.toastr.success(`Successfully imported ${res.imported} assets. ${res.skipped} skipped.`);
        if (res.errors?.length) {
          console.warn('Import errors:', res.errors);
        }
        this.importing = false;
        this.imported.emit();
        this.onClose();
      },
      error: (err) => {
        this.toastr.error('Failed to import assets: ' + (err.error?.message || 'Server error'));
        this.importing = false;
      }
    });
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
  }

  onClose() {
    this.close.emit();
  }
}
