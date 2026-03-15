
import React from 'react';
import { GeneratorUnit, LoadDataPoint, HorizonUnit } from '../types';

interface Props {
  onDataLoaded: (data: LoadDataPoint[]) => void;
  units: GeneratorUnit[];
  setUnits: (units: GeneratorUnit[]) => void;
  horizonValue: number;
  setHorizonValue: (val: number) => void;
  horizonUnit: HorizonUnit;
  setHorizonUnit: (val: HorizonUnit) => void;
  lookBack: number;
  setLookBack: (val: number) => void;
}

const DataInputSection: React.FC<Props> = ({
  onDataLoaded, units, setUnits, horizonValue, setHorizonValue, horizonUnit, setHorizonUnit, lookBack, setLookBack
}) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = (event.target?.result as string).split('\n');
      const parsedData: LoadDataPoint[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length === 2) {
          const load = parseFloat(parts[1]);
          if (!isNaN(load)) parsedData.push({ timestamp: parts[0].trim(), load });
        }
      }
      onDataLoaded(parsedData);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 neu-flat p-6">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
        <div className="w-2 h-6 bg-[var(--accent)] rounded-full"></div>
        <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight">System Input</h2>
      </div>

      <div className="space-y-4">
        <section>
          <label className="block text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest mb-2">Historical Dataset</label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-xs text-[var(--text-main)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-[var(--bg-color)] file:text-[var(--accent)] file:shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] hover:file:translate-y-[-1px] cursor-pointer"
          />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest mb-2">Forecast Horizon</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={horizonValue}
                onChange={(e) => setHorizonValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-[1.5] neu-input text-sm"
                placeholder="Value"
              />
              <select
                value={horizonUnit}
                onChange={(e) => setHorizonUnit(e.target.value as HorizonUnit)}
                className="flex-1 neu-input text-sm cursor-pointer"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest">Generation Fleet</label>
            <button
              onClick={() => setUnits([...units, { id: `U${units.length + 1}`, name: `Unit ${units.length + 1}`, capacity: 200, status: 'OFF' }])}
              className="neu-btn px-3 py-1 text-[10px]"
            >
              + Add
            </button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
            {units.map((unit, idx) => (
              <div key={unit.id} className="flex items-center gap-2 neu-pressed p-2 rounded-xl border border-transparent">
                <span className="text-[10px] font-black text-[var(--text-light)] w-8">{unit.id}</span>
                <input
                  type="number"
                  value={unit.capacity}
                  onChange={(e) => {
                    const n = [...units];
                    n[idx].capacity = parseFloat(e.target.value);
                    setUnits(n);
                  }}
                  className="flex-1 bg-transparent border-none text-xs font-bold text-[var(--text-main)] outline-none"
                />
                <button onClick={() => setUnits(units.filter((_, i) => i !== idx))} className="text-[var(--text-light)] hover:text-red-500 px-1 font-bold">×</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DataInputSection;
