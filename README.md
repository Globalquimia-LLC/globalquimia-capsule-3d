# Globalquimia — Cápsula 3D

Modelo 3D procedural de una cápsula farmacéutica de dos piezas (talla "00"), con pared hueca real y demo interactiva de scroll con diseñador de color.

👉 **[Ver la demo interactiva](scroll_full.html)** — desplázate con el mouse/dedo: la cápsula gira, hace zoom, la tapa se separa revelando el interior hueco, aparece texto real de [globalquimia.com.co](https://www.globalquimia.com.co), la cápsula se vuelve a cerrar y aparece un diseñador de color con selector de espectro completo (HEX/RGB).

## Archivos

| Archivo | Descripción |
|---|---|
| `capsule.glb` | Modelo principal: cuerpo + tapa como nodos separados (`capsule_body`, `capsule_cap`), en posición cerrada. Listo para animar la tapa por separado. |
| `capsule_body.glb` / `capsule_cap.glb` | Piezas sueltas. |
| `capsule_open.glb` | Pose de referencia con la tapa separada. |
| `scroll_full.html` | Demo interactiva (Three.js + GSAP ScrollTrigger): animación de scroll con apertura real de la tapa y diseñador de color en vivo. |
| `visor.html` | Visor simple (`<model-viewer>`) para inspeccionar el modelo con rotación automática. |
| `capsule_hero_2048.png` / `capsule_open_render.png` | Renders estáticos de alta calidad, fondo `#FDFAF5`. |
| `assets/` | Logos de marca usados en la demo. |

## Especificaciones del modelo

- **Dimensiones reales**, talla "00": tapa 11.8mm, cuerpo 20.2mm, longitud cerrada 23.5mm (fuente: tablas técnicas de Torpac Inc. y ACG Associated Capsule — coinciden).
- **Pared hueca**, ~0.09mm de espesor (grosor real aproximado de gelatina/HPMC), mediante resta booleana real (no un efecto visual).
- **Mecanismo de cierre**: ranura cóncava de sellado, posicionada según la patente US 3,508,678 "Locking Capsule" (Parke, Davis & Co., 1970).
- Escala del archivo: 1 unidad = 1 metro (convención glTF/GLB), es decir, la cápsula real mide ~0.0235 unidades de largo.
- Nodos con transform identidad — el nodo `capsule_cap` puede desplazarse a lo largo de su eje Z local (`+0.01672` = pose completamente abierta) para animar la apertura.

## Cómo correr la demo localmente

Abrir `scroll_full.html` directo desde el disco **no funciona** — los navegadores bloquean la carga del `.glb` bajo `file://`. Hay que servirlo:

```bash
python -m http.server 8000
```

y abrir `http://localhost:8000/scroll_full.html`.

## Generado con

Geometría construida con [trimesh](https://trimesh.org/) + [manifold3d](https://github.com/elalish/manifold) (operaciones booleanas), renders con [pyrender](https://pyrender.readthedocs.io/), demo con [Three.js](https://threejs.org/) + [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/).
