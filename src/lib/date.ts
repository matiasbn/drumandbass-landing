import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/es';

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('es')

// Las fechas del CMS son hora local de CHILE (TEXT 'YYYY-MM-DDTHH:mm', sin tz).
// En el server (Vercel = UTC) hay que interpretarlas en esta zona, si no la
// vigencia de eventos se calcula corrida por el offset UTC↔Chile.
export const CHILE_TZ = 'America/Santiago';

export default dayjs