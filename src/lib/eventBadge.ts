import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isToday);
dayjs.extend(isTomorrow);
dayjs.extend(isoWeek);

export interface ProximityBadge {
  label: string;
  color: string;
  dot?: boolean; // punto blanco parpadeante
  endTime?: string; // hora de finalización (HH:mm), solo HOY/MAÑANA
}

// Badge de proximidad de un evento, relativo a `now`. Depende de la fecha actual,
// por eso se calcula en el cliente (ver ProximityBadge.tsx): si se horneara en el
// HTML cacheado por ISR quedaría desactualizado en producción.
export function getProximityBadge(date: string, endDate?: string): ProximityBadge | null {
  const now = dayjs();
  const eventStart = dayjs(date);
  const eventEnd = endDate ? dayjs(endDate) : eventStart;
  // Hora de término para los badges de HOY/MAÑANA (solo si hay endDate).
  const endTime = endDate ? dayjs(endDate).format('HH:mm') : undefined;

  if (now.isAfter(eventStart) && now.isBefore(eventEnd))
    return { label: 'AHORA', color: 'bg-green-600', dot: true };
  if (eventStart.isToday()) return { label: 'HOY', color: 'bg-red-600', dot: true, endTime };
  if (eventStart.isTomorrow()) return { label: 'MAÑANA', color: 'bg-orange-500', endTime };
  const daysUntil = eventStart.startOf('day').diff(now.startOf('day'), 'day');
  if (daysUntil <= 0) return null;
  // Comparar semanas de calendario (lunes-domingo), no días corridos.
  const weeksUntil = eventStart.startOf('isoWeek').diff(now.startOf('isoWeek'), 'week');
  if (weeksUntil === 0) return { label: 'ESTA SEMANA', color: 'bg-yellow-500 text-black' };
  if (weeksUntil === 1) return { label: 'PRÓXIMA SEMANA', color: 'bg-green-600' };
  return null;
}
