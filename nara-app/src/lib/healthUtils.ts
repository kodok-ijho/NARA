export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 22;
  return weightKg / Math.pow(heightCm / 100, 2);
}

export function getBMICategory(bmi: number, t: (key: string) => string): string {
  if (bmi < 18.5) return t('raga.underweight') || "Underweight";
  if (bmi < 25) return t('raga.normal') || "Normal Weight";
  if (bmi < 30) return t('raga.overweight') || "Overweight";
  return t('raga.obese') || "Obese";
}

export interface DayLog {
  calories: number;
}

export function calculatePointsForDay(
  dayLogs: DayLog[],
  targetKcal: number,
  bmi: number
): number {
  const total = dayLogs.reduce((s, l) => s + (l.calories || 0), 0);
  if (total === 0 || targetKcal === 0) return 0;

  const isLossMode = bmi > 24;
  const isGainMode = bmi < 19;

  let points = 0;
  if (isLossMode) {
    if (total <= targetKcal) {
      points = 100;
      if (Math.abs(total - targetKcal) < 100) points += 50;
    } else {
      points = -Math.floor((total - targetKcal) / 10);
    }
  } else if (isGainMode) {
    if (total >= targetKcal) {
      points = 100;
      if (Math.abs(total - targetKcal) < 100) points += 50;
    } else {
      points = -Math.floor((targetKcal - total) / 10);
    }
  } else {
    if (Math.abs(total - targetKcal) < 200) {
      points = 100;
    } else {
      points = -Math.floor(Math.abs(total - targetKcal) / 20);
    }
  }
  return points;
}

export function getRankByScore(score: number): string {
  if (score > 3000) return "Legendary Health";
  if (score > 1500) return "Nutrition Master";
  if (score > 500) return "Disciplined";
  return "Novice";
}
