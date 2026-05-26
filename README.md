# Sistema-de-seguridad-Agiles

## Manual visual test (AdminWeb)

Quick checklist to verify the AdminWeb UI after changes:

- Start the backend services and the Gateway, then run the frontend dev server in `AdminWeb`:

```bash
cd AdminWeb
npm install
npm run dev
```

- Open the app and verify:
	- The map loads and shows campus polygons and markers.
	- Zoom controls (+/-) are visible on the top-right and mouse wheel / double-click zoom works.
	- Click a notification in the list - the map recenters to that incident.
	- Click the `Recentrar mapa` button to return to the campus overview.
	- In `Estadísticas` → `Tendencia horaria` hover a bar to see a tooltip (title) and confirm the average line and badge show the mean.

If anything looks broken, check browser console for errors and run `npm run build` to verify production build.
