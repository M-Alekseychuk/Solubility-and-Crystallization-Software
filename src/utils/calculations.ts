import { CalibrationPoint, CalibrationResult, SampleData } from '../types';

export function calculateReactionConcentration(
  area: string | number,
  volumeTakenUl: string | number,
  addedSolventMl: string | number,
  calibrationResult: CalibrationResult
): number | null {
  if (!calibrationResult.valid || area === '' || volumeTakenUl === '' || addedSolventMl === '') {
    return null;
  }

  const areaNum = Number(String(area).replace(",", "."));
  const volTakenNum = Number(String(volumeTakenUl).replace(",", "."));
  const addedSolventNum = Number(String(addedSolventMl).replace(",", "."));

  if (isNaN(areaNum) || isNaN(volTakenNum) || isNaN(addedSolventNum) || volTakenNum <= 0) {
    return null;
  }

  const calculatedVialConc = (areaNum - calibrationResult.intercept) / calibrationResult.slope;
  const volTakenMl = volTakenNum / 1000;
  const totalVolMl = addedSolventNum + volTakenMl;
  const dilutionFactor = totalVolMl / volTakenMl;

  return calculatedVialConc * dilutionFactor;
}

export function enrichSamplesWithConcentration(
  samples: SampleData[],
  calibrationResult: CalibrationResult,
  decimals: number = 1
) {
  return samples.map(sample => {
    const rawReactionConc = calculateReactionConcentration(
      sample.area,
      sample.volumeTakenUl,
      sample.addedSolventMl,
      calibrationResult
    );
    
    const reactionConc = rawReactionConc !== null ? Number(rawReactionConc).toFixed(decimals) : '-';
    
    return { ...sample, rawReactionConc, reactionConc };
  });
}

export function getValidCalibrationPoints(calibrationData: CalibrationPoint[]) {
  return calibrationData
    .filter(p => {
      const vol = Number(String(p.volMl).replace(",", "."));
      const mass = Number(String(p.massMg).replace(",", "."));
      const area = Number(String(p.area).replace(",", "."));
      return p.massMg !== '' && p.volMl !== '' && p.area !== '' && !isNaN(vol) && vol > 0 && !isNaN(mass) && !isNaN(area);
    })
    .map(p => ({
      x: Number(String(p.massMg).replace(",", ".")) / Number(String(p.volMl).replace(",", ".")),
      y: Number(String(p.area).replace(",", "."))
    }))
    .sort((a, b) => a.x - b.x);
}
