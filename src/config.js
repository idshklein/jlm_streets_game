export const APP_CONFIG = {
  jerusalemGis: {
    // Add one or more ArcGIS FeatureServer layer query endpoints here.
    // Example endpoint format:
    // https://<host>/arcgis/rest/services/<service>/FeatureServer/<layerId>/query
    featureLayerQueryUrls: [],

    // Candidate field names for street names in the ArcGIS layer.
    nameFields: ["STREET_NAME", "ST_NAME", "NAME_HE", "NAME", "street_name"],
  },
};
