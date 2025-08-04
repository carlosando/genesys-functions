exports.handler = async (event, context, callback) => {
  const { reference, placeName } = event;
  const apiKey = event.GOOGLE_API_KEY;

  if (!reference || !placeName) {
    return callback(new Error("Missing input: 'reference' and 'placeName' are required."));
  }

  try {
    // 1. Geocode reference
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(reference)}&key=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (geoData.status !== "OK" || !geoData.results?.length) {
      return callback(null, {
        message: `Geocoding failed: ${geoData.status}`,
        error: geoData.error_message || null
      });
    }

    const refLocation = geoData.results[0].geometry.location;
    const lat = refLocation.lat;
    const lon = refLocation.lng;

    // 2. Search places with locationBias
    const placeRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.formattedAddress,places.addressComponents,places.location"
      },
      body: JSON.stringify({
        textQuery: placeName,
        maxResultCount: 10,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: 3000
          }
        }
      })
    });

    const placeData = await placeRes.json();
    if (!placeData.places || placeData.places.length === 0) {
      return callback(null, { message: "No nearby place found matching the name." });
    }

    // 3. Ordenar por distância real
    const placesSorted = placeData.places
      .map(p => ({
        ...p,
        distance: haversine(lat, lon, p.location.latitude, p.location.longitude)
      }))
      .sort((a, b) => a.distance - b.distance);

    const place = placesSorted[0];
    const components = place.addressComponents || [];
    const street = getAddressComponent(components, 'route');
    const number = getAddressComponent(components, 'street_number');

    const composedAddress = street
      ? (number ? `${street}, ${number}` : street)
      : place.formattedAddress;

    return callback(null, { address: composedAddress });

  } catch (err) {
    console.error("## Error:", err);
    return callback(err);
  }
};

// Função para extrair endereço por tipo
function getAddressComponent(components, type) {
  const comp = components.find(c => c.types.includes(type));
  return comp?.longText || null;
}

// Fórmula de Haversine para calcular distância em metros
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Raio da Terra em metros
  const toRad = deg => deg * Math.PI / 180;

  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
