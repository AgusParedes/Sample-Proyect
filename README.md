# Samples Studio — proyecto corregido

## Ejecutar localmente

1. Instalar Node.js LTS si todavía no está instalado.
2. Abrir una terminal en esta carpeta.
3. Ejecutar `npm install`.
4. Ejecutar `npm run dev`.

## Correcciones incluidas

- `App.jsx` ahora pasa una lista de productos a `WormSection`; antes se montaba sin `stops`, por lo que `stops.map(...)` no podía crear ningún pop-up.
- `WormSection.jsx` ahora importa React hooks y Three.js que utilizaba sin importar.
- Se eliminó una llamada a `mesh.dispose()` que no existe en `THREE.InstancedMesh`.
- Se agregó `src/shirtGeometry.js`, que genera una silueta 3D básica de remera.
- Se agregó `src/TShirt3D.scss`, que define el canvas de la remera.
- Se simplificó `src/index.css` para quitar estilos sobrantes de la plantilla inicial que podían afectar el layout.

Los productos de ejemplo están definidos en `src/App.jsx`. Podés cambiar sus textos, curvas y enlaces desde el arreglo `PRODUCTS`.
