export const SCP_PERIOD = 99;

export function getSlotsPerDay(selectedDays: string[]) {
  return selectedDays.length === 2 ? 3 : (selectedDays.length === 1 ? 4 : 2);
}

export function getMonthlyTarget(selectedDays: string[]) {
  if (selectedDays.length === 2) return 8;
  if (selectedDays.length === 3) return 12;
  return selectedDays.length * 4;
}
