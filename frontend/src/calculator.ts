/**
 * Brew Day Water Chemistry Calculator — Process-Based Model
 *
 * Calculates salt additions and lactic acid for separate mash and
 * sparge water volumes, then produces a combined mineral profile
 * for the finished beer.
 *
 * All salt contributions are per gram per gallon:
 *
 * Calcium Chloride (CaCl2·2H2O):
 *   Ca: 72 ppm/g/gal,  Cl: 127 ppm/g/gal
 *
 * Gypsum (CaSO4·2H2O):
 *   Ca: 61.5 ppm/g/gal, SO4: 147.4 ppm/g/gal
 *
 * Epsom Salt (MgSO4·7H2O):
 *   Mg: 26.1 ppm/g/gal, SO4: 103 ppm/g/gal
 */

export interface WaterProfile {
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  alkalinity: number;
  ph: number;
}

export interface StyleTarget {
  name: string;
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  ph_target: number;
}

export interface AdjustedProfile {
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  ph: number;
}

export interface ProcessResult {
  mash: {
    gypsum: number;
    calciumChloride: number;
    epsom: number;
    lacticAcid: number;
  };
  sparge: {
    lacticAcid: number;
  };
  adjusted: AdjustedProfile;
  totalWater: number;
}

// ── Salt contribution factors (ppm per gram per gallon) ──────────────
const CACL2_CA = 72;
const CACL2_CL = 127;
const GYPSUM_CA = 61.5;
const GYPSUM_SO4 = 147.4;
const EPSOM_MG = 26.1;
const EPSOM_SO4 = 103;

// ── Lactic acid constants ────────────────────────────────────────────
const GAL_TO_LITERS = 3.78541;

/**
 * 88% Lactic Acid: 1 milliequivalent (mEq) ≈ 0.09 mL.
 * 1 mEq neutralizes 50 mg/L (ppm) CaCO3 alkalinity per liter of water.
 */
const MEQ_ML_88_LACTIC = 0.09;
const MEQ_ALK_PER_LITER = 50;

/**
 * Alkalinity neutralization fraction mapped from target mash pH.
 *
 * Light-grain styles targeting pH 5.3 need ~80-85% of source alkalinity
 * neutralized; darker-grain styles targeting pH 5.4 need ~50-60%.
 * Values are linearly interpolated between these reference points and
 * clamped to [NEUT_FRAC_AT_HIGH, NEUT_FRAC_AT_LOW].
 */
const NEUT_PH_LOW = 5.3;
const NEUT_PH_HIGH = 5.4;
const NEUT_FRAC_AT_LOW = 0.825; // 82.5 % at pH 5.3
const NEUT_FRAC_AT_HIGH = 0.55; // 55 %   at pH 5.4

function neutralizationFraction(targetPh: number): number {
  if (targetPh <= NEUT_PH_LOW) return NEUT_FRAC_AT_LOW;
  if (targetPh >= NEUT_PH_HIGH) return NEUT_FRAC_AT_HIGH;
  const t = (targetPh - NEUT_PH_LOW) / (NEUT_PH_HIGH - NEUT_PH_LOW);
  return NEUT_FRAC_AT_LOW + t * (NEUT_FRAC_AT_HIGH - NEUT_FRAC_AT_LOW);
}

// ── Grain-buffer model (RO / low-alkalinity water) ───────────────────
/**
 * With DI/RO water a pale-malt mash lands near pH 5.7.
 * To push below that the brewer must add acid to overcome
 * the grain's own buffering capacity.
 *
 * Typical pale-malt buffer ≈ 2.6 mEq per pH unit per lb of grain
 * (derived from ~45 mEq/kg at standard grist ratios).
 */
const GRAIN_DI_MASH_PH = 5.7;
const GRAIN_BUFFER_MEQ_PER_PH_PER_LB = 2.6;

// ── Sparge water constants ───────────────────────────────────────────
/**
 * Sparge water target pH: 5.6 prevents tannin extraction.
 * At pH 5.6, ~95 % of bicarbonate alkalinity must be neutralized
 * (only ~5 % remains in equilibrium).
 */
export const SPARGE_TARGET_PH = 5.6;
const SPARGE_NEUT_FRACTION = 0.95;

// ── Acid calculations ────────────────────────────────────────────────

/**
 * Calculate mL of 88 % lactic acid for the **mash**.
 *
 * Two models are evaluated and the larger value is returned:
 * 1. Alkalinity neutralization — for water with bicarbonate buffering.
 * 2. Grain-buffer override — for RO / low-alk water where the grain's
 *    natural buffering from ~5.7 to target is the dominant factor.
 */
