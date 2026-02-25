/**
 * Brew Day Water Chemistry Calculator
 *
 * Calculates salt additions (Calcium Chloride, Gypsum, Epsom Salt) and
 * lactic acid needed to transform source water into target style water.
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

export interface SaltAdditions {
  /** grams of Calcium Chloride (CaCl2·2H2O) */
  calciumChloride: number;
  /** grams of Gypsum (CaSO4·2H2O) */
  gypsum: number;
  /** grams of Epsom Salt (MgSO4·7H2O) */
  epsom: number;
  /** mL of 88% Lactic Acid */
  lacticAcid: number;
}

export interface AdjustedProfile {
  ca: number;
  mg: number;
  na: number;
  cl: number;
  so4: number;
  ph: number;
}

export interface CalculationResult {
  additions: SaltAdditions;
  adjusted: AdjustedProfile;
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

/** Default fraction of total batch used as mash/strike water. */
const STRIKE_WATER_RATIO = 0.75;

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
 * clamped to [NEUT_FRAC_HIGH, NEUT_FRAC_LOW].
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

/**
 * Calculate mL of 88 % lactic acid needed to neutralize the required
 * fraction of source alkalinity in the strike/mash water.
 *
 * @param sourceAlkalinity - Source water alkalinity in ppm as CaCO3
 * @param targetPh         - Desired mash pH (e.g. 5.3)
 * @param strikeWaterLiters - Volume of mash/strike water in liters
 * @returns mL of 88 % lactic acid, rounded to one decimal place
 */
export function calculateAcid(
  sourceAlkalinity: number,
  targetPh: number,
  strikeWaterLiters: number,
): number {
  const fraction = neutralizationFraction(targetPh);
  const alkToNeutralize = sourceAlkalinity * fraction;
  const mEq = (alkToNeutralize / MEQ_ALK_PER_LITER) * strikeWaterLiters;
  return round(mEq * MEQ_ML_88_LACTIC, 1);
}

// ── Main calculator ──────────────────────────────────────────────────

export function calculate(
  source: WaterProfile,
  target: StyleTarget,
  batchGallons: number,
): CalculationResult {
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

  // Total grams for the full batch
  const gypsum = round(gypsumPerGal * batchGallons, 1);
  const epsom = round(epsomPerGal * batchGallons, 1);
  const calciumChloride = round(cacl2PerGal * batchGallons, 1);

  // Step 4: Lactic acid — mEq formula on strike water only
  const strikeWaterLiters = batchGallons * STRIKE_WATER_RATIO * GAL_TO_LITERS;
  const lacticAcid = calculateAcid(
    source.alkalinity,
    target.ph_target,
    strikeWaterLiters,
  );

  // Adjusted ion profile (based on full batch volume)
  const adjusted: AdjustedProfile = {
    ca: round(source.ca + caFromGypsum + cacl2PerGal * CACL2_CA, 1),
    mg: round(source.mg + epsomPerGal * EPSOM_MG, 1),
    na: source.na,
    cl: round(source.cl + clFromCaCl2, 1),
    so4: round(source.so4 + so4FromEpsom + gypsumPerGal * GYPSUM_SO4, 1),
    ph: round(target.ph_target, 1),
  };

  return {
    additions: { calciumChloride, gypsum, epsom, lacticAcid },
    adjusted,
  };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
