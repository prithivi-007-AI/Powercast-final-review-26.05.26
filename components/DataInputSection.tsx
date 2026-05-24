
import React from 'react';
import { GeneratorUnit, LoadDataPoint, HorizonUnit, PlantType } from '../types';

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
  plantType: PlantType;
  setPlantType: (type: PlantType) => void;
}

// ── Plant type definitions ──
const PLANT_TYPES: { type: PlantType; icon: string; label: string; color: string }[] = [
  { type: 'Solar',   icon: '☀️',  label: 'Solar',   color: '#f59e0b' },
  { type: 'Wind',    icon: '💨',  label: 'Wind',    color: '#06b6d4' },
  { type: 'Hydro',   icon: '💧',  label: 'Hydro',   color: '#3b82f6' },
  { type: 'Thermal', icon: '🔥',  label: 'Thermal', color: '#ef4444' },
  { type: 'Nuclear', icon: '⚛️',  label: 'Nuclear', color: '#8b5cf6' },
  { type: 'Hybrid',  icon: '⚡☀', label: 'Hybrid',  color: '#10b981' },
];

const DEFAULT_FUEL_COST: Record<PlantType, number> = {
  Solar:   0,
  Wind:    0,
  Hydro:   800,
  Hybrid:  500,
  Nuclear: 1200,
  Thermal: 6500,
};

const DEFAULT_EFFICIENCY: Record<PlantType, number> = {
  Solar:   22,
  Wind:    40,
  Hydro:   90,
  Hybrid:  55,
  Nuclear: 33,
  Thermal: 38,
};

const DataInputSection: React.FC<Props> = ({
  onDataLoaded, units, setUnits,
  horizonValue, setHorizonValue, horizonUnit, setHorizonUnit,
  lookBack, setLookBack,
  plantType, setPlantType
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

  const addUnit = () => {
    const newUnit: GeneratorUnit = {
      id: `U${units.length + 1}`,
      name: `Unit ${units.length + 1}`,
      capacity: 200,
      status: 'OFF',
      type: plantType,
      efficiency: DEFAULT_EFFICIENCY[plantType],
      fuelCost: DEFAULT_FUEL_COST[plantType],
    };
    setUnits([...units, newUnit]);
  };

  return (
    <div className="space-y-6 neu-flat p-6">
      <div className="flex items-center gap-2 border-b border-gray-200 pb-4">
        <div className="w-2 h-6 bg-[var(--accent)] rounded-full"></div>
        <h2 className="text-xl font-black text-[var(--text-main)] tracking-tight">System Input</h2>
      </div>

      <div className="space-y-5">

        {/* ── Plant Type Selector ── */}
        <section>
          <label className="block text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest mb-3">
            Configure Plant Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PLANT_TYPES.map(({ type, icon, label, color }) => {
              const isActive = plantType === type;
              return (
                <button
                  key={type}
                  onClick={() => setPlantType(type)}
                  className={`plant-type-btn flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all duration-200 border ${
                    isActive
                      ? 'neu-pressed border-transparent'
                      : 'neu-flat border-transparent hover:border-gray-200/60'
                  }`}
                  style={isActive ? { borderColor: `${color}40`, boxShadow: `inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light), 0 0 0 1px ${color}30` } : {}}
                  title={`${type} plant type`}
                >
                  <span className="text-lg leading-none">{icon}</span>
                  <span
                    className="text-[9px] font-black uppercase tracking-widest leading-none"
                    style={{ color: isActive ? color : 'var(--text-light)' }}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
          {plantType === 'Hybrid' && (
            <p className="mt-2 text-[9px] text-[var(--text-light)] font-medium leading-relaxed opacity-80">
              ⚡ Hybrid combines solar + wind + storage for mixed renewable generation
            </p>
          )}
        </section>

        {/* ── Historical Dataset ── */}
        <section>
          <label className="block text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest mb-2">
            Historical Dataset
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-xs text-[var(--text-main)] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:bg-[var(--bg-color)] file:text-[var(--accent)] file:shadow-[5px_5px_10px_#a3b1c6,-5px_-5px_10px_#ffffff] hover:file:translate-y-[-1px] cursor-pointer"
          />
        </section>

        {/* ── Forecast Horizon ── */}
        <section>
          <label className="block text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest mb-2">
            Forecast Horizon
          </label>
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
        </section>

        {/* ── Generation Fleet ── */}
        <section>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-[var(--text-light)] uppercase tracking-widest">
              Generation Fleet
            </label>
            <button onClick={addUnit} className="neu-btn px-3 py-1 text-[10px]">
              + Add
            </button>
          </div>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
            {units.map((unit, idx) => {
              const pt = PLANT_TYPES.find(p => p.type === unit.type);
              return (
                <div key={unit.id} className="flex items-center gap-2 neu-pressed p-2 rounded-xl">
                  <span className="text-sm leading-none flex-shrink-0" title={unit.type}>{pt?.icon ?? '⚡'}</span>
                  <span className="text-[9px] font-black text-[var(--text-light)] w-7 flex-shrink-0">{unit.id}</span>
                  <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => {
                      const n = [...units];
                      n[idx] = { ...n[idx], name: e.target.value };
                      setUnits(n);
                    }}
                    className="flex-1 bg-transparent border-none text-[10px] font-bold text-[var(--text-main)] outline-none min-w-0"
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    value={unit.capacity}
                    onChange={(e) => {
                      const n = [...units];
                      n[idx] = { ...n[idx], capacity: parseFloat(e.target.value) || 0 };
                      setUnits(n);
                    }}
                    className="w-16 bg-transparent border-none text-[10px] font-bold text-right text-[var(--text-main)] outline-none"
                    placeholder="MW"
                  />
                  <span className="text-[9px] text-[var(--text-light)] font-bold">MW</span>
                  <button
                    onClick={() => setUnits(units.filter((_, i) => i !== idx))}
                    className="text-[var(--text-light)] hover:text-red-500 px-1 font-bold text-sm leading-none flex-shrink-0"
                  >×</button>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};

export default DataInputSection;
