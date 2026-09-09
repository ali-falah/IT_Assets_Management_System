import { Injectable } from '@angular/core';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

export type LabelTemplate = 'standard' | 'compact' | 'qr';

export interface LabelData {
  name: string;
  serialNumber: string;
  categoryName?: string;
  locationName?: string;
  assignedUserName?: string;
  orgName?: string;
  showLocation?: boolean;
  showCategory?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AssetLabelService {
  defaultOrgName = 'IT ASSET MANAGEMENT';

  /**
   * Generates a base64 Data URL for a Code128 Barcode using an off-screen canvas.
   */
  generateBarcodeDataUrl(text: string, height: number = 44, width: number = 1.8): string {
    if (!text || text === '-') return '';
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: width,
        height: height,
        displayValue: false,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000'
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.warn('JsBarcode canvas error:', err);
      return '';
    }
  }

  /**
   * Generates a base64 Data URL for a 2D QR Code using an off-screen canvas.
   */
  async generateQrDataUrl(text: string, width: number = 240): Promise<string> {
    if (!text) return '';
    try {
      return await QRCode.toDataURL(text, {
        width: width,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });
    } catch (err) {
      console.warn('QRCode generation error:', err);
      return '';
    }
  }

  /**
   * Generates clean, printer-optimized HTML with inlined styles and base64 images.
   */
  generatePrintHtml(
    data: LabelData,
    template: LabelTemplate = 'standard',
    qrDataUrl: string,
    barcodeDataUrl: string
  ): string {
    const org = data.orgName || this.defaultOrgName;
    const serial = data.serialNumber || 'UNKNOWN';
    const name = data.name || 'Unnamed Asset';
    const category = data.showCategory !== false ? (data.categoryName || '') : '';
    const location = data.showLocation !== false ? (data.locationName || '') : '';

    let labelContent = '';

    if (template === 'standard') {
      // 70mm x 38mm Standard Asset Tag
      labelContent = `
        <div class="label-wrapper standard-label">
          <div class="tag-header">
            <span class="tag-brand">${org}</span>
            ${category ? `<span class="tag-cat">${category}</span>` : ''}
          </div>
          <div class="asset-title" title="${name}">${name}</div>
          <div class="main-row">
            ${qrDataUrl ? `
              <div class="qr-col">
                <img src="${qrDataUrl}" alt="QR" class="qr-img" />
              </div>
            ` : ''}
            <div class="details-col">
              <div class="serial-lbl">SERIAL NO.</div>
              <div class="serial-text">${serial}</div>
              ${barcodeDataUrl ? `
                <div class="barcode-wrap">
                  <img src="${barcodeDataUrl}" alt="Barcode" class="barcode-img" />
                </div>
              ` : ''}
              ${location ? `<div class="location-text">📍 ${location}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    } else if (template === 'compact') {
      // 50mm x 25mm Compact Barcode Tag
      labelContent = `
        <div class="label-wrapper compact-label">
          <div class="compact-header">
            <span class="tag-brand">${org}</span>
            ${category ? `<span class="tag-cat">${category}</span>` : ''}
          </div>
          <div class="compact-title">${name}</div>
          ${barcodeDataUrl ? `
            <div class="compact-barcode-wrap">
              <img src="${barcodeDataUrl}" alt="Barcode" class="compact-barcode-img" />
            </div>
          ` : ''}
          <div class="compact-footer">
            <span class="compact-serial">${serial}</span>
            ${location ? `<span class="compact-loc">${location}</span>` : ''}
          </div>
        </div>
      `;
    } else {
      // 35mm x 35mm Square QR Tag
      labelContent = `
        <div class="label-wrapper qr-label">
          <div class="qr-mini-header">${org}</div>
          ${qrDataUrl ? `
            <div class="qr-mini-box">
              <img src="${qrDataUrl}" alt="QR" class="qr-mini-img" />
            </div>
          ` : ''}
          <div class="qr-mini-serial">${serial}</div>
          <div class="qr-mini-name">${name}</div>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Asset Label - ${serial}</title>
  <style>
    @page {
      size: auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Standard Label: 70mm x 38mm (Approx 265px x 144px at 96dpi) */
    .standard-label {
      width: 70mm;
      height: 38mm;
      max-width: 70mm;
      max-height: 38mm;
      padding: 2.5mm 3.5mm;
      border: 1.5px solid #000000;
      border-radius: 2mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .tag-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1.5px;
      margin-bottom: 2px;
    }
    .tag-brand {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #000000;
    }
    .tag-cat {
      font-size: 7.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #334155;
      background: #f1f5f9;
      padding: 0.5px 3px;
      border-radius: 2px;
    }
    .asset-title {
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      color: #000000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }
    .main-row {
      display: flex;
      align-items: center;
      gap: 3mm;
      flex: 1;
      min-height: 0;
    }
    .qr-col {
      width: 22mm;
      height: 22mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e2e8f0;
      border-radius: 1.5mm;
      padding: 1px;
      background: #ffffff;
    }
    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .details-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .serial-lbl {
      font-size: 7px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .serial-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .barcode-wrap {
      margin-top: 1.5px;
      width: 100%;
    }
    .barcode-img {
      width: 100%;
      height: 24px;
      object-fit: fill;
      display: block;
    }
    .location-text {
      font-size: 7.5px;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1.5px;
    }

    /* Compact Label: 50mm x 25mm */
    .compact-label {
      width: 50mm;
      height: 25mm;
      max-width: 50mm;
      max-height: 25mm;
      padding: 2mm 2.5mm;
      border: 1.5px solid #000000;
      border-radius: 1.5mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .compact-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 7px;
      font-weight: 800;
      text-transform: uppercase;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 1px;
    }
    .compact-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #000000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .compact-barcode-wrap {
      width: 100%;
      margin: 1px 0;
    }
    .compact-barcode-img {
      width: 100%;
      height: 20px;
      object-fit: fill;
      display: block;
    }
    .compact-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 7.5px;
    }
    .compact-serial {
      font-family: ui-monospace, monospace;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .compact-loc {
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50%;
    }

    /* Square QR Label: 35mm x 35mm */
    .qr-label {
      width: 35mm;
      height: 35mm;
      max-width: 35mm;
      max-height: 35mm;
      padding: 2mm;
      border: 1.5px solid #000000;
      border-radius: 1.5mm;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .qr-mini-header {
      font-size: 6.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .qr-mini-box {
      width: 20mm;
      height: 20mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-mini-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .qr-mini-serial {
      font-family: ui-monospace, monospace;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }
    .qr-mini-name {
      font-size: 6.5px;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
    }

    @media print {
      body {
        padding: 0;
        background: transparent;
      }
      .label-wrapper {
        border-color: #000000 !important;
      }
    }
  </style>
</head>
<body>
  ${labelContent}
</body>
</html>`;
  }

  /**
   * Bulletproof print execution using an invisible iframe.
   * Does NOT trigger popup blockers, works offline, and requires no external network resources.
   */
  printLabel(
    data: LabelData,
    template: LabelTemplate = 'standard',
    qrDataUrl: string,
    barcodeDataUrl: string
  ): void {
    const html = this.generatePrintHtml(data, template, qrDataUrl, barcodeDataUrl);

    let iframe = document.getElementById('asset-label-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'asset-label-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      // Fallback
      const fallbackWindow = window.open('', '_blank');
      if (fallbackWindow) {
        fallbackWindow.document.open();
        fallbackWindow.document.write(html);
        fallbackWindow.document.close();
        setTimeout(() => {
          fallbackWindow.focus();
          fallbackWindow.print();
        }, 300);
      }
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Base64 images are inlined synchronously, give a small buffer for layout calculation
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.open print:', err);
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          setTimeout(() => {
            win.focus();
            win.print();
          }, 300);
        }
      }
    }, 200);
  }

  /**
   * Render label directly to a high-resolution canvas (300 DPI) and download as PNG.
   */
  async downloadLabelPng(
    data: LabelData,
    template: LabelTemplate = 'standard',
    qrDataUrl: string,
    barcodeDataUrl: string
  ): Promise<void> {
    const org = data.orgName || this.defaultOrgName;
    const serial = data.serialNumber || 'UNKNOWN';
    const name = data.name || 'Unnamed Asset';
    const category = data.showCategory !== false ? (data.categoryName || '') : '';
    const location = data.showLocation !== false ? (data.locationName || '') : '';

    // Standard: 70mm x 38mm at ~300 DPI = 826 x 448 px
    let canvasWidth = 826;
    let canvasHeight = 448;

    if (template === 'compact') {
      // 50mm x 25mm = 590 x 295 px
      canvasWidth = 590;
      canvasHeight = 295;
    } else if (template === 'qr') {
      // 35mm x 35mm = 413 x 413 px
      canvasWidth = 413;
      canvasHeight = 413;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20);

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    if (template === 'standard') {
      // Header
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(org, 30, 48);

      if (category) {
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 18px sans-serif';
        const catWidth = ctx.measureText(category).width;
        ctx.fillText(category, canvasWidth - 30 - catWidth, 48);
      }

      // Divider
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, 62);
      ctx.lineTo(canvasWidth - 30, 62);
      ctx.stroke();

      // Asset Name
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 28px sans-serif';
      let displayName = name;
      while (ctx.measureText(displayName).width > canvasWidth - 60 && displayName.length > 3) {
        displayName = displayName.slice(0, -4) + '...';
      }
      ctx.fillText(displayName, 30, 100);

      // QR Code
      if (qrDataUrl) {
        try {
          const qrImg = await loadImage(qrDataUrl);
          ctx.drawImage(qrImg, 30, 120, 240, 240);
        } catch (e) {
          console.warn('Could not draw QR code onto canvas:', e);
        }
      }

      // Serial Title
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('SERIAL NO.', 295, 140);

      // Serial Value
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(serial, 295, 178);

      // Barcode
      if (barcodeDataUrl) {
        try {
          const barImg = await loadImage(barcodeDataUrl);
          ctx.drawImage(barImg, 295, 195, 490, 100);
        } catch (e) {
          console.warn('Could not draw barcode onto canvas:', e);
        }
      }

      // Location
      if (location) {
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('📍 ' + location, 295, 335);
      }
    } else if (template === 'compact') {
      // Header
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(org, 25, 38);

      // Asset Name
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px sans-serif';
      let compactName = name;
      while (ctx.measureText(compactName).width > canvasWidth - 50 && compactName.length > 3) {
        compactName = compactName.slice(0, -4) + '...';
      }
      ctx.fillText(compactName, 25, 75);

      // Barcode
      if (barcodeDataUrl) {
        try {
          const barImg = await loadImage(barcodeDataUrl);
          ctx.drawImage(barImg, 25, 90, canvasWidth - 50, 110);
        } catch (e) {}
      }

      // Serial & Location
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(serial, 25, 245);

      if (location) {
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 18px sans-serif';
        const locWidth = ctx.measureText(location).width;
        ctx.fillText(location, canvasWidth - 25 - locWidth, 245);
      }
    } else {
      // Square QR Tag
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px sans-serif';
      const orgWidth = ctx.measureText(org).width;
      ctx.fillText(org, (canvasWidth - orgWidth) / 2, 40);

      if (qrDataUrl) {
        try {
          const qrImg = await loadImage(qrDataUrl);
          ctx.drawImage(qrImg, (canvasWidth - 250) / 2, 55, 250, 250);
        } catch (e) {}
      }

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px monospace';
      const serWidth = ctx.measureText(serial).width;
      ctx.fillText(serial, (canvasWidth - serWidth) / 2, 340);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 18px sans-serif';
      let qrName = name;
      while (ctx.measureText(qrName).width > canvasWidth - 40 && qrName.length > 3) {
        qrName = qrName.slice(0, -4) + '...';
      }
      const nameWidth = ctx.measureText(qrName).width;
      ctx.fillText(qrName, (canvasWidth - nameWidth) / 2, 380);
    }

    // Trigger download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Asset-Label-${serial.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
