/**
 * PDF Generator Service
 * Generates PDF documents using pdfkit with Chinese font support
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei-standalone.ttf';
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/documents');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const COLORS = {
  primary: '#1a73e8',
  dark: '#202124',
  gray: '#5f6368',
  lightGray: '#dadce0',
  accent: '#00a884',
  white: '#ffffff',
  tableBg: '#f8f9fa'
};

/**
 * Generate a generic PDF from structured content
 */
export async function generateStructuredPDF({ title, subtitle, sections = [], options = {} }) {
  const filename = `doc-${Date.now()}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      bufferPages: true 
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.registerFont('ZH', FONT_PATH);

    // Header
    let yPos = 45;
    if (options.companyName) {
      doc.font('ZH').fontSize(10).fillColor(COLORS.gray)
        .text(options.companyName, 50, yPos, { width: 250 });
    }
    if (options.date) {
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text(options.date, 350, yPos, { width: 200, align: 'right' });
    }
    yPos = options.companyName ? 70 : 50;

    // Title
    doc.font('ZH').fontSize(20).fillColor(COLORS.dark)
      .text(title || 'Document', 50, yPos, { width: 500 });
    yPos = doc.y + 6;

    if (subtitle) {
      doc.font('ZH').fontSize(11).fillColor(COLORS.gray)
        .text(subtitle, 50, yPos, { width: 500 });
      yPos = doc.y + 8;
    }

    // Divider
    doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor(COLORS.lightGray).lineWidth(1).stroke();
    yPos += 15;
    doc.y = yPos;

    // Render sections
    for (const section of sections) {
      if (doc.y > 720) doc.addPage();

      switch (section.type) {
        case 'heading':
          doc.font('ZH').fontSize(14).fillColor(COLORS.primary)
            .text(section.content || '', 50, doc.y, { width: 500 });
          doc.moveDown(0.3);
          break;
        case 'paragraph':
          doc.font('ZH').fontSize(11).fillColor(COLORS.dark)
            .text(section.content || '', 50, doc.y, { width: 500, lineGap: 4 });
          doc.moveDown(0.5);
          break;
        case 'bullet-list':
          for (const item of (section.items || [])) {
            if (doc.y > 740) doc.addPage();
            doc.font('ZH').fontSize(11).fillColor(COLORS.dark)
              .text(`•  ${item}`, 60, doc.y, { width: 480, lineGap: 3 });
          }
          doc.moveDown(0.4);
          break;
        case 'table':
          renderTable(doc, section.headers || [], section.rows || []);
          doc.moveDown(0.5);
          break;
        case 'divider':
          doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5)
            .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
          doc.moveDown(0.8);
          break;
        default:
          if (section.content) {
            doc.font('ZH').fontSize(11).fillColor(COLORS.dark)
              .text(section.content, 50, doc.y, { width: 500, lineGap: 4 });
            doc.moveDown(0.4);
          }
      }
    }

    // Footer with page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('ZH').fontSize(8).fillColor(COLORS.gray)
        .text(`${i + 1} / ${pages.count}`, 50, 780, { width: 500, align: 'center' });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { url: `/uploads/documents/${filename}`, filename };
}

/**
 * Generate a Quote/PI PDF from existing document data
 */
export async function generateQuotePDF(doc_data) {
  const filename = `quote-${doc_data.docNumber || Date.now()}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 50, bottom: 50, left: 45, right: 45 },
      bufferPages: true 
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.registerFont('ZH', FONT_PATH);

    const seller = doc_data.sellerInfo || {};
    const buyer = doc_data.buyerInfo || {};
    const items = doc_data.items || [];
    const isPI = doc_data.type === 'PI';

    // Header
    doc.font('ZH').fontSize(14).fillColor(COLORS.dark)
      .text(seller.companyName || '', 45, 40, { width: 350 });
    doc.font('ZH').fontSize(8).fillColor(COLORS.gray)
      .text(seller.address || '', 45, doc.y + 2, { width: 350 });
    if (seller.email) {
      doc.font('ZH').fontSize(8).fillColor(COLORS.gray)
        .text(seller.email, 45, doc.y + 2, { width: 350 });
    }

    // Doc number & date (top right)
    doc.font('ZH').fontSize(16).fillColor(COLORS.primary)
      .text(isPI ? 'PROFORMA INVOICE' : 'QUOTATION', 350, 40, { width: 200, align: 'right' });
    doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
      .text(`No: ${doc_data.docNumber || ''}`, 350, doc.y + 4, { width: 200, align: 'right' });
    doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
      .text(`Date: ${doc_data.issueDate ? new Date(doc_data.issueDate).toISOString().split('T')[0] : ''}`, 350, doc.y + 2, { width: 200, align: 'right' });
    if (doc_data.validUntil) {
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text(`Valid Until: ${new Date(doc_data.validUntil).toISOString().split('T')[0]}`, 350, doc.y + 2, { width: 200, align: 'right' });
    }

    // Buyer info
    doc.moveDown(1.5);
    doc.font('ZH').fontSize(10).fillColor(COLORS.dark).text('Bill To:', 45, doc.y, { width: 250 });
    doc.font('ZH').fontSize(10).fillColor(COLORS.dark)
      .text(buyer.companyName || buyer.contactName || 'N/A', 45, doc.y + 2, { width: 250 });
    if (buyer.address) doc.font('ZH').fontSize(9).fillColor(COLORS.gray).text(buyer.address, 45, doc.y + 1, { width: 250 });
    if (buyer.contactName) doc.font('ZH').fontSize(9).fillColor(COLORS.gray).text(`Attn: ${buyer.contactName}`, 45, doc.y + 1, { width: 250 });
    if (buyer.email) doc.font('ZH').fontSize(9).fillColor(COLORS.gray).text(buyer.email, 45, doc.y + 1, { width: 250 });

    // Trade terms
    doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
      .text(`Trade Term: ${doc_data.tradeTerm || 'FOB'}  |  Payment: ${doc_data.paymentTerm || 'T/T'}  |  Loading Port: ${doc_data.portOfLoading || ''}`, 45, doc.y + 4, { width: 510 });

    // Items table
    doc.moveDown(1);
    const colWidths = [30, 160, 80, 60, 70, 70, 40];
    const headers = ['#', 'Product', 'Model/Spec', 'Unit', 'Qty', 'Unit Price', 'Amount'];
    const startX = 45;
    
    // Table header
    let x = startX;
    const thY = doc.y;
    doc.font('ZH').fontSize(9).fillColor(COLORS.white);
    for (let i = 0; i < headers.length; i++) {
      doc.rect(x, thY, colWidths[i], 22).fill(COLORS.primary);
      doc.fillColor(COLORS.white).text(headers[i], x + 3, thY + 6, { width: colWidths[i] - 6 });
      x += colWidths[i];
    }
    doc.y = thY + 24;

    // Table rows
    for (let i = 0; i < items.length; i++) {
      if (doc.y > 700) doc.addPage();
      const item = items[i];
      const rowY = doc.y;
      const bg = i % 2 === 0 ? COLORS.tableBg : '#ffffff';
      x = startX;
      doc.font('ZH').fontSize(9).fillColor(COLORS.dark);
      
      const cells = [
        String(i + 1),
        item.productName || '',
        `${item.model || ''} ${item.spec || ''}`.trim(),
        item.unit || 'pcs',
        String(item.quantity || ''),
        `${doc_data.currency || '$'}${Number(item.unitPrice || 0).toFixed(2)}`,
        `${doc_data.currency || '$'}${Number(item.amount || 0).toFixed(2)}`
      ];
      
      for (let j = 0; j < cells.length; j++) {
        doc.rect(x, rowY, colWidths[j], 20).fill(bg);
        doc.fillColor(COLORS.dark).text(cells[j], x + 3, rowY + 5, { width: colWidths[j] - 6 });
        x += colWidths[j];
      }
      doc.y = rowY + 22;
    }

    // Total
    doc.moveDown(0.5);
    doc.font('ZH').fontSize(12).fillColor(COLORS.dark)
      .text(`Total: ${doc_data.currency || 'USD'} ${Number(doc_data.totalAmount || 0).toFixed(2)}`, 350, doc.y, { width: 200, align: 'right' });
    if (doc_data.amountInWords) {
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text(`( ${doc_data.amountInWords} )`, 350, doc.y + 2, { width: 200, align: 'right' });
    }

    // Remarks
    if (doc_data.remarks) {
      doc.moveDown(1.5);
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text('Remarks:', 45, doc.y, { width: 510 });
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text(doc_data.remarks, 45, doc.y + 2, { width: 510, lineGap: 2 });
    }

    // Footer
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('ZH').fontSize(8).fillColor(COLORS.gray)
        .text(`${i + 1} / ${pages.count}`, 45, 780, { width: 510, align: 'center' });
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { url: `/uploads/documents/${filename}`, filename };
}

/**
 * Render a table in the PDF
 */
function renderTable(doc, headers, rows) {
  if (headers.length === 0) return;
  const colWidth = Math.floor(500 / headers.length);
  const startX = 50;

  // Header row
  let x = startX;
  const hY = doc.y;
  doc.font('ZH').fontSize(10).fillColor(COLORS.white);
  for (const h of headers) {
    doc.rect(x, hY, colWidth - 2, 22).fill(COLORS.primary);
    doc.fillColor(COLORS.white).text(String(h), x + 4, hY + 5, { width: colWidth - 10 });
    x += colWidth;
  }
  doc.y = hY + 24;

  // Data rows
  for (let i = 0; i < rows.length; i++) {
    if (doc.y > 740) doc.addPage();
    const bg = i % 2 === 0 ? COLORS.tableBg : '#ffffff';
    x = startX;
    const rY = doc.y;
    doc.font('ZH').fontSize(10).fillColor(COLORS.dark);
    for (const cell of rows[i]) {
      doc.rect(x, rY, colWidth - 2, 20).fill(bg);
      doc.fillColor(COLORS.dark).text(String(cell), x + 4, rY + 4, { width: colWidth - 10 });
      x += colWidth;
    }
    doc.y = rY + 22;
  }
}
