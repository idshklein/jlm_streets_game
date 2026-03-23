# Jerusalem Streets Typing Game (MVP)

Client-only MVP for a Jerusalem streets game:
- Hebrew RTL interface
- No timer
- Player only types street names (auto-detect, no button click)
- Accepts official names and synonyms
- Uses a blank map background (no labels)

## Current Scope

Implemented now:
- Jerusalem dictionary loader from data.gov.il streets-with-synonyms datastore API
- Typed matching with Hebrew normalization and auto-detection on input
- Random single pick when one typed name maps to multiple streets
- Unique-score logic by official street code
- Found streets list and score counter
- Map reveal from Jerusalem GIS (ArcGIS REST query)

Not implemented yet:
- Neighborhood-restricted modes
- Strict street geometry reveal from municipal or prepared local geometry bundles
- Difficulty levels and session analytics

## Data Sources

- Synonyms dictionary: data.gov.il resource `bf185c7f-1a4e-4662-88c5-fa118a244bda`
- Street geometry reveal: Jerusalem GIS ArcGIS REST FeatureServer `query` endpoints

## Run Locally

Because this app uses ES modules, run it with a local static server (not direct file open).

Example with VS Code Live Server extension, or any static server rooted at project folder.

Then open:
- `http://localhost:<port>/`

## Project Structure

- `index.html` - app shell and UI
- `styles.css` - visual design and RTL layout
- `src/main.js` - game loop and state
- `src/dataService.js` - data.gov.il loader
- `src/matcher.js` - Hebrew normalization
- `src/mapService.js` - blank map and reveal layer
- `src/gisService.js` - Jerusalem GIS ArcGIS query integration
- `src/config.js` - ArcGIS endpoint configuration

## Jerusalem GIS Setup (Required)

Edit `src/config.js` and set at least one ArcGIS query endpoint:

```js
featureLayerQueryUrls: [
	"https://<host>/arcgis/rest/services/<service>/FeatureServer/<layerId>/query"
]
```

If your layer uses a different street-name field than the defaults, update `nameFields` in `src/config.js`.
