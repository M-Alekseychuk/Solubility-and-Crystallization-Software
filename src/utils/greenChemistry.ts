import { Solvent, EhsBreakdown } from '../types';

export interface BinaryMixtureCandidate {
  id: string;
  name: string;
  solvent1: Solvent;
  solvent2: Solvent;
  fraction1: number; // e.g. 0.70 (70%)
  fraction2: number; // e.g. 0.30 (30%)
  similarity: number;
  distance: number;
  hansenD: number;
  hansenP: number;
  hansenH: number;
  boilingPoint: number;
  polarityIndex: number;
  ehsScore: number;
  ehsBreakdown: EhsBreakdown;
  costPerKg?: number;
}

/**
 * Calculates a comprehensive 3-pillar EHS breakdown (Health, Safety, Environment)
 * calibrated according to standard green chemistry guides (Pfizer, GSK, Sanofi).
 * All scores are on a 1-10 scale where 10 = safest / greenest / least hazardous.
 */
export function getEhsBreakdown(solvent: Solvent): EhsBreakdown {
  const name = solvent.name.toLowerCase();
  const ich = Number(solvent.ichClass);
  const bp = Number(solvent.boilingPoint) || 100;
  const fp = solvent.flashPoint !== '' && solvent.flashPoint !== undefined ? Number(solvent.flashPoint) : null;
  const overall = Number(solvent.ehsScore) || 5;

  // 1. HEALTH & OCCUPATIONAL EXPOSURE (1-10)
  let health = 5;
  let healthNotes = '';

  if (name === 'water') {
    health = 10;
    healthNotes = 'Non-toxic, safe occupational profile.';
  } else if (ich === 1 || name.includes('benzene') || name.includes('carbon tetrachloride') || name.includes('dichloroethane')) {
    health = 1;
    healthNotes = 'ICH Class 1: Known human carcinogen or severe environmental toxin to be avoided.';
  } else if (name.includes('chloroform') || name.includes('dichloromethane') || name.includes('dcm')) {
    health = 3;
    healthNotes = 'ICH Class 2: Suspected carcinogen, high vapor pressure, neurological hazard.';
  } else if (name.includes('dimethylformamide') || name.includes('dmf') || name.includes('dimethylacetamide') || name.includes('nmp') || name.includes('pyrrolidone')) {
    health = 2;
    healthNotes = 'Reproductive toxin (teratogen) with dermal absorption hazard.';
  } else if (name.includes('hexane')) {
    health = 2;
    healthNotes = 'Peripheral neurotoxicity via 2,5-hexanedione metabolite.';
  } else if (ich === 2) {
    health = 4;
    healthNotes = `ICH Class 2: Limited exposure limit (${solvent.name}). Controlled handling required.`;
  } else if (ich === 3) {
    if (name.includes('ethanol') || name.includes('propanol') || name.includes('ethyl acetate')) {
      health = 8;
      healthNotes = 'ICH Class 3: Low toxic potential, high permitted daily exposure (PDE > 50 mg/day).';
    } else {
      health = 7;
      healthNotes = 'ICH Class 3: Generally recognized as low toxicological hazard in pharmaceuticals.';
    }
  } else {
    health = Math.min(9, Math.max(2, overall));
    healthNotes = 'Moderate occupational health profile.';
  }

  // 2. PROCESS SAFETY & FLAMMABILITY (1-10)
  let safety = 5;
  let safetyNotes = '';

  const isNonFlammable = name === 'water' || name.includes('dichloromethane') || name.includes('chloroform') || name.includes('carbon tetrachloride');

  if (isNonFlammable) {
    safety = 10;
    safetyNotes = 'Non-flammable under standard processing conditions.';
  } else if (fp !== null) {
    if (fp < -10) {
      safety = 3;
      safetyNotes = `Extreme flammability (Flash point ${fp}°C). Static discharge and vapor ignition risk.`;
    } else if (fp < 10) {
      safety = 4;
      safetyNotes = `High flammability (Flash point ${fp}°C). Low flash point requires nitrogen inerting.`;
    } else if (fp < 35) {
      safety = 6;
      safetyNotes = `Flammable liquid (Flash point ${fp}°C). Standard ATEX / explosion-proof controls.`;
    } else if (fp < 60) {
      safety = 8;
      safetyNotes = `Combustible liquid (Flash point ${fp}°C). Safer thermal processing envelope.`;
    } else {
      safety = 9;
      safetyNotes = `High flash point (${fp}°C). Low volatility and minimal vapor flammability hazard.`;
    }
  } else {
    // Default based on boiling point
    if (bp < 60) {
      safety = 4;
      safetyNotes = 'High volatility; potential combustible vapor formation.';
    } else if (bp > 150) {
      safety = 8;
      safetyNotes = 'Low volatility; elevated flash point expected.';
    } else {
      safety = 6;
      safetyNotes = 'Standard solvent flammability classification.';
    }
  }

  // Peroxide forming hazards (ethers)
  if (name.includes('ether') || name.includes('tetrahydrofuran') || name.includes('thf') || name.includes('dioxane')) {
    safety = Math.max(2, safety - 2);
    safetyNotes += ' Susceptible to hazardous organic peroxide formation upon storage.';
  }

  // 3. ENVIRONMENTAL IMPACT & FATE (1-10)
  let environment = 5;
  let envNotes = '';

  if (name === 'water') {
    environment = 10;
    envNotes = 'Zero VOC emissions, zero aquatic ecotoxicity.';
  } else if (name.includes('chloro') || name.includes('bromo') || name.includes('dichloro')) {
    environment = 2;
    envNotes = 'Halogenated organic waste: severe persistence, ozone depletion, or aquatic toxicity.';
  } else if (name.includes('benzene') || name.includes('hexane') || name.includes('toluene') || name.includes('heptane')) {
    environment = 4;
    envNotes = 'High VOC smog formation potential; toxic to aquatic organisms.';
  } else if (name.includes('ethanol') || name.includes('ethyl acetate') || name.includes('acetone') || name.includes('isopropanol') || name.includes('lactate')) {
    environment = 8;
    envNotes = 'Readily biodegradable, biogenic / renewable potential, non-persistent.';
  } else if (bp > 180 && !name.includes('chloro')) {
    environment = 7;
    envNotes = 'Negligible atmospheric VOC emissions; high boiling point.';
  } else {
    environment = Math.min(9, Math.max(3, overall));
    envNotes = 'Standard environmental waste treatment required.';
  }

  return {
    health,
    safety,
    environment,
    overall,
    healthNotes,
    safetyNotes,
    envNotes,
  };
}

