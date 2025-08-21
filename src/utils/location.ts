export const getFormattedLocation = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      if (!response.ok) {
        return "Location not found";
      }
      const data = await response.json();
      const address = data.address;
      
      // Nominatim provides various fields, we try to construct a sensible address
      // Format: "Barangay, Municipality, Province/State"
      const barangay = address.village || address.suburb || address.neighbourhood || '';
      const municipality = address.town || address.city || address.county || '';
      const province = address.state || address.region || '';
      
      const locationParts = [barangay, municipality, province].filter(Boolean);
      
      if (locationParts.length > 0) {
        return locationParts.join(', ');
      }
      
      return data.display_name || "Unknown location";

    } catch (error) {
      console.error("Error fetching location: ", error);
      return "Location access failed";
    }
  };
  