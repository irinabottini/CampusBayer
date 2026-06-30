# Campus Bayer

PWA para gestión de visitas y capacitaciones: eventos, asistentes, QR, asistencia, métricas y calendario mensual imprimible.

## Supabase
Tablas esperadas:
- usuarios_app
- eventos
- asistentes_eventos
- asistencia

Si aparece error con `created_at`, la app v6 ya no lo usa para ordenar. Igual es recomendable tenerlo con default automático:

```sql
alter table eventos add column if not exists created_at timestamp with time zone default now();
alter table eventos alter column created_at set default now();
update eventos set created_at = now() where created_at is null;
```

Columnas recomendadas para eventos:

```sql
alter table eventos add column if not exists fecha_inicio timestamp with time zone;
alter table eventos add column if not exists fecha_fin timestamp with time zone;
alter table eventos add column if not exists evento text;
alter table eventos add column if not exists lugar text;
alter table eventos add column if not exists tematica text;
alter table eventos add column if not exists modalidad text;
alter table eventos add column if not exists detalles text;
alter table eventos add column if not exists creado_por text;
```

## Publicación
Subir a GitHub Pages. La app es instalable porque incluye `manifest.json` y `service-worker.js`.

## Cambios v7
- Crear evento queda como primera pestaña para administradores/organizadores.
- Histórico de eventos queda en pestaña independiente.
- Generación de QR, credenciales y pulseras con barra de progreso y mensajes de estado.
- PDFs optimizados para varias piezas por hoja A4.
