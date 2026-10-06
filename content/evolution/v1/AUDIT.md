# Versión 1 (Angular) — auditoría

- Etiqueta de git: `v1-angular` (commit `8b5a237`). Repo: `github.com/VGA-DEV/PORTFOLIO`.
- Desplegada en: https://vga-dev.es (coincide con la etiqueta).
- Stack: Angular 16, Angular Material (solo el diálogo), EmailJS, animaciones de Angular.
- Estructura: 2 componentes. `AppComponent`: plantilla de 136 líneas y CSS de 446. `PopUpComponent`: formulario de contacto.

## Capturas

Tomadas el 6 oct 2026 de la web desplegada.

| Archivo | Tamaño |
| --- | --- |
| `desktop-viewport-1440x900.png` | 1440×900 |
| `desktop-full-1440.png` | 1440×4511 |
| `mobile-viewport-390x844.png` | 390×844 |
| `mobile-full-390.png` | 390×6028 |

## Métricas (PageSpeed Insights, Lighthouse 13.5.0, 6 oct 2026, 22:59 CEST)

| | Móvil | Escritorio |
| --- | --- | --- |
| Rendimiento | 45 | 78 |
| Accesibilidad | 86 | 86 |
| Prácticas recomendadas | 96 | 100 |
| SEO | 91 | 91 |
| First Contentful Paint | 3,0 s | 0,6 s |
| Largest Contentful Paint | 11,6 s | 2,0 s |
| Total Blocking Time | 90 ms | 110 ms |
| Cumulative Layout Shift | 0,927 | 0,237 |
| Speed Index | 3,0 s | 0,6 s |

Sin datos de usuarios reales (CrUX): el sitio no tiene tráfico suficiente.

Problemas señalados por Lighthouse (escritorio): caché ineficiente (ahorro estimado 2188 KiB), 201 KiB de JS sin usar, 67 KiB de CSS sin usar, imágenes sin `width`/`height`, contraste insuficiente, enlaces sin nombre reconocible, enlaces idénticos con la misma finalidad.

Otros problemas vistos en el código: imagen de fondo `back-image.jpeg` de 1,4 MB, `alt=""` en casi todas las imágenes, `id` repetidos (`important_words_2`, `skill_container`), título `PORTFOLIO`, `description` y `keywords` vacíos, Google Fonts (Roboto, Material Icons) cargadas desde terceros, claves de EmailJS en el código cliente.

## Qué se aprovecha

- **Proyectos (como candidatos, no seleccionados):** SQUARED (Unity/C#, publicado en Google Play, `com.vgadev.squared`), GYM_RECORDS (Kotlin/SQLite, Android, en desarrollo), SM_REMASTER (Unity/C#/Blender, desktop, en desarrollo). Los textos son punto de partida y hay que reescribirlos en tono sobrio.
- **Iconos de proyecto:** `squared_icon.png`, `gymIcon.png`, `sm_icon.png`, `coasterdle_icon.png` (sin usar). Comprobar calidad antes de reutilizar.
- **Enlaces:** GitHub (`github.com/VGA-DEV`) y LinkedIn.
- **Dominio** `vga-dev.es`.
- **Logo `{VGA_DEV}`** (`portfolio_logo*.png`): decisión del usuario.
- **Foto de presentación** (`presentation.jpg`): decisión del usuario.

## Qué se descarta

- Textos de presentación ("¡Hola!, soy Víctor…", "algo más de información…"): se reescriben desde cero.
- Barras de autoevaluación 0-5 y los iconos de software (IntelliJ, Android Studio, VS Code).
- Instagram y TikTok (salvo que el usuario pida mantenerlos).
- Formulario de contacto con EmailJS, diálogo de Angular Material y las claves del código.
- Angular Material, animaciones de Angular, Google Fonts de terceros.
- `back-image.jpeg` (1,4 MB) y la maquetación por `id`.
- Las fuentes Plaza y Basis Grotesque: comprobar la licencia antes de reutilizarlas.

## Por verificar (TODO)

- SQUARED declara plataformas "IOS,ANDROID" pero solo tiene enlace de Google Play (el de App Store estaba vacío y se quitó).
- Los enlaces de GYM_RECORDS y SM_REMASTER apuntan a copias en gitfront.io. Sustituir por los repos de GitHub si existen.
- Erratas del texto original: "rectangulo", "expandiendose", "Spiderman-Man orginal", "Playsation", "sensacion".
