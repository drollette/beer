import { useState, useEffect, useMemo } from "react";
import {
  calculate,
  SPARGE_TARGET_PH,
  DEFAULT_MASH_THICKNESS,
  DEFAULT_BOIL_TIME_HRS,
  type WaterProfile,
  type StyleTarget,
  type ProcessResult,
} from "./calculator";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_SOURCE: WaterProfile = {
  ca: 37.1,
  mg: 7.0,
  na: 43.7,
  cl: 14.2,
  so4: 56.2,
  alkalinity: 151.5,
  ph: 7.9,
};

const RO_SOURCE: WaterProfile = {
  ca: 0,
  mg: 0,
  na: 0,
  cl: 0,
  so4: 0,
  alkalinity: 0,
  ph: 7.0,
};

const STORAGE_KEY = "brewday-source-water";

const FALLBACK_STYLES: StyleTarget[] = [
  { name: "Hefeweizen", ca: 50, mg: 10, na: 10, cl: 60, so4: 30, ph_target: 5.4 },
  { name: "IPA", ca: 100, mg: 15, na: 25, cl: 50, so4: 275, ph_target: 5.3 },
  { name: "NEIPA", ca: 75, mg: 10, na: 20, cl: 150, so4: 50, ph_target: 5.3 },
  { name: "Marzen", ca: 75, mg: 15, na: 10, cl: 60, so4: 80, ph_target: 5.4 },
  { name: "Belgian Tripel", ca: 50, mg: 5, na: 15, cl: 35, so4: 40, ph_target: 5.3 },
  { name: "Mexican Lager", ca: 45, mg: 5, na: 10, cl: 25, so4: 30, ph_target: 5.3 },
  { name: "Stout", ca: 100, mg: 15, na: 30, cl: 125, so4: 50, ph_target: 5.4 },
];

// ── Helpers ──────────────────────────────────────────────────────────

function profilesEqual(a: WaterProfile, b: WaterProfile): boolean {
  return (
    a.ca === b.ca &&
    a.mg === b.mg &&
    a.na === b.na &&
    a.cl === b.cl &&
    a.so4 === b.so4 &&
    a.alkalinity === b.alkalinity &&
    a.ph === b.ph
  );
}

function profileLabel(source: WaterProfile): string {
  if (profilesEqual(source, DEFAULT_SOURCE)) return "Default Water Profile";
  if (profilesEqual(source, RO_SOURCE)) return "RO Water";
  return "Custom Water Profile";
}

function loadSource(): WaterProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* corrupted data — fall through */
  }
  return DEFAULT_SOURCE;
}

/** Parse a string to a non-negative number, or 0 if invalid. */
function toNum(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : n;
}

// ── Unit conversions ─────────────────────────────────────────────────

const GAL_TO_L = 3.78541;
const LB_TO_KG = 0.453592;
const QT_PER_LB_TO_L_PER_KG = GAL_TO_L / 4 / LB_TO_KG; // ≈ 2.086

function galToL(gal: number): string {
  return (gal * GAL_TO_L).toFixed(1);
}

function lbToKg(lb: number): string {
  return (lb * LB_TO_KG).toFixed(1);
}

function qtLbToLKg(qtPerLb: number): string {
  return (qtPerLb * QT_PER_LB_TO_L_PER_KG).toFixed(1);
}

// ── App ──────────────────────────────────────────────────────────────

