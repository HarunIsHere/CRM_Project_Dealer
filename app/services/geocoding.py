import requests


def search_locations(query: str):
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": query,
            "format": "jsonv2",
            "limit": 10,
            "addressdetails": 1
        },
        headers={
            "User-Agent": "CRMProjectDealer/1.0"
        },
        timeout=10
    )

    response.raise_for_status()

    results = []

    for item in response.json():
        latitude = item.get("lat")
        longitude = item.get("lon")
        display_name = item.get("display_name")

        results.append(
            {
                "name": item.get("name") or display_name,
                "address": display_name,
                "latitude": latitude,
                "longitude": longitude,
                "google_maps_link": (
                    f"https://www.google.com/maps?q={latitude},{longitude}"
                )
            }
        )

    return results
