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
from app.models.meeting_point import MeetingPoint
from app.models.message import Message
from app.services.admin_auth_service import COOKIE_NAME
from app.services.admin_auth_service import authenticate_admin
from app.services.admin_auth_service import create_admin_token
from app.services.admin_auth_service import verify_admin_token
from app.services.admin_reply_service import send_admin_reply_to_customer
from app.services.settings_service import get_setting
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

    return templates.TemplateResponse(
        request=request,
        name="admin_dashboard.html",
        context={
            "meeting_points": meeting_points,
            "customers": customers,
            "products": products,
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
            ) or ""
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
        Message.created_at.asc()
    ).all()

    return templates.TemplateResponse(
        request=request,
        name="customer_detail.html",
        context={
            "customer": customer,
            "messages": messages
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

    meeting_point.name = name
    meeting_point.address = address
    meeting_point.google_maps_link = google_maps_link
    meeting_point.is_active = is_active

    db.commit()

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
