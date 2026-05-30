from app.models.customer_request import CustomerRequest


def log_customer_request(
    db,
    customer_id: int,
    request_type: str,
    request_text: str | None = None,
    quantity: int | None = None,
    item_name: str | None = None,
    location_label: str | None = None,
    latitude: str | None = None,
    longitude: str | None = None,
    google_maps_link: str | None = None
):
    customer_request = CustomerRequest(
        customer_id=customer_id,
        request_type=request_type,
        request_text=request_text,
        item_name=item_name,
        quantity=quantity,
        location_label=location_label,
        latitude=latitude,
        longitude=longitude,
        google_maps_link=google_maps_link,
        status="new"
    )

    db.add(customer_request)
    db.commit()

    return customer_request
