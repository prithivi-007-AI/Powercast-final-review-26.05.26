
import { ForecastResult, WeatherData, DecisionResult } from '../types';

// ============================================================================
// Export Service — CSV & PDF Report Generation (Client-Side)
// Generates downloadable reports with forecast data, decisions, and weather.
// ============================================================================

/**
 * Trigger a browser file download from a Blob.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

/**
 * Export forecast data as a CSV file.
 * Includes timestamp, predicted load, lower/upper bounds, and weather context.
 */
export const exportCSV = (
  forecast: ForecastResult,
  decisions: DecisionResult | null,
  weather: WeatherData | null
): void => {
  const rows: string[] = [];

  // Header
  rows.push('Timestamp,Predicted (MW),Lower Bound (MW),Upper Bound (MW)');

  // Forecast data rows
  forecast.predictions.forEach(p => {
    rows.push([
      p.timestamp,
      (p.predicted ?? 0).toFixed(2),
      (p.lowerBound ?? 0).toFixed(2),
      (p.upperBound ?? 0).toFixed(2),
    ].join(','));
  });

  // Blank separator
  rows.push('');
  rows.push('--- Summary ---');
  rows.push(`Generation Requirement,${forecast.generationRequirement} MW`);
  rows.push(`System Efficiency,${forecast.systemEfficiency}%`);
  rows.push(`Projected Cost/Hr,₹${forecast.projectedCostPerHour}`);
  rows.push(`Recommended Units,${forecast.recommendedUnits.join(' | ')}`);

  // Weather context
  if (weather) {
    rows.push('');
    rows.push('--- Weather Context ---');
    rows.push(`Temperature,${weather.temperature}°C`);
    rows.push(`Humidity,${weather.humidity}%`);
    rows.push(`Wind Speed,${weather.windSpeed} m/s`);
    rows.push(`Cloud Cover,${weather.cloudCover}%`);
    rows.push(`Condition,${weather.description}`);
  }

  // Decision recommendations
  if (decisions?.recommendations?.length) {
    rows.push('');
    rows.push('--- Generator Decisions ---');
    rows.push('Unit,Action,Priority,Reason');
    decisions.recommendations.forEach(d => {
      rows.push(`${d.unitName},${d.action},${d.priority},"${d.reason}"`);
    });
  }

  const csvContent = rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `PowerCast_Forecast_${timestamp}.csv`);
};

// ─── PDF Export ──────────────────────────────────────────────────────────────

/**
 * Export a professional PDF report.
 * Uses jsPDF for PDF generation with auto-table for formatted tables.
 */
export const exportPDF = async (
  forecast: ForecastResult,
  decisions: DecisionResult | null,
  weather: WeatherData | null
): Promise<void> => {
  // Dynamic import of jsPDF (loaded on demand)
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Title Page ──
  doc.setFillColor(109, 93, 252); // accent color
  doc.rect(0, 0, pageWidth, 50, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('PowerCast AI', 20, 30);
  doc.setFontSize(12);
  doc.text('Load Forecast & Decision Support Report', 20, 42);

  // Report metadata
  y = 60;
  doc.setTextColor(77, 91, 124);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
  y += 8;
  doc.text(`Forecast Points: ${forecast.predictions.length}`, 20, y);
  y += 8;

  // ── Summary Metrics ──
  y += 5;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 93, 252);
  doc.text('Summary Metrics', 20, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Generation Requirement', `${forecast.generationRequirement} MW`],
      ['System Efficiency', `${forecast.systemEfficiency}%`],
      ['Projected Cost / Hour', `₹${forecast.projectedCostPerHour.toLocaleString()}`],
      ['Recommended Units', forecast.recommendedUnits.join(', ')],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { left: 20, right: 20 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Weather Context ──
  if (weather) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 93, 252);
    doc.text('Weather Context', 20, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Parameter', 'Value']],
      body: [
        ['Temperature', `${weather.temperature}°C (feels like ${weather.feelsLike}°C)`],
        ['Humidity', `${weather.humidity}%`],
        ['Wind Speed', `${weather.windSpeed} m/s`],
        ['Cloud Cover', `${weather.cloudCover}%`],
        ['Condition', weather.description],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 4 },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── Decision Recommendations ──
  if (decisions?.recommendations?.length) {
    // Check if we need a new page
    if (y > 230) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 93, 252);
    doc.text('Generator Decisions', 20, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [['Unit', 'Action', 'Priority', 'Utilization', 'Reason']],
      body: decisions.recommendations.map(d => [
        d.unitName,
        d.action,
        d.priority,
        `${d.loadPercentage}%`,
        d.reason.substring(0, 60) + (d.reason.length > 60 ? '...' : ''),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [244, 63, 94], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 4: { cellWidth: 55 } },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── Forecast Data Table ──
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(109, 93, 252);
  doc.text('Forecast Data', 20, y);
  y += 3;

  const forecastRows = forecast.predictions.map(p => [
    p.timestamp,
    (p.predicted ?? 0).toFixed(1),
    (p.lowerBound ?? 0).toFixed(1),
    (p.upperBound ?? 0).toFixed(1),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'Predicted (MW)', 'Lower Bound', 'Upper Bound']],
    body: forecastRows,
    theme: 'striped',
    headStyles: { fillColor: [109, 93, 252], textColor: 255 },
    styles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 20, right: 20 },
  });

  // ── AI Explanation ──
  if (forecast.explanation) {
    y = (doc as any).lastAutoTable.finalY + 12;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 93, 252);
    doc.text('AI Intelligence Report', 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(77, 91, 124);
    const splitText = doc.splitTextToSize(forecast.explanation, pageWidth - 40);
    doc.text(splitText, 20, y);
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(163, 170, 185);
    doc.text(
      `PowerCast AI Report — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`PowerCast_Report_${timestamp}.pdf`);
};
