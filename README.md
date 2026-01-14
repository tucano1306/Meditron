# Meditron - Control de Horas de Trabajo

Aplicación para calcular horas de trabajo semanales y mensuales con tarifa de $25/hora.

## Características

- ⏱️ **Timer con botón de Inicio/Parada** - Comienza a contar cuando presionas INICIAR y detiene cuando presionas DETENER
- 📅 **Cálculo automático por día, semana y mes** - Las semanas van de Lunes a Domingo
- 💰 **Cálculo de ganancias** - Horas × $25 USD
- 📊 **Historial completo** - Ve todas tus semanas y meses registrados
- 🔢 **Numeración de semanas** - Semanas numeradas 1, 2, 3... por año

## Stack Tecnológico

- **Next.js 15** (App Router)
- **TypeScript 5**
- **PostgreSQL + Prisma ORM 5.20**
- **Radix UI + Tailwind CSS**
- **Lucide React** (íconos)

## Configuración

### 1. Configurar Base de Datos (PostgreSQL)

#### Opción A: Neon (Recomendado - Gratis en la nube)

1. Ve a [neon.tech](https://neon.tech) y crea una cuenta gratis
2. Crea un nuevo proyecto llamado "meditron"
3. Copia el connection string que te dan
4. Actualiza el archivo `.env`:

```env
DATABASE_URL="postgresql://tu-usuario:tu-password@tu-host.neon.tech/meditron?sslmode=require"
```

#### Opción B: PostgreSQL Local

1. Instala PostgreSQL en tu máquina
2. Crea una base de datos llamada "meditron"
3. Actualiza `.env` con tus credenciales:

```env
DATABASE_URL="postgresql://postgres:tu-password@localhost:5432/meditron?schema=public"
```

#### Opción C: Docker

```bash
docker run --name meditron-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meditron -p 5432:5432 -d postgres:15
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la base de datos

```bash
npx prisma db push
```

### 4. Ejecutar la aplicación

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Uso

1. **Iniciar trabajo**: Presiona el botón verde "INICIAR"
2. **El timer comienza**: Verás las horas:minutos:segundos y el dinero acumulado
3. **Detener trabajo**: Presiona el botón rojo "DETENER"
4. **Ver resúmenes**: 
   - Pestaña "Hoy" - Entradas del día actual
   - Pestaña "Semanas" - Historial por semanas (Lunes-Domingo)
   - Pestaña "Meses" - Resumen mensual

## Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── dashboard/   # Dashboard principal
│   │   ├── entries/     # CRUD de entradas
│   │   ├── months/      # Resúmenes mensuales
│   │   ├── timer/       # Iniciar/detener timer
│   │   └── weeks/       # Datos por semana
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/              # Componentes de UI (Button, Card, etc.)
│   ├── Dashboard.tsx    # Componente principal
│   ├── EntryList.tsx    # Lista de entradas
│   ├── MonthSummary.tsx # Resumen mensual
│   ├── SummaryCards.tsx # Tarjetas de resumen
│   ├── Timer.tsx        # Componente del timer
│   └── WeekHistory.tsx  # Historial de semanas
├── lib/
│   ├── prisma.ts        # Cliente de Prisma
│   ├── utils.ts         # Utilidades (formateo, cálculos)
│   └── week-utils.ts    # Lógica de semanas
├── types/
│   └── index.ts         # Tipos TypeScript
└── prisma/
    └── schema.prisma    # Esquema de la BD
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard` | Obtiene todos los datos del dashboard |
| POST | `/api/timer` | Inicia el timer |
| PUT | `/api/timer` | Detiene el timer |
| GET | `/api/timer` | Estado actual del timer |
| GET | `/api/entries` | Lista entradas |
| DELETE | `/api/entries?id=X` | Elimina una entrada |
| GET | `/api/weeks` | Lista semanas |
| GET | `/api/months` | Lista resúmenes mensuales |

## Licencia

MIT
