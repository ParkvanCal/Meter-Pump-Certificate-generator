import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { CertificateData, CalibrationRun } from '../types';
import { COLORS } from '../constants';

export async function generatePDF(data: CertificateData, logoBase64?: string): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const W = 210;
  const H = 297;
  const M = 14;
  const CW = W - 2 * M;
  let y = M;

  // Helper for text drawing
  const drawText = (text: string, x: number, y: number, options: any = {}) => {
    const { fontSize = 10, font = 'helvetica', style = 'normal', color = COLORS.DARK_TEXT, align = 'left' } = options;
    doc.setFont(font, style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color);
    if (align === 'center') {
      doc.text(text, x, y, { align: 'center' });
    } else if (align === 'right') {
      doc.text(text, x, y, { align: 'right' });
    } else {
      doc.text(text, x, y);
    }
  };

  const drawImage = (base64: string | undefined, x: number, y: number, maxWidth: number, maxHeight: number) => {
    if (!base64) return;
    try {
      const imgProps = doc.getImageProperties(base64);
      const ratio = imgProps.width / imgProps.height;
      let width = maxWidth;
      let height = width / ratio;
      
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
      
      const centeredX = x + (maxWidth - width) / 2;
      const centeredY = y + (maxHeight - height) / 2;
      
      doc.addImage(base64, 'PNG', centeredX, centeredY, width, height, undefined, 'FAST');
    } catch (e) {
      console.warn("Image draw failed", e);
    }
  };

  // 1. Navy Top Strip
  doc.setFillColor(COLORS.NAVY);
  doc.rect(M, y, CW, 1, 'F');
  y += 1;

  // 2. Gold Strip
  doc.setFillColor(COLORS.GOLD);
  doc.rect(M, y, CW, 1, 'F');
  y += 1;

  // 3. Header Block
  const headerH = 28;
  doc.setFillColor(COLORS.NAVY);
  doc.rect(M, y, CW, headerH, 'F');
  
  if (logoBase64) {
    try {
      const imgProps = doc.getImageProperties(logoBase64);
      const maxWidth = 32;
      const maxHeight = 20;
      const ratio = imgProps.width / imgProps.height;
      
      let width = maxWidth;
      let height = width / ratio;
      
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
      
      doc.addImage(logoBase64, 'PNG', M + 4, y + 4, width, height, undefined, 'FAST');
    } catch (e) {
      drawText('PARKVAN', M + 5, y + 10, { fontSize: 18, style: 'bold', color: COLORS.GOLD_LT });
      drawText('CALIBRATION', M + 5, y + 15, { fontSize: 7, color: COLORS.GOLD });
    }
  } else {
    drawText('PARKVAN', M + 5, y + 10, { fontSize: 18, style: 'bold', color: COLORS.GOLD_LT });
    drawText('CALIBRATION', M + 5, y + 15, { fontSize: 7, color: COLORS.GOLD });
  }

  // Title
  const title = data.certType === 'Pump' 
    ? "Pump Verification / Calibration Certificate" 
    : "Meter Verification / Calibration Certificate";
  drawText(title, W / 2, y + 10, { fontSize: 13, style: 'bold', color: '#FFFFFF', align: 'center' });
  drawText('FUEL METERING & COMPLIANCE DIVISION', W / 2, y + 16, { fontSize: 7, color: COLORS.GOLD, align: 'center' });
  
  // Cert Info (Right Side)
  const rx = M + CW - 5;
  drawText('CERTIFICATE NO.', rx, y + 6, { fontSize: 5.5, color: COLORS.GOLD, align: 'right' });
  drawText(data.certNo, rx, y + 12, { fontSize: 10, style: 'bold', color: COLORS.GOLD_LT, align: 'right' });
  drawText('DATE OF CALIBRATION', rx, y + 18, { fontSize: 5.5, color: COLORS.GOLD, align: 'right' });
  
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd-MM-yyyy');
    } catch {
      return dateStr;
    }
  };

  drawText(formatDate(data.certDate), rx, y + 24, { fontSize: 8, color: '#FFFFFF', align: 'right' });

  y += headerH + 5;

  // 4. Section Helper
  const drawSection = (title: string, currentY: number) => {
    doc.setFillColor(COLORS.NAVY);
    doc.rect(M, currentY, CW, 7, 'F');
    doc.setFillColor(COLORS.GOLD);
    doc.rect(M, currentY, 3, 7, 'F');
    drawText(title.toUpperCase(), M + 6, currentY + 5, { fontSize: 8, style: 'bold', color: COLORS.GOLD_LT });
    return currentY + 7 + 2;
  };

  const drawRow = (label: string, value: string, currentY: number, idx: number) => {
    const rh = 7;
    doc.setFillColor(idx % 2 === 0 ? COLORS.OFF_WHITE : '#FFFFFF');
    doc.rect(M, currentY, CW, rh, 'F');
    doc.setFillColor(COLORS.NAVY);
    doc.rect(M, currentY, 2, rh, 'F');
    
    drawText(label.toUpperCase(), M + 4, currentY + 4.5, { fontSize: 6, style: 'bold', color: COLORS.MED_TEXT });
    drawText(':', M + 46, currentY + 4.5, { fontSize: 8, style: 'bold', color: COLORS.GOLD });
    drawText(value, M + 50, currentY + 4.5, { fontSize: 9, color: COLORS.DARK_TEXT });
    
    doc.setDrawColor(COLORS.LT_GREY);
    doc.setLineWidth(0.1);
    doc.line(M + 2, currentY + rh, M + CW, currentY + rh);
    return currentY + rh;
  };

  // Client Info
  y = drawSection('Client Information', y);
  y = drawRow('Meter Owner', data.meterOwner, y, 0);
  y = drawRow('Location / Place', data.location, y, 1);
  const typeField = data.certType === 'Pump' ? 'Pump Type' : 'Meter Type';
  y = drawRow(typeField, data.unitTypeVal, y, 2);
  y += 4;

  // Instrument Panels (Side by Side)
  const cw2 = (CW - 4) / 2;
  const startPanelY = y;
  
  // MUT Panel
  y = drawSection(data.certType === 'Pump' ? 'Pump Under Test' : 'Meter Under Test', y);
  const putInfo = [
    ['Model', data.putModel],
    ['Serial No.', data.putSerial],
    ['Flow Rates', data.putFlow],
    ['Accuracy', data.putAccuracy],
    ['Product Used', data.putProduct]
  ];
  
  putInfo.forEach((item, i) => {
    doc.setFillColor(i % 2 === 0 ? COLORS.OFF_WHITE : '#FFFFFF');
    doc.rect(M, y, cw2, 6.5, 'F');
    drawText(item[0].toUpperCase(), M + 3, y + 4, { fontSize: 5.5, color: COLORS.MED_TEXT });
    drawText(item[1], M + 28, y + 4, { fontSize: 8, color: COLORS.DARK_TEXT });
    y += 6.5;
  });

  const methodIsMaster = data.method === 'Master Meter';
  
  // Totalizer MUT
  doc.setFillColor(COLORS.GOLD);
  doc.rect(M, y, cw2, 6, 'F');
  drawText('TOTALISER READINGS', M + 3, y + 4, { fontSize: 6.5, style: 'bold', color: COLORS.NAVY });
  y += 6;
  
  const putTot = [
    ['Tot. Finish', data.putTotFinish],
    ['Tot. Start', data.putTotStart],
    ['Product Drawn', data.putProductDrawn]
  ];
  
  putTot.forEach((item, i) => {
    doc.setFillColor(i % 2 === 0 ? COLORS.OFF_WHITE : '#FFFFFF');
    doc.rect(M, y, cw2, 6.5, 'F');
    drawText(item[0].toUpperCase(), M + 3, y + 4, { fontSize: 5.5, color: COLORS.MED_TEXT });
    drawText(item[1] || '—', M + 28, y + 4, { fontSize: 8, style: 'bold', color: COLORS.NAVY });
    y += 6.5;
  });
  
  const endPutY = y;

  // Standard Measure Panel
  y = startPanelY;
  const smX = M + cw2 + 4;
  doc.setFillColor(COLORS.NAVY);
  doc.rect(smX, y, cw2, 7, 'F');
  doc.setFillColor(COLORS.GOLD);
  doc.rect(smX, y, 2.5, 7, 'F');
  drawText('STANDARD MEASURE', smX + 5, y + 5, { fontSize: 7, style: 'bold', color: '#FFFFFF' });
  y += 9;

  const smInfo = [
    ['Model', data.smModel],
    ['Serial No.', data.smSerial],
    ['Flow Rates', data.smFlow],
    ['Accuracy', data.smAccuracy],
    ['', '']
  ];
  smInfo.forEach((item, i) => {
    doc.setFillColor(i % 2 === 0 ? COLORS.OFF_WHITE : '#FFFFFF');
    doc.rect(smX, y, cw2, 6.5, 'F');
    drawText(item[0].toUpperCase(), smX + 3, y + 4, { fontSize: 5.5, color: COLORS.MED_TEXT });
    drawText(item[1], smX + 28, y + 4, { fontSize: 8, color: COLORS.DARK_TEXT });
    y += 6.5;
  });

  doc.setFillColor(methodIsMaster ? COLORS.GOLD : COLORS.MID_GREY);
  doc.rect(smX, y, cw2, 6, 'F');
  drawText('TOTALISER READINGS', smX + 3, y + 4, { fontSize: 6.5, style: 'bold', color: methodIsMaster ? COLORS.NAVY : '#888888' });
  y += 6;

  const smTot = [
    ['Tot. Finish', data.smTotFinish],
    ['Tot. Start', data.smTotStart],
    ['Product Drawn', data.smProductDrawn]
  ];
  smTot.forEach((item, i) => {
    doc.setFillColor(methodIsMaster ? (i % 2 === 0 ? COLORS.OFF_WHITE : '#FFFFFF') : '#EEEEEE');
    doc.rect(smX, y, cw2, 6.5, 'F');
    drawText(item[0].toUpperCase(), smX + 3, y + 4, { fontSize: 5.5, color: methodIsMaster ? COLORS.MED_TEXT : '#AAAAAA' });
    drawText(methodIsMaster ? item[1] : '—', smX + 28, y + 4, { fontSize: 8, style: methodIsMaster ? 'bold' : 'normal', color: methodIsMaster ? COLORS.NAVY : '#AAAAAA' });
    y += 6.5;
  });

  y = Math.max(endPutY, y) + 5;

  // Calibration Method
  y = drawSection('Calibration Method', y);
  doc.setFillColor(COLORS.OFF_WHITE);
  doc.rect(M, y, CW, 8, 'F');
  doc.setFillColor(COLORS.NAVY);
  doc.rect(M, y, 3, 8, 'F');
  drawText('METHOD USED:', M + 6, y + 5, { fontSize: 6, style: 'bold', color: COLORS.MED_TEXT });
  drawText(data.method, M + 34, y + 5, { fontSize: 9, color: COLORS.DARK_TEXT });
  y += 12;

  // Results Table (On First Page)
  y = drawSection('Calibration Results', y);
  
  const tableData = data.runs.map((run, i) => [
    i + 1,
    run.masterVol,
    run.mutVol,
    run.diff !== null ? run.diff.toFixed(3) : '—',
    run.factor !== null ? run.factor.toFixed(4) : '—',
    run.errorPct !== null ? run.errorPct.toFixed(2) + '%' : '—',
    run.comment
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Run', 'Standard Vol (L)', data.certType === 'Pump' ? 'PUT Vol (L)' : 'MUT Vol (L)', 'Diff (L)', 'Meter Factor', '% Error', 'Comments']],
    body: tableData,
    margin: { left: M, right: M },
    styles: { fontSize: 7, cellPadding: 2, textColor: COLORS.DARK_TEXT },
    headStyles: { fillColor: COLORS.NAVY, textColor: COLORS.GOLD_LT, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', fillColor: COLORS.NAVY, textColor: COLORS.GOLD_LT, fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'left' }
    },
    didParseCell: (dataCell) => {
      if (dataCell.column.index === 5 && dataCell.section === 'body') {
        const valStr = dataCell.cell.text[0];
        if (valStr !== '—') {
          const val = parseFloat(valStr);
          dataCell.cell.styles.textColor = Math.abs(val) > 0.5 ? COLORS.DANGER : COLORS.SUCCESS;
        }
      }
    }
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY;

  // Stamp 1 on Page 1
  const s1W = 63.5; // 2.5"
  const s1H = 12.7; // 0.5"
  const s1Y = H - M - 10 - s1H - 5;
  if (data.officialStamp) {
    doc.setFillColor('#FFFFFF');
    doc.rect(M + CW - s1W, s1Y, s1W, s1H, 'F');
  }
  drawImage(data.officialStamp, M + CW - s1W, s1Y, s1W, s1H);

  // Footer function
  const drawFooter = (page: number, total: number) => {
    doc.setPage(page);
    doc.setFillColor(COLORS.NAVY);
    doc.rect(M, H - M - 10, CW, 10, 'F');
    doc.setFillColor(COLORS.GOLD);
    doc.rect(M, H - M - 10, CW, 0.8, 'F');
    drawText('Parkvan Calibration Services · Fuel Metering Division · Harare, Zimbabwe', M + 5, H - M - 4, { fontSize: 6, color: '#FFFFFF' });
    drawText(`Page ${page} of ${total}`, M + CW - 5, H - M - 6.5, { fontSize: 6, color: COLORS.GOLD, align: 'right' });
    drawText(data.certNo, M + CW - 5, H - M - 2.5, { fontSize: 7, style: 'bold', color: COLORS.GOLD_LT, align: 'right' });
  };

  // New Page for Summary and Closures
  doc.addPage();
  y = M;

  // Header Mirror for Page 2 (Small version)
  doc.setFillColor(COLORS.NAVY);
  doc.rect(M, y, CW, 15, 'F');
  doc.setFillColor(COLORS.GOLD);
  doc.rect(M, y, 3, 15, 'F');
  drawText('CALIBRATION SUMMARY & SIGN-OFF', M + 6, y + 9, { fontSize: 10, style: 'bold', color: COLORS.GOLD_LT });
  drawText(data.certNo, M + CW - 5, y + 9, { fontSize: 9, style: 'bold', color: COLORS.GOLD, align: 'right' });
  y += 20;

  // Summary Cards
  const cardW = (CW - 9) / 4;
  const cards = [
    { label: '% Error\nBefore Adj.', value: data.beforeError },
    { label: 'Adjustment\nStatus', value: data.adjustment === 'none' ? 'None Made' : 'Adjusted' },
    { label: 'Final Avg\n% Error', value: data.avgError },
    { label: 'Avg Meter\nFactor', value: data.avgFactor }
  ];

  cards.forEach((card, i) => {
    const cardX = M + i * (cardW + 3);
    doc.setFillColor(COLORS.OFF_WHITE);
    doc.rect(cardX, y, cardW, 20, 'F');
    doc.setFillColor(COLORS.NAVY);
    doc.rect(cardX, y, cardW, 2, 'F');
    doc.setFillColor(COLORS.GOLD);
    doc.rect(cardX + 2, y + 1.2, cardW - 4, 0.4, 'F');
    
    const lines = card.label.split('\n');
    lines.forEach((line, li) => {
      drawText(line.toUpperCase(), cardX + cardW / 2, y + 7 + li * 4, { fontSize: 5, color: COLORS.MED_TEXT, align: 'center' });
    });
    
    drawText(card.value, cardX + cardW / 2, y + 17, { fontSize: 9, style: 'bold', color: COLORS.NAVY, align: 'center' });
  });

  y += 25;

  // Verdict
  let vBg = COLORS.OFF_WHITE;
  let vText = COLORS.MED_TEXT;
  if (data.verdict === 'pass') {
    vBg = '#EAF7EF';
    vText = COLORS.SUCCESS;
  } else if (data.verdict === 'fail') {
    vBg = '#FBE9E7';
    vText = COLORS.DANGER;
  }
  
  doc.setFillColor(vBg);
  doc.rect(M, y, CW, 10, 'F');
  doc.setDrawColor(vText);
  doc.rect(M, y, CW, 10, 'S');
  drawText(data.verdictText, M + 5, y + 6.5, { fontSize: 8, style: 'bold', color: vText });
  
  y += 15;

  // Dates
  doc.setFillColor(COLORS.OFF_WHITE);
  doc.rect(M, y, CW, 8, 'F');
  doc.setFillColor(COLORS.NAVY);
  doc.rect(M, y, 3, 8, 'F');
  
  drawText('DATE OF CALIBRATION', M + 5, y + 3, { fontSize: 6, style: 'bold', color: COLORS.MED_TEXT });
  drawText(formatDate(data.certDate), M + 5, y + 6.5, { fontSize: 9, color: COLORS.DARK_TEXT });
  
  drawText('DATE OF NEXT CALIBRATION', M + CW / 2 + 5, y + 3, { fontSize: 6, style: 'bold', color: COLORS.MED_TEXT });
  drawText(formatDate(data.nextCalDate), M + CW / 2 + 5, y + 6.5, { fontSize: 9, color: COLORS.DARK_TEXT });

  y += 15;
  
  // Remarks
  if (data.remarks) {
    doc.setFillColor(COLORS.OFF_WHITE);
    doc.rect(M, y, CW, 12, 'F');
    doc.setFillColor(COLORS.NAVY);
    doc.rect(M, y, 3, 12, 'F');
    drawText('REMARKS / ADDITIONAL NOTES', M + 5, y + 3, { fontSize: 6, style: 'bold', color: COLORS.MED_TEXT });
    
    doc.setFontSize(8);
    const splitRemarks = doc.splitTextToSize(data.remarks, CW - 10);
    doc.text(splitRemarks, M + 5, y + 7);
    y += 15;
  }

  // Signatures
  y = drawSection('Authorisation & Sign-off', y);
  const sigW = (CW - 8) / 3;
  const sigs = [
    { label: 'Calibration Technician', value: data.techName },
    { label: 'Authorised Signatory', value: data.authName },
    { label: 'Customer Representative', value: data.customerName }
  ];

  sigs.forEach((sig, i) => {
    const sx = M + i * (sigW + 4);
    const isTech = i === 0;
    const isAuth = i === 1;
    const isCustomer = i === 2;

    doc.setFillColor('#FFFFFF'); // White background for signature boxes
    doc.rect(sx, y, sigW, 20, 'F');
    doc.setFillColor(COLORS.NAVY);
    doc.rect(sx, y, sigW, 2.5, 'F');
    drawText(sig.label.toUpperCase(), sx + sigW / 2, y + 1.8, { fontSize: 5.5, color: COLORS.GOLD_LT, align: 'center' });
    
    doc.setDrawColor(COLORS.GOLD);
    doc.setLineWidth(0.1);

    if (isTech) {
      if (data.techInitials) {
        drawText(data.techInitials, sx + sigW / 2, y + 9.5, { fontSize: 8.5, style: 'italic', color: COLORS.NAVY, align: 'center' });
      }
      doc.line(sx + 4, y + 12.5, sx + sigW - 4, y + 12.5);
    } else if (isAuth) {
      if (data.authSignature) {
        drawImage(data.authSignature, sx + 2, y + 3, sigW - 4, 9.5);
      }
      doc.line(sx + 4, y + 12.5, sx + sigW - 4, y + 12.5);
      drawText(data.authName, sx + sigW / 2, y + 16.5, { fontSize: 8, color: COLORS.DARK_TEXT, align: 'center' });
    } else if (isCustomer) {
      if (data.customerName) {
        drawText(data.customerName, sx + sigW / 2, y + 9.5, { fontSize: 8, color: COLORS.DARK_TEXT, align: 'center' });
      }
      doc.line(sx + 4, y + 12.5, sx + sigW - 4, y + 12.5);
    }
  });

  y += 28;

  // Stamp 2 on Page 2
  const s2W = 76.2; // 3"
  const s2H = 40;   // Assumed height for a 3" long stamp
  if (y + s2H < H - M - 12) {
    if (data.verificationStamp) {
      doc.setFillColor('#FFFFFF');
      doc.rect(M + CW - s2W, y, s2W, s2H, 'F');
    }
    drawImage(data.verificationStamp, M + CW - s2W, y, s2W, s2H);
  }

  // Final Footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    drawFooter(i, totalPages);
  }


  doc.save(`Parkvan_Cert_${data.certNo}.pdf`);
  return doc;
}
