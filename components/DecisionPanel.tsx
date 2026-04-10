
import React from 'react';
import { DecisionResult } from '../types';

// ============================================================================
// Decision Panel — Generator ON/OFF/STANDBY Recommendations
// Displays intelligent dispatch recommendations with priority badges,
// action indicators, and maintenance window suggestions.
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

  return (
    <div className="neu-flat p-6 relative overflow-hidden">
      {/* Status indicator glow */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${
        decisions.overallStatus === 'Critical' ? 'bg-rose-500' :
        decisions.overallStatus === 'Warning' ? 'bg-amber-500' : 'bg-emerald-500'
      }`}></div>

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xs font-black text-[var(--text-light)] uppercase tracking-widest">
          Decision Support
        </h4>
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
          decisions.overallStatus === 'Critical' ? 'bg-rose-100 text-rose-700' :
          decisions.overallStatus === 'Warning' ? 'bg-amber-100 text-amber-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          {decisions.overallStatus}
        </span>
      </div>

      {/* Summary */}
      <p className="text-[11px] font-medium text-[var(--text-main)] mb-4 leading-relaxed">
        {decisions.summary}
      </p>

      {/* Recommendation cards */}
      <div className="space-y-2 mb-4">
        {decisions.recommendations.map((rec) => (
          <div
            key={rec.unitId}
            className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-color)] border border-transparent hover:border-[var(--accent)]/20 transition-all duration-300"
            style={{
              boxShadow: 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)',
            }}
          >
            {/* Action indicator */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black ${
              rec.action === 'ON' ? 'bg-emerald-500' :
              rec.action === 'STANDBY' ? 'bg-amber-500' : 'bg-slate-400'
            }`}>
              {rec.action === 'ON' ? '⚡' : rec.action === 'STANDBY' ? '⏳' : '⏸'}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[var(--text-main)]">{rec.unitName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                  rec.action === 'ON' ? 'bg-emerald-100 text-emerald-700' :
                  rec.action === 'STANDBY' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {rec.action}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                  rec.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                  rec.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-[10px] font-medium text-[var(--text-light)] mt-0.5 truncate">
                {rec.reason}
              </p>
            </div>

            {/* Utilization */}
            {rec.action !== 'OFF' && (
              <div className="flex-shrink-0 text-right">
                <div className="text-xs font-black text-[var(--text-main)]">{rec.loadPercentage}%</div>
                <div className="text-[8px] font-bold text-[var(--text-light)] uppercase">Load</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Maintenance opportunities */}
      {decisions.maintenanceOpportunities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200/50">
          <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
            🔧 Maintenance Windows Detected
          </h5>
          <div className="space-y-2">
            {decisions.maintenanceOpportunities.map((win, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl neu-pressed text-[10px]">
                <div>
                  <span className="font-black text-[var(--text-main)]">{win.start}</span>
                  <span className="text-[var(--text-light)] mx-1">→</span>
                  <span className="font-black text-[var(--text-main)]">{win.end}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-light)] font-bold">Avg: {win.avgLoad} MW</span>
                  <span className="font-black text-emerald-600">{win.safetyMarginPercent}% margin</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionPanel;
