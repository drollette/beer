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
  /** ml of 88% Lactic Acid */
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

// Salt contribution factors in ppm per gram per gallon
const CACL2_CA = 72;
const CACL2_CL = 127;
const GYPSUM_CA = 61.5;
const GYPSUM_SO4 = 147.4;
const EPSOM_MG = 26.1;
const EPSOM_SO4 = 103;

/**
 * 88% Lactic Acid: ~0.684 mL neutralizes 50 ppm alkalinity (as CaCO3) per gallon.
 * Rearranged: each mL of 88% lactic acid reduces alkalinity by ~73 ppm per gallon.
 *
 * Mash pH drop: roughly 0.1 pH per 50 ppm alkalinity reduction (approximate).
 */
const LACTIC_88_ALK_REDUCTION_PER_ML_PER_GAL = 73;

export function calculate(
  source: WaterProfile,
  target: StyleTarget,
  batchGallons: number
): CalculationResult {
  // Deltas needed (ppm) – clamp to zero (we only add, not remove)
  const deltaCa = Math.max(0, target.ca - source.ca);
  const deltaMg = Math.max(0, target.mg - source.mg);
  const deltaCl = Math.max(0, target.cl - source.cl);
  const deltaSo4 = Math.max(0, target.so4 - source.so4);

  // Step 1: Use Epsom Salt to hit Mg target
  // Each g/gal contributes 26.1 ppm Mg and 103 ppm SO4
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

  // If Cl target isn't met by CaCl2 alone, we could add more, but
  // to keep it simple we only use CaCl2 for Ca. The Cl contribution
  // is a bonus. If Cl is already exceeded we don't reduce CaCl2
  // (Ca takes priority).

  // Total grams for the full batch
  const gypsum = round(gypsumPerGal * batchGallons, 1);
  const epsom = round(epsomPerGal * batchGallons, 1);
  const calciumChloride = round(cacl2PerGal * batchGallons, 1);

  // Step 4: Lactic acid for alkalinity / pH
  // Target mash pH (from style). Source pH and alkalinity determine how
  // much acid is needed.
  const targetPh = target.ph_target;
  const phDrop = source.ph - targetPh;

  // Alkalinity to neutralize: we want to bring residual alkalinity down
  // enough to achieve target mash pH. A rough model:
  // Each 50 ppm reduction in alkalinity drops mash pH by ~0.1
  // So ppm reduction needed = phDrop * 500
  const alkReductionPpm = Math.max(0, phDrop * 500);

  // mL of 88% lactic acid needed for the full batch
  const lacticPerGal = alkReductionPpm / LACTIC_88_ALK_REDUCTION_PER_ML_PER_GAL;
  const lacticAcid = round(lacticPerGal * batchGallons, 1);

  // Compute adjusted profile
  const adjusted: AdjustedProfile = {
    ca: round(source.ca + caFromGypsum + cacl2PerGal * CACL2_CA, 1),
    mg: round(source.mg + epsomPerGal * EPSOM_MG, 1),
    na: source.na, // unchanged by these salts
    cl: round(source.cl + clFromCaCl2, 1),
    so4: round(source.so4 + so4FromEpsom + gypsumPerGal * GYPSUM_SO4, 1),
    ph: round(targetPh, 1),
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
