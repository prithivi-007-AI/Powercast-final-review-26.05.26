
import React, { useState } from 'react';
import { ForecastResult, WeatherData, DecisionResult } from '../types';
import { exportCSV, exportPDF } from '../services/exportService';

// ============================================================================
// Export Panel — Download Buttons for PDF Report & CSV Data
// Triggers client-side generation and browser download.
// ============================================================================

interface Props {
  forecast: ForecastResult | null;
  decisions: DecisionResult | null;
  weather: WeatherData | null;
}

const ExportPanel: React.FC<Props> = ({ forecast, decisions, weather }) => {
  const [pdfLoading, setPdfLoading] = useState(false);
  const disabled = !forecast;

  const handleCSV = () => {
    if (!forecast) return;
    exportCSV(forecast, decisions, weather);
  };

  const handlePDF = async () => {
    if (!forecast) return;
    setPdfLoading(true);
    try {
      await exportPDF(forecast, decisions, weather);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try CSV export instead.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* CSV Button */}
      <button
        onClick={handleCSV}
        disabled={disabled}
        className={`neu-btn px-4 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
        }`}
        title="Download forecast data as CSV"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        CSV
      </button>

      {/* PDF Button */}
      <button
        onClick={handlePDF}
        disabled={disabled || pdfLoading}
        className={`neu-btn px-4 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
          disabled || pdfLoading ? 'opacity-40 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
        }`}
        title="Download full PDF report"
      >
        {pdfLoading ? (
          <div className="w-3.5 h-3.5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin"></div>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        )}
        {pdfLoading ? 'Generating...' : 'PDF Report'}
      </button>
    </div>
  );
};

export default ExportPanel;
