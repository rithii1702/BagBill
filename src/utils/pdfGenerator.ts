import jsPDF from 'jspdf';
import type { Invoice, BusinessSettings } from '../types';
import { formatINR, formatDate } from './formatters';
import { numberToWordsINR } from './numberToWords';
import { fontRegularBase64, fontBoldBase64 } from './pdfFonts';

export function generateInvoicePDF(invoice: Invoice, settings: BusinessSettings): jsPDF {
  const business: BusinessSettings = {
    ...settings,
    ...(invoice.businessSnapshot || {}),
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register TrueType fonts supporting English + Indian Rupee symbol (₹)
  doc.addFileToVFS('BagFont-Regular.ttf', fontRegularBase64);
  doc.addFont('BagFont-Regular.ttf', 'BagFont', 'normal');
  doc.addFileToVFS('BagFont-Bold.ttf', fontBoldBase64);
  doc.addFont('BagFont-Bold.ttf', 'BagFont', 'bold');

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Background subtle kraft/paper tint (#FFFDF8)
  doc.setFillColor(255, 253, 248);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2, 'F');

  // Outer border (#E4D7C8)
  doc.setDrawColor(228, 215, 200);
  doc.setLineWidth(0.6);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2, 'S');

  // Top header banner (#3B2921 Dark Brown)
  doc.setFillColor(59, 41, 33);
  doc.rect(margin, margin, contentWidth, 22, 'F');

  let textStartX = margin + 8;
  if (business.showBusinessLogo !== false && business.logoUrl) {
    try {
      doc.addImage(business.logoUrl, margin + 4, margin + 2.5, 17, 17);
      textStartX = margin + 25;
    } catch (e) {
      console.warn('Could not add logo image to PDF', e);
    }
  }

  doc.setTextColor(255, 253, 248);
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(15);
  doc.text(business.businessName.toUpperCase(), textStartX, margin + 9);

  doc.setFont('BagFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(201, 149, 99); // #C99563 Kraft
  doc.text(business.tagline || 'Wholesale Bag Manufacturer & Merchant', textStartX, margin + 15);

  // Right Tax Invoice Badge
  doc.setTextColor(255, 255, 255);
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(13);
  doc.text('TAX INVOICE', pageWidth - margin - 8, margin + 10, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('BagFont', 'normal');
  doc.text('ORIGINAL FOR RECIPIENT', pageWidth - margin - 8, margin + 16, { align: 'right' });

  let y = margin + 27;

  // Supplier & Invoice Metadata Box (#F7F3EA)
  doc.setDrawColor(228, 215, 200);
  doc.setFillColor(247, 243, 234);
  doc.roundedRect(margin + 4, y, contentWidth - 8, 30, 2, 2, 'FD');

  // Left side: Supplier Details
  doc.setTextColor(44, 33, 27);
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(8.5);
  doc.text('Supplier Details:', margin + 8, y + 6);
  doc.setFont('BagFont', 'normal');
  doc.setFontSize(8);
  doc.text(`${business.address}, ${business.city}, ${business.state} - ${business.pincode}`, margin + 8, y + 11);
  doc.text(`Phone: ${business.phone}  |  Email: ${business.email}`, margin + 8, y + 16);
  doc.setFont('BagFont', 'bold');
  doc.text(`GSTIN: ${business.gstin}`, margin + 8, y + 21);
  doc.text(`PAN: ${business.panNumber}`, margin + 8, y + 26);

  // Right side: Invoice Info
  const rightColX = pageWidth - margin - 62;
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(8.5);
  doc.text('Invoice Details:', rightColX, y + 6);
  doc.setFont('BagFont', 'normal');
  doc.setFontSize(8);
  doc.text('Invoice No:', rightColX, y + 11);
  doc.setFont('BagFont', 'bold');
  doc.text(invoice.invoiceNumber, rightColX + 22, y + 11);

  doc.setFont('BagFont', 'normal');
  doc.text('Date:', rightColX, y + 16);
  doc.text(formatDate(invoice.date), rightColX + 22, y + 16);

  doc.text('Place of Supply:', rightColX, y + 21);
  doc.text(business.state, rightColX + 24, y + 21);

  doc.text('Status:', rightColX, y + 26);
  if (invoice.paymentStatus === 'Paid') {
    doc.setTextColor(79, 125, 90);
  } else if (invoice.paymentStatus === 'Pending') {
    doc.setTextColor(185, 74, 72);
  } else {
    doc.setTextColor(201, 130, 50);
  }
  doc.setFont('BagFont', 'bold');
  doc.text(invoice.paymentStatus.toUpperCase(), rightColX + 22, y + 26);

  y += 33;

  // Bill To (Party Details)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(228, 215, 200);
  doc.roundedRect(margin + 4, y, contentWidth - 8, 22, 2, 2, 'FD');

  doc.setTextColor(59, 41, 33);
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(8.5);
  doc.text('BILL TO / BUYER DETAILS:', margin + 8, y + 5.5);

  doc.setTextColor(44, 33, 27);
  doc.setFontSize(9.5);
  doc.text(invoice.partyName || 'Cash / Counter Customer', margin + 8, y + 11.5);

  doc.setFont('BagFont', 'normal');
  doc.setFontSize(8);
  doc.text(`Address: ${invoice.partyAddress || 'Local Market'}`, margin + 8, y + 16.5);
  doc.text(`Contact: ${invoice.partyPhone || 'N/A'}`, margin + 8, y + 20.5);

  if (invoice.partyGstin) {
    doc.setFont('BagFont', 'bold');
    doc.text(`Party GSTIN: ${invoice.partyGstin}`, pageWidth - margin - 70, y + 16.5);
  }

  y += 26;

  // Table Header (#8B5E3C Secondary Brown)
  // Total table width: 174mm (from margin + 4 = 18 to pageWidth - margin - 4 = 192)
  doc.setFillColor(139, 94, 60);
  doc.rect(margin + 4, y, contentWidth - 8, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('BagFont', 'bold');
  doc.setFontSize(8);
  doc.text('#', 23, y + 5.5, { align: 'center' });
  doc.text('Bag Description', 29, y + 5.5);
  doc.text('HSN/SAC', 88, y + 5.5, { align: 'center' });
  doc.text('Quantity', 108, y + 5.5, { align: 'center' });
  doc.text('Rate (₹)', 138, y + 5.5, { align: 'right' });
  doc.text('Disc %', 150, y + 5.5, { align: 'center' });
  doc.text('GST %', 166, y + 5.5, { align: 'center' });
  doc.text('Amount', 190, y + 5.5, { align: 'right' });

  y += 8;

  // Table Rows
  doc.setTextColor(44, 33, 27);
  invoice.items.forEach((item, index) => {
    const rowY = y + index * 7.5;
    
    // Zebra background
    if (index % 2 === 1) {
      doc.setFillColor(247, 243, 234);
      doc.rect(margin + 4, rowY, contentWidth - 8, 7.5, 'F');
    }

    doc.setDrawColor(240, 232, 222);
    doc.line(margin + 4, rowY + 7.5, pageWidth - margin - 4, rowY + 7.5);

    doc.setFont('BagFont', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(44, 33, 27);
    doc.text(String(index + 1), 23, rowY + 5, { align: 'center' });
    
    // Product Name (clipped to 48mm max width so it never touches HSN/SAC)
    doc.setFont('BagFont', 'bold');
    const descText = doc.splitTextToSize(item.bagType, 48)[0] || item.bagType;
    doc.text(descText, 29, rowY + 5);

    doc.setFont('BagFont', 'normal');
    doc.text(item.hsnCode || '6305', 88, rowY + 5, { align: 'center' });
    doc.text(`${item.quantity} ${item.unit || 'Bags'}`, 108, rowY + 5, { align: 'center' });
    doc.text(formatINR(item.pricePerBag, true, true), 138, rowY + 5, { align: 'right' });
    doc.text(`${item.discountPercent || 0}%`, 150, rowY + 5, { align: 'center' });
    doc.text(`${item.gstRate}%`, 166, rowY + 5, { align: 'center' });
    
    doc.setFont('BagFont', 'bold');
    const lineItemAmount = item.taxableAmount !== undefined ? item.taxableAmount : (item.amount || (item.quantity * item.pricePerBag));
    doc.text(formatINR(lineItemAmount, true, true), 190, rowY + 5, { align: 'right' });
  });

  const tableBottom = y + Math.max(invoice.items.length * 7.5, 24);
  y = tableBottom + 4;

  // Summary and Tax Details Box
  const leftBoxWidth = 98;
  const rightBoxX = margin + 4 + leftBoxWidth + 4; // 120
  const rightBoxWidth = contentWidth - 8 - leftBoxWidth - 4; // 72
  const boxHeight = 54;

  // Left Box: Amount in Words & Bank Details
  doc.setDrawColor(228, 215, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + 4, y, leftBoxWidth, boxHeight, 2, 2, 'FD');

  doc.setFont('BagFont', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(139, 94, 60);
  doc.text('TOTAL AMOUNT IN WORDS:', margin + 8, y + 6);

  doc.setFont('BagFont', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(44, 33, 27);
  const words = numberToWordsINR(invoice.grandTotal);
  const splitWords = doc.splitTextToSize(words, 88);
  doc.text(splitWords, margin + 8, y + 10.5);

  // Bank details
  const bankDetails = invoice.bankDetails;
  const showBank = bankDetails?.showBankDetails ?? business.showBankDetailsOnInvoice ?? true;
  const bankName = bankDetails?.bankName || business.bankName;
  const accountHolder = bankDetails?.accountHolderName || business.accountHolderName || business.businessName;
  const accountNumber = bankDetails?.bankAccountNumber || bankDetails?.accountNumber || business.bankAccountNumber;
  const ifscCode = bankDetails?.bankIfsc || bankDetails?.ifscCode || business.bankIfsc;
  const upiId = bankDetails?.upiId || business.upiId;

  const bankStartY = y + 10.5 + Math.max(splitWords.length * 4, 8) + 2;
  doc.setDrawColor(240, 232, 222);
  doc.line(margin + 8, bankStartY - 2, margin + 4 + leftBoxWidth - 4, bankStartY - 2);

  if (showBank) {
    doc.setFont('BagFont', 'bold');
    doc.setTextColor(139, 94, 60);
    doc.setFontSize(7.5);
    doc.text('BANK DETAILS FOR PAYMENT:', margin + 8, bankStartY + 2.5);

    const bankRows = [
      { label: 'Bank Name:', val: bankName, isBold: false },
      { label: 'A/C Holder:', val: accountHolder, isBold: false },
      { label: 'A/C Number:', val: accountNumber, isBold: true },
      { label: 'IFSC Code:', val: ifscCode, isBold: true },
      { label: 'UPI ID:', val: upiId, isBold: false },
    ].filter(r => Boolean(r.val));

    let bY = bankStartY + 6.5;
    bankRows.forEach(row => {
      doc.setFont('BagFont', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 90, 80);
      doc.text(row.label, margin + 8, bY);

      doc.setFont('BagFont', row.isBold ? 'bold' : 'normal');
      doc.setTextColor(44, 33, 27);
      const valText = doc.splitTextToSize(String(row.val), 64)[0] || String(row.val);
      doc.text(valText, margin + 28, bY);
      bY += 4;
    });
  }

  // Right Box: Calculations & Totals Panel
  doc.setFillColor(247, 243, 234);
  doc.roundedRect(rightBoxX, y, rightBoxWidth, boxHeight, 2, 2, 'FD');

  let calcY = y + 5.5;
  const calcLabelX = rightBoxX + 5;
  const calcValX = rightBoxX + rightBoxWidth - 5;

  function addCalcRow(label: string, value: string, isBold: boolean = false, textColor: number[] = [44, 33, 27]) {
    doc.setFont('BagFont', isBold ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(label, calcLabelX, calcY);
    doc.text(value, calcValX, calcY, { align: 'right' });
    calcY += 4.5;
  }

  addCalcRow('Items Subtotal', formatINR(invoice.subtotal, true, true));
  if (invoice.totalDiscount > 0) {
    addCalcRow('Total Discount', `-${formatINR(invoice.totalDiscount, true, true)}`, false, [185, 74, 72]);
  }
  addCalcRow('Taxable Value', formatINR(invoice.taxableAmount, true, true));

  if (invoice.taxMode === 'IGST') {
    addCalcRow('IGST', formatINR(invoice.igstTotal, true, true));
  } else {
    addCalcRow('CGST', formatINR(invoice.cgstTotal, true, true));
    addCalcRow('SGST', formatINR(invoice.sgstTotal, true, true));
  }

  // Divider line before Grand Total
  calcY += 0.5;
  doc.setDrawColor(210, 195, 180);
  doc.setLineWidth(0.4);
  doc.line(rightBoxX + 3, calcY - 1, rightBoxX + rightBoxWidth - 3, calcY - 1);

  // Grand Total banner (Visually prominent)
  doc.setFillColor(236, 224, 206); // #ECE0CE Warm cream/kraft highlight
  doc.roundedRect(rightBoxX + 2, calcY, rightBoxWidth - 4, 7.5, 1.5, 1.5, 'F');

  doc.setFont('BagFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(59, 41, 33); // #3B2921
  doc.text('GRAND TOTAL', calcLabelX, calcY + 5.2);
  doc.text(formatINR(invoice.grandTotal, true, true), calcValX, calcY + 5.2, { align: 'right' });
  calcY += 10.5;

  // Payments section below Grand Total
  const grandTotal = invoice.grandTotal || 0;
  const paidAmount = invoice.paymentStatus === 'Paid'
    ? grandTotal
    : invoice.paymentStatus === 'Pending'
      ? 0
      : (invoice.paidAmount !== undefined ? invoice.paidAmount : 0);
  const balanceDue = invoice.paymentStatus === 'Paid'
    ? 0
    : invoice.paymentStatus === 'Pending'
      ? grandTotal
      : (invoice.balanceAmount !== undefined ? invoice.balanceAmount : Math.max(0, grandTotal - paidAmount));

  if (invoice.paymentStatus === 'Partial') {
    addCalcRow('Advance Received', formatINR(paidAmount, true, true), false, [79, 125, 90]);
    addCalcRow('Balance Due', formatINR(balanceDue, true, true), true, [185, 74, 72]);
  } else if (invoice.paymentStatus === 'Paid') {
    addCalcRow('Amount Paid', formatINR(paidAmount, true, true), false, [79, 125, 90]);
    addCalcRow('Balance Due', formatINR(0, true, true), true, [79, 125, 90]);
  } else if (invoice.paymentStatus === 'Pending') {
    addCalcRow('Amount Paid', formatINR(0, true, true), false, [120, 110, 100]);
    addCalcRow('Balance Due', formatINR(balanceDue, true, true), true, [185, 74, 72]);
  }

  // Footer: Terms & Conditions (Left) & Signature Area (Right)
  const footerY = y + boxHeight + 6;

  if (business.showTermsAndConditions !== false) {
    doc.setFont('BagFont', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(139, 94, 60);
    doc.text('TERMS & CONDITIONS:', margin + 4, footerY);

    doc.setFont('BagFont', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 90, 80);
    const pdfTerms = invoice.notes || business.termsAndConditions || '1. Goods once sold will not be taken back or exchanged.\n2. Payment is due within agreed credit terms.\n3. Subject to local jurisdiction only.';
    const termsLines = doc.splitTextToSize(pdfTerms, 104);
    doc.text(termsLines.slice(0, 4), margin + 4, footerY + 4.5);
  }

  if (business.showSignatureSection !== false) {
    const sigBlockRight = pageWidth - margin - 4; // 192
    const sigBlockLeft = 130;
    const sigCenterX = (sigBlockLeft + sigBlockRight) / 2; // 161

    doc.setFont('BagFont', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(44, 33, 27);
    doc.text(`FOR ${business.businessName.toUpperCase()}`, sigCenterX, footerY, { align: 'center' });

    const sigLineY = footerY + 16;
    doc.setDrawColor(180, 170, 160);
    doc.setLineWidth(0.4);
    doc.line(sigBlockLeft + 4, sigLineY, sigBlockRight - 4, sigLineY);

    doc.setFont('BagFont', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 60, 50);
    const sigText = business.authorizedSignatoryName
      ? `${business.authorizedSignatoryName} (${business.authorizedSignatoryDesignation || 'Proprietor'})`
      : (business.authorizedSignatoryText || 'Proprietor / Authorized Signatory');
    doc.text(sigText, sigCenterX, sigLineY + 4.5, { align: 'center' });
  }

  return doc;
}

export function downloadInvoicePDF(invoice: Invoice, settings: BusinessSettings): void {
  const doc = generateInvoicePDF(invoice, settings);
  doc.save(`${invoice.invoiceNumber || 'Invoice'}_${invoice.partyName.replace(/\s+/g, '_')}.pdf`);
}

export function printInvoice(): void {
  window.print();
}
