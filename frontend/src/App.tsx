import { useState, useEffect, useMemo } from "react";
import {
  calculate,
  type WaterProfile,
  type StyleTarget,
  type CalculationResult,
} from "./calculator";

// Default source water: Meridian/83709 well baseline
const DEFAULT_SOURCE: WaterProfile = {
  ca: 37.1,
  mg: 7.0,
  na: 43.7,
  cl: 14.2,
  so4: 56.2,
  alkalinity: 151.5,
  ph: 7.9,
};

// Embedded style targets (fallback if API is unavailable)
const FALLBACK_STYLES: StyleTarget[] = [
  { name: "Hefeweizen", ca: 50, mg: 10, na: 10, cl: 60, so4: 30, ph_target: 5.4 },
  { name: "IPA", ca: 100, mg: 15, na: 25, cl: 50, so4: 275, ph_target: 5.3 },
  { name: "NEIPA", ca: 75, mg: 10, na: 20, cl: 150, so4: 50, ph_target: 5.3 },
  { name: "Marzen", ca: 75, mg: 15, na: 10, cl: 60, so4: 80, ph_target: 5.4 },
  { name: "Belgian Tripel", ca: 50, mg: 5, na: 15, cl: 35, so4: 40, ph_target: 5.3 },
  { name: "Mexican Lager", ca: 45, mg: 5, na: 10, cl: 25, so4: 30, ph_target: 5.3 },
  { name: "Stout", ca: 100, mg: 15, na: 30, cl: 125, so4: 50, ph_target: 5.4 },
];

export default function App() {
  const [source, setSource] = useState<WaterProfile>(DEFAULT_SOURCE);
  const [styles, setStyles] = useState<StyleTarget[]>(FALLBACK_STYLES);
  const [selectedStyle, setSelectedStyle] = useState<string>("IPA");
  const [batchSize, setBatchSize] = useState(8);

  // Try to load from API on mount
  useEffect(() => {
    fetch("/api/baseline")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setSource({
            ca: data.ca,
            mg: data.mg,
            na: data.na,
            cl: data.cl,
            so4: data.so4,
            alkalinity: data.alkalinity,
            ph: data.ph,
          });
        }
      })
      .catch(() => {});

    fetch("/api/styles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStyles(data);
        }
      })
      .catch(() => {});
  }, []);

  const target = styles.find((s) => s.name === selectedStyle) ?? styles[0];

  const result: CalculationResult = useMemo(
    () => calculate(source, target, batchSize),
    [source, target, batchSize]
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-6 font-mono">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-amber-400">Brew Day Water Helper</h1>
        <p className="text-sm text-gray-500 mt-1">Meridian, ID / 83709 Well</p>
      </header>

      {/* Style + Batch */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Beer Style</label>
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:border-amber-500 focus:outline-none"
          >
            {styles.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Batch (gal)</label>
          <input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={batchSize}
            onChange={(e) => setBatchSize(parseFloat(e.target.value) || 1)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-100 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Salt Additions */}
      <Section title="Salt Additions">
        <AdditionRow label="Gypsum (CaSO4)" value={result.additions.gypsum} unit="g" />
        <AdditionRow label="Calcium Chloride" value={result.additions.calciumChloride} unit="g" />
        <AdditionRow label="Epsom Salt (MgSO4)" value={result.additions.epsom} unit="g" />
      </Section>

      {/* Acid Addition */}
      <Section title="Acidification">
        <AdditionRow label="88% Lactic Acid" value={result.additions.lacticAcid} unit="mL" />
        <p className="text-xs text-gray-500 mt-2">
          Target mash pH: {target.ph_target} (source: {source.ph})
        </p>
      </Section>

      {/* Water Profile Comparison */}
      <Section title="Water Profile">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1">Ion</th>
                <th className="text-right py-1">Source</th>
                <th className="text-right py-1">Target</th>
                <th className="text-right py-1">Adjusted</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <ProfileRow ion="Ca" source={source.ca} target={target.ca} adjusted={result.adjusted.ca} />
              <ProfileRow ion="Mg" source={source.mg} target={target.mg} adjusted={result.adjusted.mg} />
              <ProfileRow ion="Na" source={source.na} target={target.na} adjusted={result.adjusted.na} />
              <ProfileRow ion="Cl" source={source.cl} target={target.cl} adjusted={result.adjusted.cl} />
              <ProfileRow ion="SO4" source={source.so4} target={target.so4} adjusted={result.adjusted.so4} />
              <ProfileRow ion="pH" source={source.ph} target={target.ph_target} adjusted={result.adjusted.ph} />
            </tbody>
          </table>
        </div>
      </Section>

      {/* Source Editable */}
      <Section title="Source Water (editable)">
        <div className="grid grid-cols-2 gap-2">
          <SourceInput label="Ca" value={source.ca} onChange={(v) => setSource({ ...source, ca: v })} />
          <SourceInput label="Mg" value={source.mg} onChange={(v) => setSource({ ...source, mg: v })} />
          <SourceInput label="Na" value={source.na} onChange={(v) => setSource({ ...source, na: v })} />
          <SourceInput label="Cl" value={source.cl} onChange={(v) => setSource({ ...source, cl: v })} />
          <SourceInput label="SO4" value={source.so4} onChange={(v) => setSource({ ...source, so4: v })} />
          <SourceInput label="Alkalinity" value={source.alkalinity} onChange={(v) => setSource({ ...source, alkalinity: v })} />
          <SourceInput label="pH" value={source.ph} onChange={(v) => setSource({ ...source, ph: v })} />
        </div>
        <button
          onClick={() => setSource(DEFAULT_SOURCE)}
          className="mt-3 text-xs text-amber-500 hover:text-amber-400"
        >
          Reset to Meridian defaults
        </button>
      </Section>

      <footer className="mt-8 text-center text-xs text-gray-600">
        beer.w7hak.com
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-amber-400 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function AdditionRow({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-sm text-gray-300">{label}</span>
      <span className="text-sm font-semibold text-gray-100">
        {value} <span className="text-gray-500 font-normal">{unit}</span>
      </span>
    </div>
  );
}

function ProfileRow({
  ion,
  source,
  target,
  adjusted,
}: {
  ion: string;
  source: number;
  target: number;
  adjusted: number;
}) {
  const delta = adjusted - target;
  const color =
    Math.abs(delta) <= 5 ? "text-green-400" : Math.abs(delta) <= 20 ? "text-yellow-400" : "text-red-400";

  return (
    <tr className="border-b border-gray-800 last:border-0">
      <td className="py-1 font-semibold">{ion}</td>
      <td className="py-1 text-right text-gray-500">{source}</td>
      <td className="py-1 text-right">{target}</td>
      <td className={`py-1 text-right font-semibold ${color}`}>{adjusted}</td>
    </tr>
  );
}

function SourceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-16">{label}</label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}