export default function App() {
  const [source, setSource] = useState<WaterProfile>(loadSource);
  const [styles, setStyles] = useState<StyleTarget[]>(FALLBACK_STYLES);
  const [selectedStyle, setSelectedStyle] = useState("IPA");

  // String-backed inputs so the user can freely clear and retype
  const [grainStr, setGrainStr] = useState("12");
  const [targetVolStr, setTargetVolStr] = useState("8.0");
  const [mashThicknessStr, setMashThicknessStr] = useState(
    DEFAULT_MASH_THICKNESS.toString(),
  );
  const [boilTimeStr, setBoilTimeStr] = useState(
    DEFAULT_BOIL_TIME_HRS.toString(),
  );

  const grainLbs = toNum(grainStr);
  const targetVol = toNum(targetVolStr);
  const mashThickness = toNum(mashThicknessStr) || DEFAULT_MASH_THICKNESS;
  const boilTime = toNum(boilTimeStr) || DEFAULT_BOIL_TIME_HRS;

  // ── API + localStorage ─────────────────────────────────────────

  useEffect(() => {
    const hasSaved = localStorage.getItem(STORAGE_KEY) !== null;
    if (!hasSaved) {
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
    }

    fetch("/api/styles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setStyles(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [source]);

  // ── Calculation ────────────────────────────────────────────────

  const target = styles.find((s) => s.name === selectedStyle) ?? styles[0];

  const result: ProcessResult = useMemo(
    () => calculate(source, target, targetVol, grainLbs, mashThickness, boilTime),
    [source, target, targetVol, grainLbs, mashThickness, boilTime],
  );

  const sourceLabel = profileLabel(source);

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto px-4 py-6 font-mono">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-2xl font-bold text-amber-400">Brew Day Water Helper</h1>
        <p className="text-sm text-gray-500 mt-1">{sourceLabel}</p>
      </header>

      {/* Style selector + batch inputs */}
      <div className="mb-6">
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
        <div className="flex flex-wrap gap-4 mt-3">
          <VolumeInput
            label="Target Volume"
            unit="gal"
            value={targetVolStr}
            onChange={setTargetVolStr}
            metric={`${galToL(targetVol)} L`}
          />
          <VolumeInput
            label="Boil Time"
            unit="hrs"
            value={boilTimeStr}
            onChange={setBoilTimeStr}
          />
        </div>
      </div>

      {/* ── Mash Water ──────────────────────────────────────────── */}
      <Section title="Mash Water">
        <div className="flex flex-wrap gap-4 mb-4">
          <VolumeInput
            label="Grain Weight"
            unit="lbs"
            value={grainStr}
            onChange={setGrainStr}
            metric={`${lbToKg(grainLbs)} kg`}
          />
          <VolumeInput
            label="Mash Thickness"
            unit="qt/lb"
            value={mashThicknessStr}
            onChange={setMashThicknessStr}
            metric={`${qtLbToLKg(mashThickness)} L/kg`}
          />
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Strike Water: <span className="text-gray-300 font-semibold">{result.strikeGal} gal ({galToL(result.strikeGal)} L)</span>
        </p>

        <h3 className="text-xs text-gray-500 mb-2">Salt additions (into mash)</h3>
        <AdditionRow label="Gypsum (CaSO4)" value={result.mash.gypsum} unit="g" />
        <AdditionRow label="Calcium Chloride" value={result.mash.calciumChloride} unit="g" />
        <AdditionRow label="Epsom Salt (MgSO4)" value={result.mash.epsom} unit="g" />

        <div className="mt-3 pt-3 border-t border-gray-800">
          <AdditionRow label="88% Lactic Acid" value={result.mash.lacticAcid} unit="mL" />
          <p className="text-xs text-gray-500 mt-1">Target mash pH: {target.ph_target}</p>
        </div>
      </Section>

      {/* ── Sparge Water ────────────────────────────────────────── */}
      <Section title="Sparge Water">
        <p className="text-xs text-gray-500 mb-3">
          Sparge Volume: <span className="text-gray-300 font-semibold">{result.spargeGal} gal ({galToL(result.spargeGal)} L)</span>
        </p>

        <AdditionRow label="88% Lactic Acid" value={result.sparge.lacticAcid} unit="mL" />
        <p className="text-xs text-gray-500 mt-1">
          Target sparge pH: {SPARGE_TARGET_PH}
        </p>
      </Section>

      {/* ── Final Summary ───────────────────────────────────────── */}
      <Section title="Final Summary">
        <div className="mb-4 p-3 bg-gray-800/50 rounded text-xs text-gray-400">
          <p>
            Total Water Needed:{" "}
            <span className="text-gray-200 font-semibold">{result.totalWater} gal ({galToL(result.totalWater)} L)</span>
            {" "}(Includes {result.totalLossGal} gal / {galToL(result.totalLossGal)} L loss to grain/boil)
          </p>
          <p className="mt-1 text-gray-500">
            Grain absorption: {result.grainAbsorptionGal} gal ({galToL(result.grainAbsorptionGal)} L)
            {" · "}Boil-off: {result.boilOffGal} gal ({galToL(result.boilOffGal)} L)
          </p>
        </div>

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

      {/* ── Source Water ─────────────────────────────────────────── */}
      <Section title="Source Water (editable)">
        <div className="flex flex-row flex-wrap gap-4">
          <SourceInput label="Ca" value={source.ca} onChange={(v) => setSource({ ...source, ca: v })} />
          <SourceInput label="Mg" value={source.mg} onChange={(v) => setSource({ ...source, mg: v })} />
          <SourceInput label="Na" value={source.na} onChange={(v) => setSource({ ...source, na: v })} />
          <SourceInput label="Cl" value={source.cl} onChange={(v) => setSource({ ...source, cl: v })} />
          <SourceInput label="SO4" value={source.so4} onChange={(v) => setSource({ ...source, so4: v })} />
          <SourceInput label="Alkalinity" value={source.alkalinity} onChange={(v) => setSource({ ...source, alkalinity: v })} />
          <SourceInput label="pH" value={source.ph} onChange={(v) => setSource({ ...source, ph: v })} />
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setSource(DEFAULT_SOURCE)}
            className="flex-1 py-2 text-xs text-amber-500 hover:text-amber-400 border border-amber-500/30 rounded hover:border-amber-400/50 transition-colors"
          >
            Reset to defaults
          </button>
          <button
            onClick={() => setSource(RO_SOURCE)}
            className="flex-1 py-2 text-xs text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded hover:border-blue-300/50 transition-colors"
          >
            Use RO Water
          </button>
        </div>
      </Section>

      <footer className="mt-8 text-center text-xs text-gray-600">
        beer.w7hak.com &middot; v{import.meta.env.VITE_APP_VERSION}
      </footer>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

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
        {value.toFixed(1)} <span className="text-gray-500 font-normal">{unit}</span>
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

/**
 * Text-mode numeric input that lets the user freely clear and
 * retype values without the browser clamping to min/max.
 */
function VolumeInput({
  label,
  unit,
  value,
  onChange,
  metric,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (val: string) => void;
  metric?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 shrink-0">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 text-right focus:border-amber-500 focus:outline-none"
      />
      <span className="text-xs text-gray-500">
        {unit}{metric ? ` (${metric})` : ""}
      </span>
    </div>
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
    <div className="flex items-center gap-2 min-w-[8rem] flex-1">
      <label className="text-xs text-gray-500 w-20 shrink-0">{label}</label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 focus:border-amber-500 focus:outline-none"
      />
    </div>
  );
}