/**
 * Checks if two solvents are miscible enough to form a single-phase binary mixture.
 */
export function areSolventsMiscible(s1: Solvent, s2: Solvent): boolean {
  if (s1.id === s2.id || s1.name.toLowerCase() === s2.name.toLowerCase()) return false;

  const w1 = s1.waterMiscibility;
  const w2 = s2.waterMiscibility;
  const name1 = s1.name.toLowerCase();
  const name2 = s2.name.toLowerCase();

  // Water + other solvent
  const isWater1 = name1 === 'water';
  const isWater2 = name2 === 'water';

  if (isWater1 || isWater2) {
    const otherSolvent = isWater1 ? s2 : s1;
    const wMisc = otherSolvent.waterMiscibility;
    
    // Only allow "Fully" miscible solvents to form arbitrary binary mixtures with water
    // across the 10-90% range used by our calculation.
    if (wMisc !== 'Fully') {
      return false;
    }
  }

  // Pure nonpolar hydrocarbons + polar protic water
  if ((s1.polarityProfile === 'Nonpolar' && name2 === 'water') || (s2.polarityProfile === 'Nonpolar' && name1 === 'water')) {
    return false;
  }

  // Otherwise, almost all common organic solvent pairs in pharma are miscible in mutual solution
  return true;
}

/**
 * Calculates optimized binary solvent mixtures that approximate the reference solvent's
 * Hansen Solubility Parameters (dD, dP, dH) using linear volume fractions:
 * d_mix = f1 * d1 + (1 - f1) * d2
 */
