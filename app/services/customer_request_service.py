from app.models.customer_request import CustomerRequest


def log_customer_request(
    db,
    customer_id: int,
    request_type: str,
    request_text: str | None = None,
    quantity: int | None = None,
    item_name: str | None = None
):
    customer_request = CustomerRequest(
        customer_id=customer_id,
        request_type=request_type,
        request_text=request_text,
        item_name=item_name,
        quantity=quantity,
        status="new"
    )

    db.add(customer_request)
    db.commit()

    return customer_request
