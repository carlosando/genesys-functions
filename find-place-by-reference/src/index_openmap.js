exports.handler = async (event, context, callback) => {
  const { reference, placeName } = event;

  if (!reference || !placeName) {
    return callback(new Error("Missing input: 'reference' and 'placeName' are required."));
  }

  try {
    console.log("## Event: " + JSON.stringify(event));

    // 1. Obter coordenadas do ponto de referência
    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(reference)}&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'genesys-lambda/1.0' }
    });
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
      return callback(null, { message: "Reference point not found." });
    }

    const { lat, lon } = geoData[0];

    // 2. Buscar estabelecimentos próximos
    const placeSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=10&lat=${lat}&lon=${lon}&radius=3000&addressdetails=1`;
    const placeRes = await fetch(placeSearchUrl, {
      headers: { 'User-Agent': 'genesys-lambda/1.0' }
    });
    const placeData = await placeRes.json();

    if (!Array.isArray(placeData) || placeData.length === 0) {
      return callback(null, { message: "No nearby place found matching the name." });
    }

    // 3. Ordenar por distância e pegar o mais próximo
    placeData.forEach(p => {
      p.distance = haversineDistance(
        parseFloat(lat),
        parseFloat(lon),
        parseFloat(p.lat),
        parseFloat(p.lon)
      );
    });

    placeData.sort((a, b) => a.distance - b.distance);
    const place = placeData[0];

    // 4. Construir endereço: rua + número
    const street = place.address?.road || place.address?.pedestrian || place.address?.footway || '';
    const number = place.address?.house_number || '';

    if (!street) {
      return callback(null, { message: "Street name not available in address." });
    }

    const composedAddress = number ? `${street}, ${number}` : street;

    return callback(null, { address: composedAddress });

  } catch (err) {
    console.error("## Error:", err);
    return callback(err);
  }
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371e3;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ/2)**2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2)**2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