export function calculateBinaryMixtures(
  refSolvent: Solvent,
  candidates: Solvent[],
  maxResults = 6
): BinaryMixtureCandidate[] {
  const refHD = refSolvent.hansenD;
  const refHP = refSolvent.hansenP;
  const refHH = refSolvent.hansenH;

  if (refHD === undefined || refHP === undefined || refHH === undefined) {
    return [];
  }

  // Filter candidates that have full Hansen coordinates
  const validCandidates = candidates.filter(
    s => s.id !== refSolvent.id &&
         s.hansenD !== undefined &&
         s.hansenP !== undefined &&
         s.hansenH !== undefined
  );

  const results: BinaryMixtureCandidate[] = [];
  const evaluatedPairs = new Set<string>();

  for (let i = 0; i < validCandidates.length; i++) {
    for (let j = i + 1; j < validCandidates.length; j++) {
      const s1 = validCandidates[i];
      const s2 = validCandidates[j];

      const pairKey = [s1.id, s2.id].sort().join('_');
      if (evaluatedPairs.has(pairKey)) continue;
      evaluatedPairs.add(pairKey);

      if (!areSolventsMiscible(s1, s2)) continue;

      // Find optimal fraction f1 in [0.10, 0.90] in 5% steps
      let bestF1 = 0.5;
      let bestRa = Infinity;
      let bestMixD = 0;
      let bestMixP = 0;
      let bestMixH = 0;

      for (let f = 0.10; f <= 0.90; f += 0.05) {
        const f1 = Math.round(f * 100) / 100;
        const f2 = Math.round((1 - f1) * 100) / 100;

        const dD = f1 * s1.hansenD! + f2 * s2.hansenD!;
        const dP = f1 * s1.hansenP! + f2 * s2.hansenP!;
        const dH = f1 * s1.hansenH! + f2 * s2.hansenH!;

        // Ra^2 = 4(dD - refD)^2 + (dP - refP)^2 + (dH - refH)^2
        const Ra = Math.sqrt(
          4 * Math.pow(dD - refHD, 2) +
          Math.pow(dP - refHP, 2) +
          Math.pow(dH - refHH, 2)
        );

        if (Ra < bestRa) {
          bestRa = Ra;
          bestF1 = f1;
          bestMixD = dD;
          bestMixP = dP;
          bestMixH = dH;
        }
      }

      // Convert Ra to similarity %
      const similarity = Math.max(0, 100 - (bestRa / 15) * 100);

      // Only recommend mixtures that achieve reasonable similarity
      if (similarity < 65) continue;

      const f1 = bestF1;
      const f2 = Math.round((1 - bestF1) * 100) / 100;

      const pct1 = Math.round(f1 * 100);
      const pct2 = Math.round(f2 * 100);

      const bp1 = Number(s1.boilingPoint) || 80;
      const bp2 = Number(s2.boilingPoint) || 80;
      const blendedBp = Math.round((f1 * bp1 + f2 * bp2) * 10) / 10;

      const pi1 = Number(s1.polarityIndex) || 4;
      const pi2 = Number(s2.polarityIndex) || 4;
      const blendedPi = Math.round((f1 * pi1 + f2 * pi2) * 10) / 10;

      const ehs1 = Number(s1.ehsScore) || 5;
      const ehs2 = Number(s2.ehsScore) || 5;
      const blendedEhs = Math.round((f1 * ehs1 + f2 * ehs2) * 10) / 10;

      // EHS Breakdown for the blend
      const eb1 = getEhsBreakdown(s1);
      const eb2 = getEhsBreakdown(s2);
      const blendedHealth = Math.round((f1 * eb1.health + f2 * eb2.health) * 10) / 10;
      const blendedSafety = Math.round((f1 * eb1.safety + f2 * eb2.safety) * 10) / 10;
      const blendedEnv = Math.round((f1 * eb1.environment + f2 * eb2.environment) * 10) / 10;

      let blendedCost: number | undefined;
      const c1 = Number(s1.costPerKg);
      const c2 = Number(s2.costPerKg);
      if (!Number.isNaN(c1) && c1 > 0 && !Number.isNaN(c2) && c2 > 0) {
        blendedCost = Math.round((f1 * c1 + f2 * c2) * 100) / 100;
      }

      results.push({
        id: `binary-${s1.id}-${s2.id}-${pct1}`,
        name: `${pct1}% ${s1.name} + ${pct2}% ${s2.name}`,
        solvent1: s1,
        solvent2: s2,
        fraction1: f1,
        fraction2: f2,
        similarity,
        distance: bestRa,
        hansenD: Math.round(bestMixD * 10) / 10,
        hansenP: Math.round(bestMixP * 10) / 10,
        hansenH: Math.round(bestMixH * 10) / 10,
        boilingPoint: blendedBp,
        polarityIndex: blendedPi,
        ehsScore: blendedEhs,
        ehsBreakdown: {
          health: blendedHealth,
          safety: blendedSafety,
          environment: blendedEnv,
          overall: blendedEhs,
          healthNotes: `Blended Health (${blendedHealth}/10) from ${s1.name} and ${s2.name}.`,
          safetyNotes: `Blended Safety (${blendedSafety}/10), estimated boiling point ${blendedBp}°C.`,
          envNotes: `Blended Environmental rating (${blendedEnv}/10).`,
        },
        costPerKg: blendedCost,
      });
    }
  }

  // Sort by highest similarity
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, maxResults);
}
