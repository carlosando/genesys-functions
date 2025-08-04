exports.handler = async (event, context, callback) => {
  const { reference, placeName } = event;
  const apiKey = event.GOOGLE_API_KEY;;

  if (!reference || !placeName) {
    return callback(new Error("Missing input: 'reference' and 'placeName' are required."));
  }

  try {
    const query = `${placeName} perto de ${reference}`;
    console.log("## Query: " + query);

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress,places.addressComponents',
        'rankPreference': 'DISTANCE'
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1
      })
    });

    const data = await response.json();
    console.log("## Places API (new) response: " + JSON.stringify(data));

    if (!data.places || data.places.length === 0) {
      return callback(null, { message: "No nearby place found matching the name." });
    }

    const place = data.places[0];
    const components = place.addressComponents || [];

    const street = getAddressComponent(components, 'route');
    const number = getAddressComponent(components, 'street_number');

    const composedAddress = street ? (number ? `${street}, ${number}` : street) : place.formattedAddress;

    return callback(null, { address: composedAddress });

  } catch (err) {
    console.error("## Error:", err);
    return callback(err);
  }
};

function getAddressComponent(components, type) {
  const comp = components.find(c => c.types.includes(type));
  return comp?.longText || null;
}