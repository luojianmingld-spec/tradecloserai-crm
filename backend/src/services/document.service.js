const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONT_PATH = '/usr/share/fonts/truetype/wqy/wqy-zenhei-standalone.ttf';
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'documents');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Generate a PDF document from structured content
 * @param {Object} params
 * @param {string} params.title - Document title
 * @param {string} params.subtitle - Optional subtitle
 * @param {Array} params.sections - Array of {type, content, items, ...}
 * @param {Object} params.options - Additional options (companyName, date, etc.)
 * @returns {Promise<{url: string, filename: string}>}
 */
async function generatePDF({ title, subtitle, sections = [], options = {} }) {
  const timestamp = Date.now();
  const filename = `doc-${timestamp}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      bufferPages: true 
    });
    
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Register Chinese font
    doc.registerFont('ZH', FONT_PATH);

    // Colors
    const COLORS = {
      primary: '#1a73e8',
      dark: '#202124',
      gray: '#5f6368',
      lightGray: '#dadce0',
      accent: '#00a884',
      white: '#ffffff'
    };

    // --- Header ---
    if (options.companyName) {
      doc.font('ZH').fontSize(10).fillColor(COLORS.gray)
        .text(options.companyName, 50, 40, { width: 200 });
    }
    
    if (options.date) {
      doc.font('ZH').fontSize(9).fillColor(COLORS.gray)
        .text(options.date, 400, 40, { width: 150, align: 'right' });
    }

    // --- Title ---
    let yPos = options.companyName ? 70 : 50;
    doc.font('ZH').fontSize(22).fillColor(COLORS.dark)
      .text(title || 'Untitled', 50, yPos, { width: 500, align: 'left' });
    yPos = doc.y + 8;

    // --- Subtitle ---
    if (subtitle) {
      doc.font('ZH').fontSize(12).fillColor(COLORS.gray)
        .text(subtitle, 50, yPos, { width: 500 });
      yPos = doc.y + 10;
    }

    // Divider line
    doc.moveTo(50, yPos).lineTo(550, yPos).strokeColor(COLORS.lightGray).lineWidth(1).stroke();
    yPos += 15;

    // --- Sections ---
    for (const section of sections) {
      // Check if we need a new page
      if (doc.y > 720) {
        doc.addPage();
        yPos = 60;
      }

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
          const items = section.items || [];
          for (const item of items) {
            if (doc.y > 740) { doc.addPage(); }
            doc.font('ZH').fontSize(11).fillColor(COLORS.dark)
              .text(`•  ${item}`, 60, doc.y, { width: 480, lineGap: 3 });
          }
          doc.moveDown(0.5);
          break;

        case 'table':
          const headers = section.headers || [];
          const rows = section.rows || [];
          const colWidth = Math.floor(500 / Math.max(headers.length, 1));
          
          // Table header
          if (headers.length > 0) {
            doc.font('ZH').fontSize(10).fillColor(COLORS.white);
            let x = 50;
            const headerY = doc.y;
            for (const h of headers) {
              doc.rect(x, headerY, colWidth - 2, 24).fill(COLORS.primary);
              doc.fillColor(COLORS.white).text(h, x + 5, headerY + 6, { width: colWidth - 12, align: 'left' });
              x += colWidth;
            }
            doc.y = headerY + 28;
          }

          // Table rows
          for (let i = 0; i < rows.length; i++) {
            if (doc.y > 740) { doc.addPage(); }
            const bgColor = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
            let x = 50;
            const rowY = doc.y;
            doc.font('ZH').fontSize(10).fillColor(COLORS.dark);
            for (const cell of rows[i]) {
              doc.rect(x, rowY, colWidth - 2, 22).fill(bgColor);
              doc.fillColor(COLORS.dark).text(String(cell), x + 5, rowY + 5, { width: colWidth - 12 });
              x += colWidth;
            }
            doc.y = rowY + 24;
          }
          doc.moveDown(0.5);
          break;

        case 'divider':
          doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5)
            .strokeColor(COLORS.lightGray).lineWidth(0.5).stroke();
          doc.moveDown(0.8);
          break;

        case 'quote':
          doc.rect(55, doc.y, 3, 40).fill(COLORS.accent);
          doc.font('ZH').fontSize(11).fillColor(COLORS.gray)
            .text(section.content || '', 68, doc.y, { width: 470, lineGap: 3 });
          doc.moveDown(0.5);
          break;

        default:
          if (section.content) {
            doc.font('ZH').fontSize(11).fillColor(COLORS.dark)
              .text(section.content, 50, doc.y, { width: 500, lineGap: 4 });
            doc.moveDown(0.5);
          }
      }
    }

    // --- Footer ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.font('ZH').fontSize(8).fillColor(COLORS.gray)
        .text(`Page ${i + 1} / ${pages.count}`, 50, 780, { width: 500, align: 'center' });
    }

    doc.end();

    stream.on('finish', () => {
      const url = `/uploads/documents/${filename}`;
      resolve({ url, filename, size: fs.statSync(filePath).size });
    });

    stream.on('error', reject);
  });
}

/**
 * Generate a quote/PI document
 */
async function generateQuote({ customer, items, notes, companyName }) {
  const sections = [
    { type: 'heading', content: 'Customer Information' },
    { type: 'paragraph', content: `Customer: ${customer.name || 'N/A'}` },
    { type: 'paragraph', content: `Contact: ${customer.contact || ''}` },
    { type: 'paragraph', content: `Email: ${customer.email || ''}` },
    { type: 'divider' },
    { type: 'heading', content: 'Product Quotation' },
    { type: 'table', headers: ['Product', 'Spec', 'Qty', 'Unit Price', 'Total'], rows: [] }
  ];

  // Build table rows
  let grandTotal = 0;
  for (const item of items) {
    const total = (item.price || 0) * (item.qty || 0);
    grandTotal += total;
    sections[4].rows.push([
      item.name || '',
      item.spec || '',
      String(item.qty || ''),
      `$${(item.price || 0).toFixed(2)}`,
      `$${total.toFixed(2)}`
    ]);
  }

  sections.push({ type: 'divider' });
  sections.push({ type: 'paragraph', content: `Grand Total: $${grandTotal.toFixed(2)}` });

  if (notes) {
    sections.push({ type: 'heading', content: 'Notes' });
    sections.push({ type: 'paragraph', content: notes });
  }

  return generatePDF({
    title: 'Proforma Invoice / Quotation',
    subtitle: `Date: ${new Date().toISOString().split('T')[0]}`,
    sections,
    options: { companyName, date: new Date().toLocaleDateString() }
  });
}

/**
 * List all generated documents
 */
function listDocuments() {
  const files = fs.readdirSync(UPLOAD_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => {
      const stat = fs.statSync(path.join(UPLOAD_DIR, f));
      return {
        filename: f,
        url: `/uploads/documents/${f}`,
        size: stat.size,
        createdAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return files;
}

module.exports = { generatePDF, generateQuote, listDocuments };