export function calculateAcid(
  sourceAlkalinity: number,
  targetPh: number,
  strikeWaterLiters: number,
  grainWeightLbs: number,
): number {
  // Model 1: alkalinity neutralization (dominates for normal tap water)
  const fraction = neutralizationFraction(targetPh);
  const alkToNeutralize = sourceAlkalinity * fraction;
  const alkMeq = (alkToNeutralize / MEQ_ALK_PER_LITER) * strikeWaterLiters;
  const alkAcid = alkMeq * MEQ_ML_88_LACTIC;

  // Model 2: grain-buffer acid (dominates for RO/low-alk water)
  const phDrop = Math.max(0, GRAIN_DI_MASH_PH - targetPh);
  const grainMeq = phDrop * GRAIN_BUFFER_MEQ_PER_PH_PER_LB * grainWeightLbs;
  const grainAcid = grainMeq * MEQ_ML_88_LACTIC;

  return round(Math.max(alkAcid, grainAcid), 1);
}

/**
 * Calculate mL of 88 % lactic acid for the **sparge** water.
 *
 * No grain buffer — purely alkalinity neutralization to reach
 * the safe sparge pH of 5.6.
 */
export function calculateSpargeAcid(
  sourceAlkalinity: number,
  spargeWaterLiters: number,
): number {
  const alkToNeutralize = sourceAlkalinity * SPARGE_NEUT_FRACTION;
  const mEq = (alkToNeutralize / MEQ_ALK_PER_LITER) * spargeWaterLiters;
  return round(mEq * MEQ_ML_88_LACTIC, 1);
}

// ── Main calculator ──────────────────────────────────────────────────

export function calculate(
  source: WaterProfile,
  target: StyleTarget,
  strikeGal: number,
  spargeGal: number,
  grainLbs: number,
): ProcessResult {
  const totalGal = strikeGal + spargeGal;

  // Deltas needed (ppm) – clamp to zero (we only add, not remove)
  const deltaCa = Math.max(0, target.ca - source.ca);
  const deltaMg = Math.max(0, target.mg - source.mg);
  const deltaSo4 = Math.max(0, target.so4 - source.so4);

  // Step 1: Use Epsom Salt to hit Mg target
  const epsomPerGal = deltaMg / EPSOM_MG;
  const so4FromEpsom = epsomPerGal * EPSOM_SO4;

  // Step 2: Remaining SO4 comes from Gypsum
  const remainingSo4 = Math.max(0, deltaSo4 - so4FromEpsom);
  const gypsumPerGal = remainingSo4 / GYPSUM_SO4;
  const caFromGypsum = gypsumPerGal * GYPSUM_CA;

  // Step 3: Remaining Ca comes from Calcium Chloride
  const remainingCa = Math.max(0, deltaCa - caFromGypsum);
  const cacl2PerGal = remainingCa / CACL2_CA;
  const clFromCaCl2 = cacl2PerGal * CACL2_CL;

  // Total grams for the full batch (added to mash water)
  const gypsum = round(gypsumPerGal * totalGal, 1);
  const epsom = round(epsomPerGal * totalGal, 1);
  const calciumChloride = round(cacl2PerGal * totalGal, 1);

  // Mash acid — includes grain-buffer model
  const mashAcid = calculateAcid(
    source.alkalinity,
    target.ph_target,
    strikeGal * GAL_TO_LITERS,
    grainLbs,
  );

  // Sparge acid — alkalinity neutralization only, target pH 5.6
  const spargeAcid = calculateSpargeAcid(
    source.alkalinity,
    spargeGal * GAL_TO_LITERS,
  );

  // Adjusted ion profile (concentration based on total water volume)
  const adjusted: AdjustedProfile = {
    ca: round(source.ca + caFromGypsum + cacl2PerGal * CACL2_CA, 1),
    mg: round(source.mg + epsomPerGal * EPSOM_MG, 1),
    na: source.na,
    cl: round(source.cl + clFromCaCl2, 1),
    so4: round(source.so4 + so4FromEpsom + gypsumPerGal * GYPSUM_SO4, 1),
    ph: round(target.ph_target, 1),
  };

  return {
    mash: { gypsum, calciumChloride, epsom, lacticAcid: mashAcid },
    sparge: { lacticAcid: spargeAcid },
    adjusted,
    totalWater: round(totalGal, 1),
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
