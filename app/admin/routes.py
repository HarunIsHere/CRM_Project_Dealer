from fastapi import APIRouter
from fastapi import Depends
from fastapi import Form
from fastapi import Request
from fastapi import Response
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.customer import Customer
from app.models.customer_request import CustomerRequest
from app.models.meeting_point import MeetingPoint
from app.models.message import Message
from app.services.admin_auth_service import COOKIE_NAME
from app.services.admin_auth_service import authenticate_admin
from app.services.admin_auth_service import create_admin_token
from app.services.admin_auth_service import verify_admin_token
from app.services.admin_reply_service import send_admin_reply_to_customer
from app.services.admin_reply_service import send_location_changed_to_customer
from app.services.settings_service import get_setting
from app.services.product_alias_service import get_alias_text_for_product
from app.services.product_alias_service import replace_manual_aliases
from app.services.product_alias_service import sync_auto_aliases
from app.services.settings_service import set_setting

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

templates = Jinja2Templates(directory="app/templates")


def require_admin(request: Request):
    token = request.cookies.get(COOKIE_NAME)

    if verify_admin_token(token):
        return None

    return RedirectResponse(
        url="/admin/login",
        status_code=303
    )


def format_location_changed_message(meeting_point: MeetingPoint) -> str:
    return (
        "Location changed (became available), please come to the new location:\n\n"
        f"{meeting_point.name}\n"
        f"{meeting_point.address}\n"
        f"{meeting_point.google_maps_link}"
    )


def notify_customers_about_location_change(
    db: Session,
    meeting_point: MeetingPoint
):
    location_requests = db.query(CustomerRequest).filter(
        CustomerRequest.request_type == "location",
        CustomerRequest.status != "done"
    ).all()

    notified_customer_ids = set()

    for location_request in location_requests:
        if location_request.customer_id in notified_customer_ids:
            continue

        customer = db.query(Customer).filter(
            Customer.id == location_request.customer_id
        ).first()

        if not customer:
            continue

        send_location_changed_to_customer(
            customer.telegram_user_id,
            format_location_changed_message(meeting_point)
        )

        notified_customer_ids.add(customer.id)


@router.get("/login")
def admin_login_page(request: Request):
    if verify_admin_token(request.cookies.get(COOKIE_NAME)):
        return RedirectResponse(
            url="/admin",
            status_code=303
        )

    return templates.TemplateResponse(
        request=request,
        name="admin_login.html",
        context={
            "error": None
        }
    )


@router.post("/login")
def admin_login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...)
):
    if not authenticate_admin(username, password):
        return templates.TemplateResponse(
            request=request,
            name="admin_login.html",
            context={
                "error": "Invalid username or password."
            },
            status_code=401
        )

    token = create_admin_token()

    response = RedirectResponse(
        url="/admin",
        status_code=303
    )
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=43200
    )

    return response


@router.post("/logout")
def admin_logout():
    response = RedirectResponse(
        url="/admin/login",
        status_code=303
    )
    response.delete_cookie(COOKIE_NAME)

    return response


