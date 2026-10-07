# Generador integrado

Copia del `index.html` de `judaicadesign/fonetica-hebreo`, recuperada el 7 de octubre de 2026. El desarrollo del motor continúa en ese repositorio.

El sistema lo carga dentro de un iframe aislado, al abrir la sección después del login. El iframe no recibe sesiones ni datos comerciales. La página independiente sigue siendo pública, igual que el repositorio de origen.

La única adaptación de integración es `jd-embed.js`: informa la altura del contenido para evitar un scroll dentro del generador. El padre valida la ventana emisora y recibe solo un número; no se modifican las reglas del motor.
