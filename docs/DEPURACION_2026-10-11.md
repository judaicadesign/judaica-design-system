# Estado y depuración · Judaica Design® · 11/10/2026

Base del sistema: `59a590ec89fe988e872b6c0e71b8a2ca3b715919`. Base del generador: `9604084ab28e4c5983d74492c6da220279d8eb1d`. Se trabajó en copias aisladas de los HEAD publicados; el checkout local con avances previos no se sobrescribió.

## Trabajo realizado

La copia antigua del generador en `fonetica/index.html` contenía otro motor de 148.620 bytes. Se reemplazó por una redirección a la versión vigente en `/fonetica-hebreo/`, con conservación de query y hash y enlace de respaldo. La pantalla del sistema ya utiliza el generador vigente; se preservó su integración aislada.

En el generador se retiraron 624 pronunciaciones que ya calculaban las reglas, un procedimiento antiguo no utilizado y funciones auxiliares vacías/sin consumidores. La comparación antes/después en 150 salmos, 2.527 versículos, no mostró ninguna diferencia. Se incorporó cobertura para que las sustituciones retiradas no regresen. Su ejecutor ahora descubre todas las pruebas y evita listas manuales incompletas y pasos duplicados.

Se preservan los másters, evidencias ArtScroll, TXT derivados, PDFs emitidos y sus revisiones. `tests/ui-preview.html` es una prueba visual aislada con datos sintéticos y documentada; no es otra aplicación conectada a datos reales. El historial Git y los objetos de Storage no se borraron.

## Peso medido

Magnitudes decimales (1 MB = 1.000.000 bytes), sin `.git`, dependencias de desarrollo ni archivos temporales. Valores aproximados tras incluir esta documentación y las pruebas nuevas:

| Parte | Tamaño |
| --- | ---: |
| Repositorio del sistema: código, másters, pruebas, evidencias | 5,49 MB |
| Repositorio del generador: código, pruebas, documentación | 0,43 MB |
| Archivos subidos `jd-assets`, 14 archivos | 26,76 MB |
| PDFs y revisiones `jd-quotes`, 7 archivos | 10,93 MB |
| Datos de aplicación, 13 colecciones, representación JSON | 0,79 MB |
| Suma aproximada de esas partes | 44,40 MB |

El JSON ocupa físicamente 336.599 bytes en columnas PostgreSQL; se usa su representación de 789.886 bytes en la suma para expresar datos transferibles. La suma no pretende medir índices/WAL, backups, historial completo de Git ni cuotas del proveedor. Los archivos externos de Nakdan/Google Fonts no son almacenamiento propio.

El navegador no descarga todo ese contenido al abrir: el HTML y los recursos locales declarados del sistema suman 1.14 MB sin compresión; el generador y su puente, 0,226 MB. Fuentes, mockups, másters y PDFs se consultan según su uso. Los fixtures nuevos se conservan para pruebas y no se cargan en la aplicación.

## Reglas y pendientes reales

El generador es todavía mixto. Además de las reglas, quedan 306 entradas heredadas para 270 claves distintas, 15 sustituciones de contexto y 10 spellings de observaciones. Su detalle y límites están en el registro de depuración del repositorio del generador. La información sobre posición del acento, nombres y marcas verificadas es distinta de una sustitución completa de la pronunciación.

La migración restante debe avanzar por familias gramaticales con variantes, contraejemplos y comparación contra evidencias. Ni coincidencia entre motor y máster ni ausencia de errores técnicos certifica por sí sola la fonética de los 150 salmos. No se cambiaron estados FINAL ni se adivinaron marcas pendientes.

## Fallos y notificaciones

Al iniciar esta revisión, la última auditoría del generador (`9604084`) estaba correcta. Entre las ejecuciones anteriores había fallos (`a5b43df`, `a5fd8d0`). Sus correos históricos no implican que la última versión siga fallando. No se desactivaron los avisos de errores. La versión actual se publica después de pasar las pruebas; los resultados de publicación se verifican en GitHub Actions.

## Validación

Pruebas comerciales, autenticación, cotización B612, sincronización, presupuestos y vínculos de másters: suite completa del sistema. Nueva prueba: antigua dirección fonética sin motor duplicado y redirección con parámetros. Generador: 13/13 comprobaciones; auditoría técnica de 150 salmos sin flags; comparación de todo el corpus sin cambios; salmo 14 actual coincide 7/7.