@router.get("/")
def admin_dashboard(
    request: Request,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    meeting_points = db.query(MeetingPoint).all()

    customers = db.query(Customer).order_by(
        Customer.last_seen_at.desc()
    ).all()

    products = db.query(Product).all()

    product_alias_map = {
        product.id: get_alias_text_for_product(
            db,
            product.id
        )
        for product in products
    }

    open_request_rows = db.query(CustomerRequest).filter(
        CustomerRequest.status != "done",
        CustomerRequest.request_type != "product_list"
    ).order_by(
        CustomerRequest.created_at.desc()
    ).all()

    customer_map = {
        customer.id: customer
        for customer in customers
    }

    open_request_groups = {}

    for request_row in open_request_rows:
        group_key = (
            request_row.customer_id,
            request_row.request_type,
            request_row.item_name or ""
        )

        if group_key not in open_request_groups:
            open_request_groups[group_key] = {
                "customer_id": request_row.customer_id,
                "request_type": request_row.request_type,
                "item_name": request_row.item_name,
                "quantity": 0,
                "request_count": 0,
                "status": request_row.status,
                "latest_text": request_row.request_text,
                "latest_created_at": request_row.created_at,
            }

        group = open_request_groups[group_key]
        group["request_count"] += 1

        if request_row.quantity:
            group["quantity"] += request_row.quantity

    open_requests = list(open_request_groups.values())

    return templates.TemplateResponse(
        request=request,
        name="admin_dashboard.html",
        context={
            "meeting_points": meeting_points,
            "customers": customers,
            "products": products,
            "product_alias_map": product_alias_map,
            "open_requests": open_requests,
            "customer_map": customer_map,
            "admin_telegram_chat_id": get_setting(
                db,
                "admin_telegram_chat_id"
            ),
            "working_hours_enabled": get_setting(
                db,
                "working_hours_enabled"
            ),
            "working_hours_timezone": get_setting(
                db,
                "working_hours_timezone"
            ) or "Europe/Berlin",
            "working_hours_start": get_setting(
                db,
                "working_hours_start"
            ) or "10:00",
            "working_hours_end": get_setting(
                db,
                "working_hours_end"
            ) or "22:00",
            "working_hours_closed_message": get_setting(
                db,
                "working_hours_closed_message"
            ) or "",
            "admin_view_language": get_setting(
                db,
                "admin_view_language"
            ) or "en"
        }
    )


@router.get("/customers/{customer_id}")
def customer_detail(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    customer = db.query(Customer).filter(
        Customer.id == customer_id
    ).first()

    messages = db.query(Message).filter(
        Message.customer_id == customer_id
    ).order_by(
        Message.created_at.desc()
    ).all()

    customer_requests = db.query(CustomerRequest).filter(
        CustomerRequest.customer_id == customer_id
    ).order_by(
        CustomerRequest.created_at.desc()
    ).all()

    return templates.TemplateResponse(
        request=request,
        name="customer_detail.html",
        context={
            "customer": customer,
            "messages": messages,
            "customer_requests": customer_requests
        }
    )


@router.post("/meeting-points")
def create_meeting_point(
    request: Request,
    name: str = Form(...),
    address: str = Form(...),
    google_maps_link: str = Form(...),
    is_default: bool = Form(False),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    if is_default:
        db.query(MeetingPoint).update(
            {"is_default": False}
        )

    meeting_point = MeetingPoint(
        name=name,
        address=address,
        google_maps_link=google_maps_link,
        is_default=is_default,
        is_active=True
    )

    db.add(meeting_point)
    db.commit()

    if is_default:
        notify_customers_about_location_change(
            db,
            meeting_point
        )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/meeting-points/{meeting_point_id}/default")
def set_default_meeting_point(
    request: Request,
    meeting_point_id: int,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    db.query(MeetingPoint).update(
        {"is_default": False}
    )

    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    meeting_point.is_default = True
    meeting_point.is_active = True

    db.commit()

    notify_customers_about_location_change(
        db,
        meeting_point
    )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/meeting-points/{meeting_point_id}/update")
def update_meeting_point(
    request: Request,
    meeting_point_id: int,
    name: str = Form(...),
    address: str = Form(...),
    google_maps_link: str = Form(...),
    is_active: bool = Form(False),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    was_default = meeting_point.is_default
    was_active = meeting_point.is_active

    meeting_point.name = name
    meeting_point.address = address
    meeting_point.google_maps_link = google_maps_link
    meeting_point.is_active = is_active

    if was_default and was_active and not is_active:
        meeting_point.is_default = False

    db.commit()

    if was_default and was_active and not is_active:
        notify_customers_location_unavailable(db)

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


from fastapi.responses import JSONResponse

from app.services.geocoding import search_locations


@router.get("/search-location")
def search_location(
    request: Request,
    query: str
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    results = search_locations(query)

    return JSONResponse(results)


@router.post("/meeting-points/{meeting_point_id}/delete")
def delete_meeting_point(
    request: Request,
    meeting_point_id: int,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    if meeting_point:
        db.delete(meeting_point)
        db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/settings/admin-telegram")
def update_admin_telegram(
    request: Request,
    admin_telegram_chat_id: str = Form(...),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    set_setting(
        db,
        "admin_telegram_chat_id",
        admin_telegram_chat_id
    )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


from app.models.product import Product
from app.models.product_alias import ProductAlias


@router.post("/products")
def create_product(
    request: Request,
    name: str = Form(...),
    price: float = Form(...),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    product = Product(
        name=name,
        price=price,
        is_active=True
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    sync_auto_aliases(
        db,
        product
    )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/products/{product_id}/update")
def update_product(
    request: Request,
    product_id: int,
    name: str = Form(...),
    price: float = Form(...),
    aliases: str = Form(""),
    is_active: bool = Form(False),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    product.name = name
    product.price = price
    product.is_active = is_active

    db.commit()

    if aliases.strip():
        replace_manual_aliases(
            db,
            product.id,
            aliases
        )
    else:
        sync_auto_aliases(
            db,
            product
        )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/products/{product_id}/delete")
def delete_product(
    request: Request,
    product_id: int,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product:
        db.delete(product)
        db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/settings/working-hours")
def update_working_hours(
    request: Request,
    working_hours_enabled: str = Form("off"),
    working_hours_timezone: str = Form(...),
    working_hours_start: str = Form(...),
    working_hours_end: str = Form(...),
    working_hours_closed_message: str = Form(""),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    set_setting(
        db,
        "working_hours_enabled",
        working_hours_enabled
    )
    set_setting(
        db,
        "working_hours_timezone",
        working_hours_timezone
    )
    set_setting(
        db,
        "working_hours_start",
        working_hours_start
    )
    set_setting(
        db,
        "working_hours_end",
        working_hours_end
    )
    set_setting(
        db,
        "working_hours_closed_message",
        working_hours_closed_message
    )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/customers/{customer_id}/reply")
def send_customer_reply(
    request: Request,
    customer_id: int,
    reply_text: str = Form(...),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    customer = db.query(Customer).filter(
        Customer.id == customer_id
    ).first()

    if not customer:
        return RedirectResponse(
            url="/admin",
            status_code=303
        )

    send_admin_reply_to_customer(
        customer.telegram_user_id,
        reply_text
    )

    save_reply = Message(
        customer_id=customer.id,
        direction="outgoing",
        platform="telegram",
        content=reply_text,
        language=customer.preferred_language,
        message_type="admin_reply"
    )

    db.add(save_reply)
    db.commit()

    return RedirectResponse(
        url=f"/admin/customers/{customer_id}",
        status_code=303
    )


@router.post("/customer-requests/{request_id}/status")
def update_customer_request_status(
    request: Request,
    request_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    customer_request = db.query(CustomerRequest).filter(
        CustomerRequest.id == request_id
    ).first()

    if not customer_request:
        return RedirectResponse(
            url="/admin",
            status_code=303
        )

    allowed_statuses = [
        "new",
        "in_progress",
        "done"
    ]

    if status in allowed_statuses:
        customer_request.status = status
        db.commit()

    return RedirectResponse(
        url=f"/admin/customers/{customer_request.customer_id}",
        status_code=303
    )


@router.post("/customer-requests/group/done")
def mark_customer_request_group_done(
    request: Request,
    customer_id: int = Form(...),
    request_type: str = Form(...),
    item_name: str = Form(""),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    query = db.query(CustomerRequest).filter(
        CustomerRequest.customer_id == customer_id,
        CustomerRequest.request_type == request_type,
        CustomerRequest.status != "done"
    )

    if item_name:
        query = query.filter(
            CustomerRequest.item_name == item_name
        )
    else:
        query = query.filter(
            CustomerRequest.item_name.is_(None)
        )

    query.update(
        {"status": "done"},
        synchronize_session=False
    )

    db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


def format_location_unavailable_message() -> str:
    return (
        "Sorry, dealer is not at the location anymore. "
        "We will inform you shortly when a new location is available."
    )


def notify_customers_location_unavailable(db: Session):
    location_requests = db.query(CustomerRequest).filter(
        CustomerRequest.request_type == "location",
        CustomerRequest.status != "done"
    ).all()

    notified_customer_ids = set()

    for location_request in location_requests:
        if location_request.customer_id in notified_customer_ids:
            continue

        customer = db.query(Customer).filter(
            Customer.id == location_request.customer_id
        ).first()

        if not customer:
            continue

        send_location_changed_to_customer(
            customer.telegram_user_id,
            format_location_unavailable_message()
        )

        notified_customer_ids.add(customer.id)


@router.post("/customer-requests/all/done")
def mark_all_customer_requests_done(
    request: Request,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    db.query(CustomerRequest).filter(
        CustomerRequest.status != "done"
    ).update(
        {"status": "done"},
        synchronize_session=False
    )

    db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/settings/admin-language")
def update_admin_language(
    request: Request,
    admin_view_language: str = Form(...),
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    if admin_view_language not in ["en", "de", "tr", "ar", "ru"]:
        admin_view_language = "en"

    set_setting(
        db,
        "admin_view_language",
        admin_view_language
    )

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


def get_open_request_context(db: Session):
    customers = db.query(Customer).order_by(
        Customer.last_seen_at.desc()
    ).all()

    open_request_rows = db.query(CustomerRequest).filter(
        CustomerRequest.status != "done",
        CustomerRequest.request_type != "product_list"
    ).order_by(
        CustomerRequest.created_at.desc()
    ).all()

    customer_map = {
        customer.id: customer
        for customer in customers
    }

    open_request_groups = {}

    for request_row in open_request_rows:
        group_key = (
            request_row.customer_id,
            request_row.request_type,
            request_row.item_name or ""
        )

        if group_key not in open_request_groups:
            open_request_groups[group_key] = {
                "customer_id": request_row.customer_id,
                "request_type": request_row.request_type,
                "item_name": request_row.item_name,
                "quantity": 0,
                "request_count": 0,
                "status": request_row.status,
                "latest_text": request_row.request_text,
                "latest_created_at": request_row.created_at,
            }

        group = open_request_groups[group_key]
        group["request_count"] += 1

        if request_row.quantity:
            group["quantity"] += request_row.quantity

    return {
        "open_requests": list(open_request_groups.values()),
        "customer_map": customer_map,
    }


@router.get("/open-requests")
def open_requests_partial(
    request: Request,
    db: Session = Depends(get_db)
):
    auth_redirect = require_admin(request)
    if auth_redirect:
        return auth_redirect

    return templates.TemplateResponse(
        request=request,
        name="open_requests_table.html",
        context=get_open_request_context(db)
    )
