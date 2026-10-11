# Cotización B612 de cuadrípticos

Implementado el 11/10/2026 sobre la versión publicada del sistema, sin migrar ni reemplazar datos del catálogo, reglas comerciales o presupuestos guardados.

## Especificación verificada

- Formato abierto: 391 × 190 mm. Cerrado: 100 × 190 mm (se conserva la ficha del catálogo).
- Ilustración 300 g, full color doble faz, laminado mate doble faz.
- Tres dobleces, con preparación de doblado y corte manual.
- Cantidades: 50, 75, 100 y 150 unidades totales.
- Cantidad de diseños independiente de la cantidad de unidades; campo interno del presupuesto.

B612 tiene la categoría activa `105`, “Postales con doblez”, y el cotizador `80`, aunque la categoría no se muestra en el menú público. Se consultan sus etapas y precios vigentes, incluyendo `DOBX3`, `D1`, `C2` y el adicional `VARIANTE-POSTALES` por diseños extra. La alternativa simple faz del papel se resuelve a doble faz sin cobrar ambas alternativas de corte.

## Comparación de las referencias del usuario

- [1198167](https://www.graficab612.com/reportes/presupuesto.pdf?pedido=1198167), 24/04/2026: “cuadrípticos”, mismas medidas, papel, laminado y tres dobleces. Incluye cuatro opciones de cantidad. Su total general suma las opciones; no representa una sola tirada.
- [1291996](https://www.graficab612.com/reportes/presupuesto.pdf?pedido=1291996), 02/09/2026: “Postales con doblez”, 50 unidades totales, dos diseños de 25 unidades. $142.242,96 sin IVA; $172.113,98 con IVA.

La consulta a los precios vigentes reprodujo exactamente el presupuesto 1291996. No se atribuye la diferencia con la referencia de abril solamente al nombre: son fechas y configuraciones de diseños distintas.

| Unidades | Un diseño, sin IVA | Dos diseños, sin IVA |
| --- | ---: | ---: |
| 50 | $136.292,96 | $142.242,96 |
| 75 | $185.568,71 | $191.518,71 |
| 100 | $221.233,96 | $227.183,96 |
| 150 | $318.320,96 | $324.270,96 |

Precios consultados el 11/10/2026. El adicional por un diseño extra fue $5.950 sin IVA. Los valores históricos no se usan como tarifas fijas: cada consulta nueva obtiene artículos y escalas actuales de B612.

## Comportamiento del sistema

Se mantiene la regla comercial elegida para el producto: costo B612 sin IVA / divisor + envío del proveedor + adicional de la regla, con el redondeo comercial existente. El IVA de B612 se conserva como referencia, sin cambiar la base comercial. El detalle de artículos, fecha, categoría y diseños se guarda como referencia interna del costo.

Los diseños persisten al guardar, editar y cambiar de alternativa. La caché diferencia diseños y medidas, vence a los cinco minutos y puede renovarse con “Actualizar precios B612”. Si falla B612 o desaparece el artículo de tres dobleces, el sistema bloquea la cotización; no reemplaza el costo con una referencia vieja. Se conserva la autenticación y la lista de acceso del equipo.

Esta integración calcula precios. No crea presupuestos/pedidos en la imprenta ni envía archivos de impresión.

## Validación

`npm test` incluye la comparación exacta del presupuesto 1291996, ambas configuraciones de diseños en las cuatro cantidades, papel doble faz, tres dobleces, cargos sin duplicación, errores de proveedor/autenticación, regla comercial, persistencia y bloqueo si B612 no responde. La prueba de datos actuales utiliza exclusivamente APIs públicas de lectura de B612. La prueba local del handler simula la autenticación; no suplanta usuarios en producción.
