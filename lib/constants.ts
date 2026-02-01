export const SCP_PERIOD = 99;
export const SYSTEM_EVENT_ID = 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7';

export function getSlotsPerDay(selectedDays: string[]) {
  return selectedDays.length === 2 ? 3 : 2;
}

export function getMonthlyTarget(selectedDays: string[]) {
  if (selectedDays.length === 2) return 8;
  if (selectedDays.length === 3) return 12;
  return selectedDays.length * 4;
}
