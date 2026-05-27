from app.core.database import SessionLocal
from app.models.meeting_point import MeetingPoint


db = SessionLocal()

existing = db.query(MeetingPoint).filter(
    MeetingPoint.is_default == True
).first()

if not existing:
    meeting_point = MeetingPoint(
        name="Default Meeting Point",
        address="Replace this with real address",
        google_maps_link="https://maps.google.com",
        is_default=True,
        is_active=True
    )

    db.add(meeting_point)
    db.commit()

db.close()
