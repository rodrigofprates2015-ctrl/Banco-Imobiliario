import { type Property } from "@shared/schema";

// This function would ideally call Google Places API
// For now, we'll mock it or use a simple fetch if key exists
export async function generateCityBoard(city: string): Promise<Property[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  // Basic Monopoly Structure
  // 0: Start, 10: Jail, 20: Free Parking, 30: Go To Jail
  // We need 40 spaces total.
  
  const board: Property[] = [];
  
  // Helper to create places
  const createPlace = (i: number, type: Property['type'], name: string, price = 0, group?: string) => ({
    id: `prop_${i}`,
    name,
    address: city,
    type,
    price,
    rent: price * 0.1,
    group
  });

  const special = {
    0: { name: "INÍCIO", type: "start" },
    10: { name: "PRISÃO", type: "jail" },
    20: { name: "FERIADO", type: "parking" },
    30: { name: "VÁ PARA A PRISÃO", type: "go_to_jail" }
  };

  // Mock data for streets if API fails or not set
  const mockStreets = [
    "Main St", "First Ave", "Broadway", "Market St", "Park Ave", 
    "Oak St", "Pine St", "Maple Ave", "Cedar Ln", "Elm St",
    "Washington St", "Lakeview Dr", "Hillside Ave", "Sunset Blvd", "River Rd",
    "High St", "Church St", "School St", "Bridge St", "Mill St",
    "Garden St", "Forest Dr", "Spring St", "Valley Rd", "North St"
  ];

  // Try fetching if API key exists
  let googlePlaces: any[] = [];
  if (apiKey) {
    try {
      const query = encodeURIComponent(`commercial places in ${city}`);
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`);
      const data = await res.json();
      if (data.results) {
        googlePlaces = data.results;
      }
    } catch (e) {
      console.error("Failed to fetch Google Places:", e);
    }
  }

  // Fill board
  let streetIdx = 0;
  for (let i = 0; i < 40; i++) {
    if (special[i as keyof typeof special]) {
      const s = special[i as keyof typeof special];
      board.push(createPlace(i, s.type as any, s.name));
    } else {
      // Use Google Place if available, else mock
      let name = mockStreets[streetIdx % mockStreets.length];
      let address = city;
      let placeId = undefined;

      if (googlePlaces.length > streetIdx) {
        const p = googlePlaces[streetIdx];
        name = p.name;
        address = p.formatted_address;
        placeId = p.place_id;
      }

      // Assign colors/groups based on index (Monopoly style)
      let group = 'brown';
      let price = 60;
      if (i > 1 && i < 5) { group = 'brown'; price = 60; }
      else if (i > 5 && i < 10) { group = 'light_blue'; price = 100; }
      else if (i > 10 && i < 15) { group = 'pink'; price = 140; }
      else if (i > 15 && i < 20) { group = 'orange'; price = 180; }
      else if (i > 20 && i < 25) { group = 'red'; price = 220; }
      else if (i > 25 && i < 30) { group = 'yellow'; price = 260; }
      else if (i > 30 && i < 35) { group = 'green'; price = 300; }
      else if (i > 35) { group = 'dark_blue'; price = 350; }

      board.push({
        ...createPlace(i, 'street', name, price, group),
        address,
        placeId
      });
      streetIdx++;
    }
  }

  return board;
}
