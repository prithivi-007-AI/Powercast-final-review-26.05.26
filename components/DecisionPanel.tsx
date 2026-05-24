
import React from 'react';
import { DecisionResult } from '../types';

// ============================================================================
// Decision Panel — Enhanced Generator Dispatch Recommendations
// Features:
//   - Confidence percentage bar per recommendation
//   - Renewable contribution % badge
//   - Estimated savings display
//   - Smart maintenance cards with reason + operational benefit
// ============================================================================

interface Props {
  decisions: DecisionResult | null;
}

const DecisionPanel: React.FC<Props> = ({ decisions }) => {
  if (!decisions || !decisions.recommendations.length) {
    return (
      <div className="neu-flat p-6">
        <h4 className="text-xs font-black text-[var(--text-light)] uppercase tracking-widest mb-4">
          Decision Support
        </h4>
        <p className="text-xs text-slate-300 italic">
          Run forecast to generate generator dispatch recommendations
        </p>
      </div>
    );
  }

  const { recommendations, maintenanceOpportunities, overallStatus, summary, renewablePercent, totalEstimatedSavings } = decisions;

  return (
    <div className="neu-flat p-6 relative overflow-hidden">
      {/* Status indicator glow */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${
        overallStatus === 'Critical' ? 'bg-rose-500' :
        overallStatus === 'Warning'  ? 'bg-amber-500' : 'bg-emerald-500'
      }`} />

      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-black text-[var(--text-light)] uppercase tracking-widest">
          Decision Support
        </h4>
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
          overallStatus === 'Critical' ? 'bg-rose-100 text-rose-700' :
          overallStatus === 'Warning'  ? 'bg-amber-100 text-amber-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {overallStatus}
        </span>
      </div>

      {/* KPI row */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 neu-pressed p-2.5 rounded-xl text-center">
          <p className="text-[8px] font-black text-[var(--text-light)] uppercase tracking-widest">Renewable</p>
          <p className="text-sm font-black text-emerald-500">{renewablePercent}%</p>
        </div>
        <div className="flex-1 neu-pressed p-2.5 rounded-xl text-center">
          <p className="text-[8px] font-black text-[var(--text-light)] uppercase tracking-widest">Savings</p>
          <p className="text-sm font-black text-[var(--accent)]">
            {totalEstimatedSavings > 0 ? `₹${(totalEstimatedSavings / 1000).toFixed(1)}k` : '—'}/hr
          </p>
        </div>
        <div className="flex-1 neu-pressed p-2.5 rounded-xl text-center">
          <p className="text-[8px] font-black text-[var(--text-light)] uppercase tracking-widest">Units ON</p>
          <p className="text-sm font-black text-[var(--text-main)]">
            {recommendations.filter(r => r.action === 'ON').length}
          </p>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[10px] font-medium text-[var(--text-main)] mb-4 leading-relaxed opacity-80">
        {summary}
      </p>

      {/* Recommendation cards */}
      <div className="space-y-2.5 mb-4">
        {recommendations.map((rec) => (
          <div
            key={rec.unitId}
            className="p-3 rounded-xl transition-all duration-300 hover:border-[var(--accent)]/20"
            style={{
              background: 'var(--bg-color)',
              boxShadow: 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)',
              border: '1px solid transparent',
            }}
          >
            {/* Top row: icon + name + badges */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black ${
                rec.action === 'ON'      ? 'bg-emerald-500' :
                rec.action === 'STANDBY' ? 'bg-amber-500'   : 'bg-slate-400'
              }`}>
                {rec.action === 'ON' ? '⚡' : rec.action === 'STANDBY' ? '⏳' : '⏸'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-[var(--text-main)]">{rec.unitName}</span>

                  {/* Action badge */}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                    rec.action === 'ON'      ? 'bg-emerald-100 text-emerald-700' :
                    rec.action === 'STANDBY' ? 'bg-amber-100 text-amber-700'   :
                    'bg-slate-100 text-slate-600'
                  }`}>{rec.action}</span>

                  {/* Priority badge */}
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                    rec.priority === 'High'   ? 'bg-rose-100 text-rose-700'   :
                    rec.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{rec.priority}</span>

                  {/* Renewable badge */}
                  {rec.renewableContribution > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-50 text-emerald-600">
                      🌿 {rec.renewableContribution}% RE
                    </span>
                  )}
                </div>
              </div>

              {/* Savings */}
              {rec.estimatedSavings > 0 && (
                <div className="flex-shrink-0 text-right">
                  <div className="text-[9px] font-black text-emerald-600">
                    +₹{rec.estimatedSavings.toLocaleString()}
                  </div>
                  <div className="text-[7px] font-bold text-[var(--text-light)] uppercase">/hr</div>
                </div>
              )}
            </div>

            {/* Reason text */}
            <p className="text-[10px] font-medium text-[var(--text-light)] mb-2 leading-relaxed">
              {rec.reason}
            </p>

            {/* Confidence bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--neu-shadow-dark)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    rec.confidence >= 90 ? 'bg-emerald-400' :
                    rec.confidence >= 75 ? 'bg-amber-400'   : 'bg-rose-400'
                  }`}
                  style={{ width: `${rec.confidence}%` }}
                />
              </div>
              <span className="text-[8px] font-black text-[var(--text-light)] flex-shrink-0">
                {rec.confidence}% conf
              </span>
              {rec.action !== 'OFF' && (
                <span className="text-[8px] font-black text-[var(--text-main)] flex-shrink-0">
                  {rec.loadPercentage}% load
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Maintenance opportunities */}
      {maintenanceOpportunities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
            🔧 Smart Maintenance Windows
          </h5>
          <div className="space-y-2">
            {maintenanceOpportunities.map((win, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 hover:border-emerald-200 transition-colors"
              >
                {/* Time + Unit */}
                <div className="flex justify-between items-start mb-1.5">
                  <div>
                    <span className="text-[10px] font-black text-slate-700">{win.suggestedUnit}</span>
                    <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {win.start} → {win.end}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                      win.safetyMarginPercent > 30 ? 'bg-emerald-100 text-emerald-700' :
                      win.safetyMarginPercent > 15 ? 'bg-amber-100 text-amber-700'   :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {win.safetyMarginPercent}% margin
                    </span>
                  </div>
                </div>

                {/* Reason */}
                <p className="text-[9px] text-slate-500 font-medium leading-relaxed mb-1">
                  {win.reason}
                </p>

                {/* Operational benefit */}
                <p className="text-[9px] text-emerald-600 font-bold leading-relaxed">
                  💰 {win.operationalBenefit}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionPanel;
