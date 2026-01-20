# Resumen Semanal de Pagos

## Nueva Funcionalidad Agregada

Se ha agregado un nuevo tab "Resumen" en el dashboard de pagos que muestra un resumen semanal con:

### Características:

1. **Número de trabajos completados por semana**
2. **Total de horas trabajadas**  
3. **Monto calculado** (según las horas y tarifas registradas)
4. **Monto pagado por la compañía** (registrable manualmente)
5. **Diferencia entre lo calculado y lo pagado**
6. **Porcentaje de variación**

### Cómo usar:

1. Ve al dashboard de pagos (`/dashboard/payment`)
2. Haz clic en el tab **"Resumen"**
3. Verás todas las semanas de los últimos 60 días con sus estadísticas
4. Para registrar el pago de la compañía:
   - Haz clic en el botón **"Registrar"** (si no hay pago registrado)
   - O haz clic en el ícono de **editar** (si ya hay un pago registrado)
   - Ingresa el monto que la compañía pagó por esa semana
   - Haz clic en el ícono de **guardar**

### Cambios en la base de datos:

Se agregaron dos nuevos campos al modelo `PaymentEntry`:
- `companyPaid`: El monto que la compañía pagó por ese trabajo
- `companyPaidDate`: La fecha en que se registró el pago de la compañía

### Archivos modificados:

1. **Schema de Base de Datos**
   - `prisma/schema.prisma` - Agregados campos `companyPaid` y `companyPaidDate`

2. **Nuevos Componentes**
   - `src/components/WeeklySummary.tsx` - Componente principal del resumen semanal

3. **Nuevas Rutas API**
   - `src/app/api/payment/weekly-summary/route.ts` - Obtiene estadísticas semanales
   - `src/app/api/payment/update-company-payment/route.ts` - Actualiza el pago de la compañía

4. **Páginas Modificadas**
   - `src/app/dashboard/payment/page.tsx` - Agregado nuevo tab "Resumen"

### Indicadores visuales:

- **Verde con flecha hacia arriba**: La compañía pagó más de lo calculado
- **Rojo con flecha hacia abajo**: La compañía pagó menos de lo calculado
- **Advertencia naranja**: No se ha registrado el pago de la compañía para esa semana

### Distribución del pago:

Cuando registras el pago de la compañía para una semana, el sistema:
1. Identifica todos los trabajos de esa semana
2. Distribuye el pago proporcionalmente entre los trabajos según el monto calculado de cada uno
3. Guarda la fecha en que se registró el pago

Esto permite un seguimiento detallado de las diferencias entre lo que calculas que deberían pagarte y lo que realmente te pagan.
