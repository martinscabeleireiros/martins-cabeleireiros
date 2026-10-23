import os
import re
import logging
from datetime import datetime, timedelta, timezone, date as date_cls
from pathlib import Path
from typing import Annotated, Optional, List
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import AliasChoices, BaseModel, Field, BeforeValidator, ConfigDict
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
TZ = ZoneInfo("America/Porto_Velho")
OPEN_MIN = 8 * 60
CLOSE_MIN = 20 * 60
SLOT_STEP = 15

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

SERVICES = [
    {"id": "corte-masculino", "name": "Corte Masculino", "price": 25.0, "duration": 30, "category": "Cortes"},
    {"id": "corte-feminino", "name": "Corte Feminino", "price": 30.0, "duration": 45, "category": "Cortes"},
    {"id": "barba", "name": "Barba", "price": 20.0, "duration": 30, "category": "Barba"},
    {"id": "sobrancelha", "name": "Designer de Sobrancelha", "price": 20.0, "duration": 20, "category": "Estética"},
    {"id": "selagem-masculino", "name": "Selagem Masculino", "price": 100.0, "duration": 120, "category": "Tratamentos"},
    {"id": "selagem-tradicional", "name": "Selagem Tradicional", "price": 150.0, "duration": 240, "category": "Tratamentos"},
    {"id": "selagem-organica", "name": "Selagem Orgânica", "price": 180.0, "duration": 300, "category": "Tratamentos"},
    {"id": "botox-tradicional", "name": "Botox Tradicional", "price": 150.0, "duration": 240, "category": "Tratamentos"},
    {"id": "botox-organico", "name": "Botox Orgânico", "price": 150.0, "duration": 240, "category": "Tratamentos"},
    {"id": "luzes-masculina", "name": "Luzes Masculina", "price": 80.0, "duration": 120, "category": "Coloração"},
    {"id": "luzes", "name": "Luzes", "price": 250.0, "duration": 240, "category": "Coloração"},
    {"id": "coloracao", "name": "Coloração", "price": 80.0, "duration": 90, "category": "Coloração"},
    {"id": "escova", "name": "Escova", "price": 60.0, "duration": 40, "category": "Finalização"},
    {"id": "hidratacao", "name": "Hidratação", "price": 60.0, "duration": 60, "category": "Tratamentos"},
]
SERVICE_MAP = {s["id"]: s for s in SERVICES}


# ---------- Mongo models ----------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, validation_alias=AliasChoices("_id", "id"))

    @classmethod
    def from_mongo(cls, doc):
        return cls.model_validate(doc) if doc else None

    def to_mongo(self):
        d = self.model_dump(by_alias=True, exclude={"id"})
        return d


class Client(BaseDocument):
    name: str
    phone: str
    source: str = "manual"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Appointment(BaseDocument):
    service_id: str
    service_name: str
    price: float
    duration: int
    date: str
    time: str
    start_min: int
    end_min: int
    end_time: str
    client_name: str
    client_phone: str
    notes: str = ""
    status: str = "agendado"  # agendado | concluido | cancelado
    reminded: bool = False
    confirmed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BlockedDay(BaseDocument):
    date: str
    reason: str = ""


# ---------- helpers ----------
def normalize_phone(raw: str) -> Optional[str]:
    d = re.sub(r"\D", "", raw or "")
    if d.startswith("55") and len(d) in (12, 13):
        d = d[2:]
    if d.startswith("0") and len(d) in (11, 12):
        d = d[1:]
    if len(d) in (8, 9):
        d = "69" + d
    if len(d) == 10 and d[2] in "6789":
        d = d[:2] + "9" + d[2:]
    return d if len(d) in (10, 11) else None


def to_min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def fmt_min(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def parse_date(s: str) -> date_cls:
    try:
        return date_cls.fromisoformat(s)
    except ValueError:
        raise HTTPException(400, "Data inválida")


async def day_status(d: str):
    dt = parse_date(d)
    if dt.weekday() == 6:
        return False, "Fechado aos domingos"
    blk = await db.blocked_days.find_one({"date": d})
    if blk:
        return False, blk.get("reason") or "Dia bloqueado"
    return True, ""


async def compute_slots(d: str, duration: int, exclude_id: Optional[str] = None) -> List[str]:
    open_, _ = await day_status(d)
    if not open_:
        return []
    busy = []
    async for a in db.appointments.find({"date": d, "status": {"$ne": "cancelado"}}):
        if exclude_id and str(a["_id"]) == exclude_id:
            continue
        busy.append((a["start_min"], a["end_min"]))
    now = datetime.now(TZ)
    min_start = OPEN_MIN
    if d == now.date().isoformat():
        min_start = max(OPEN_MIN, now.hour * 60 + now.minute + 1)
    elif parse_date(d) < now.date():
        return []
    slots = []
    m = OPEN_MIN
    while m + duration <= CLOSE_MIN:
        if m >= min_start and all(m + duration <= s or m >= e for s, e in busy):
            slots.append(fmt_min(m))
        m += SLOT_STEP
    return slots


async def upsert_client(name: str, phone: str, source: str) -> bool:
    res = await db.clients.update_one(
        {"phone": phone},
        {"$setOnInsert": Client(name=name.strip() or phone, phone=phone, source=source).to_mongo()},
        upsert=True,
    )
    return res.upserted_id is not None


def parse_vcf(text: str):
    out = []
    for card in re.split(r"BEGIN:VCARD", text, flags=re.I)[1:]:
        name, phones = "", []
        lines = card.replace("=\r\n", "").replace("=\n", "").splitlines()
        for line in lines:
            key, _, val = line.partition(":")
            k = key.upper()
            if k.startswith("FN"):
                if "QUOTED-PRINTABLE" in k:
                    try:
                        import quopri
                        val = quopri.decodestring(val).decode("utf-8", "ignore")
                    except Exception:
                        pass
                name = val.strip()
            elif k.startswith("TEL"):
                phones.append(val)
        for p in phones:
            n = normalize_phone(p)
            if n:
                out.append((name, n))
                break
    return out


# ---------- auth ----------
def create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode({"sub": username, "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)


async def current_admin(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "Não autenticado")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sessão inválida")
    user = await db.admins.find_one({"username": payload.get("sub")}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Sessão inválida")
    return user


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.admins.find_one({"username": body.username.strip().lower()})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "Usuário ou senha incorretos")
    return {"access_token": create_token(user["username"]), "token_type": "bearer",
            "user": {"username": user["username"], "display_name": user["display_name"]}}


@api.get("/auth/me")
async def me(admin=Depends(current_admin)):
    return admin


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, admin=Depends(current_admin)):
    user = await db.admins.find_one({"username": admin["username"]})
    if not bcrypt.checkpw(body.current_password.encode(), user["password_hash"].encode()):
        raise HTTPException(400, "Senha atual incorreta")
    if len(body.new_password) < 6:
        raise HTTPException(400, "A nova senha deve ter ao menos 6 caracteres")
    h = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.admins.update_one({"username": admin["username"]}, {"$set": {"password_hash": h}})
    return {"ok": True}


# ---------- public ----------
@api.get("/")
async def root():
    return {"message": "Martins Cabeleireiro API"}


@api.get("/services")
async def services():
    return SERVICES


@api.get("/slots")
async def slots(date: str, service_id: str, exclude_id: Optional[str] = None):
    svc = SERVICE_MAP.get(service_id)
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    open_, reason = await day_status(date)
    return {"date": date, "open": open_, "reason": reason, "slots": await compute_slots(date, svc["duration"], exclude_id)}


class AppointmentIn(BaseModel):
    service_id: str
    date: str
    time: str
    client_name: str
    client_phone: str
    notes: str = ""


async def create_appointment_core(body: AppointmentIn) -> Appointment:
    svc = SERVICE_MAP.get(body.service_id)
    if not svc:
        raise HTTPException(404, "Serviço não encontrado")
    if not body.client_name.strip():
        raise HTTPException(400, "Informe seu nome")
    phone = normalize_phone(body.client_phone)
    if not phone:
        raise HTTPException(400, "WhatsApp inválido. Use DDD + número")
    if body.time not in await compute_slots(body.date, svc["duration"]):
        raise HTTPException(409, "Horário indisponível. Escolha outro horário")
    start = to_min(body.time)
    appt = Appointment(
        service_id=svc["id"], service_name=svc["name"], price=svc["price"], duration=svc["duration"],
        date=body.date, time=body.time, start_min=start, end_min=start + svc["duration"],
        end_time=fmt_min(start + svc["duration"]), client_name=body.client_name.strip(),
        client_phone=phone, notes=body.notes.strip(),
    )
    res = await db.appointments.insert_one(appt.to_mongo())
    appt.id = str(res.inserted_id)
    await upsert_client(appt.client_name, phone, "agendamento")
    return appt


@api.post("/appointments")
async def create_appointment(body: AppointmentIn):
    return await create_appointment_core(body)


# ---------- admin ----------
@api.post("/admin/appointments")
async def admin_create_appointment(body: AppointmentIn, admin=Depends(current_admin)):
    return await create_appointment_core(body)


@api.get("/admin/appointments")
async def list_appointments(date: str, admin=Depends(current_admin)):
    docs = await db.appointments.find({"date": date}).sort("start_min", 1).to_list(500)
    return [Appointment.from_mongo(d) for d in docs]


class StatusIn(BaseModel):
    status: Optional[str] = None
    reminded: Optional[bool] = None
    confirmed: Optional[bool] = None


@api.patch("/admin/appointments/{appt_id}")
async def update_appointment(appt_id: str, body: StatusIn, admin=Depends(current_admin)):
    upd = {}
    if body.status is not None:
        if body.status not in ("agendado", "concluido", "cancelado"):
            raise HTTPException(400, "Status inválido")
        upd["status"] = body.status
    if body.confirmed is not None:
        upd["confirmed"] = body.confirmed
    if body.reminded is not None:
        upd["reminded"] = body.reminded
    if not ObjectId.is_valid(appt_id):
        raise HTTPException(404, "Agendamento não encontrado")
    doc = await db.appointments.find_one_and_update({"_id": ObjectId(appt_id)}, {"$set": upd}, return_document=True)
    if not doc:
        raise HTTPException(404, "Agendamento não encontrado")
    return Appointment.from_mongo(doc)


@api.delete("/admin/appointments/{appt_id}")
async def delete_appointment(appt_id: str, admin=Depends(current_admin)):
    if not ObjectId.is_valid(appt_id):
        raise HTTPException(404, "Agendamento não encontrado")
    doc = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    if not doc:
        raise HTTPException(404, "Agendamento não encontrado")
    if doc["status"] != "cancelado":
        raise HTTPException(400, "Só é possível excluir agendamentos cancelados")
    await db.appointments.delete_one({"_id": ObjectId(appt_id)})
    return {"ok": True}


class RescheduleIn(BaseModel):
    date: str
    time: str


@api.post("/admin/appointments/{appt_id}/reschedule")
async def reschedule(appt_id: str, body: RescheduleIn, admin=Depends(current_admin)):
    if not ObjectId.is_valid(appt_id):
        raise HTTPException(404, "Agendamento não encontrado")
    doc = await db.appointments.find_one({"_id": ObjectId(appt_id)})
    if not doc:
        raise HTTPException(404, "Agendamento não encontrado")
    if body.time not in await compute_slots(body.date, doc["duration"], appt_id):
        raise HTTPException(409, "Horário indisponível. Escolha outro horário")
    start = to_min(body.time)
    upd = {"date": body.date, "time": body.time, "start_min": start, "end_min": start + doc["duration"],
           "end_time": fmt_min(start + doc["duration"]), "status": "agendado", "reminded": False, "confirmed": False}
    doc = await db.appointments.find_one_and_update({"_id": ObjectId(appt_id)}, {"$set": upd}, return_document=True)
    return Appointment.from_mongo(doc)


@api.get("/admin/report")
async def report(month: str, admin=Depends(current_admin)):
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        raise HTTPException(400, "Mês inválido")
    docs = await db.appointments.find({"date": {"$regex": f"^{month}-"}}).to_list(5000)
    done = [d for d in docs if d["status"] == "concluido"]
    pending = [d for d in docs if d["status"] == "agendado"]
    by_svc = {}
    for d in docs:
        if d["status"] == "cancelado":
            continue
        e = by_svc.setdefault(d["service_id"], {"service_id": d["service_id"], "name": d["service_name"], "count": 0, "revenue": 0.0})
        e["count"] += 1
        e["revenue"] += d["price"] if d["status"] == "concluido" else 0
    top = sorted(by_svc.values(), key=lambda x: (-x["count"], -x["revenue"]))
    return {
        "month": month,
        "revenue": sum(d["price"] for d in done),
        "expected": sum(d["price"] for d in pending),
        "total": len(done) + len(pending),
        "completed": len(done),
        "scheduled": len(pending),
        "cancelled": len(docs) - len(done) - len(pending),
        "confirmed": sum(1 for d in docs if d.get("confirmed") and d["status"] != "cancelado"),
        "unique_clients": len({d["client_phone"] for d in docs if d["status"] != "cancelado"}),
        "avg_ticket": (sum(d["price"] for d in done) / len(done)) if done else 0,
        "top_services": top,
    }


@api.get("/qr")
async def qr(data: str = Query(..., max_length=500)):
    import io
    import qrcode
    from fastapi.responses import Response
    img = qrcode.make(data, box_size=12, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(buf.getvalue(), media_type="image/png")


@api.get("/admin/reminders")
async def reminders(admin=Depends(current_admin)):
    tomorrow = (datetime.now(TZ).date() + timedelta(days=1)).isoformat()
    docs = await db.appointments.find({"date": tomorrow, "status": "agendado"}).sort("start_min", 1).to_list(500)
    return {"date": tomorrow, "items": [Appointment.from_mongo(d) for d in docs]}


@api.get("/admin/clients")
async def list_clients(q: str = "", skip: int = 0, limit: int = Query(50, le=200), admin=Depends(current_admin)):
    flt = {}
    if q.strip():
        rx = re.escape(q.strip())
        digits = re.sub(r"\D", "", q)
        ors = [{"name": {"$regex": rx, "$options": "i"}}]
        if digits:
            ors.append({"phone": {"$regex": digits}})
        flt = {"$or": ors}
    total = await db.clients.count_documents(flt)
    docs = await db.clients.find(flt).sort("name", 1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "items": [Client.from_mongo(d) for d in docs]}


class ClientIn(BaseModel):
    name: str
    phone: str


@api.post("/admin/clients")
async def add_client(body: ClientIn, admin=Depends(current_admin)):
    phone = normalize_phone(body.phone)
    if not phone or not body.name.strip():
        raise HTTPException(400, "Nome ou telefone inválido")
    if not await upsert_client(body.name, phone, "manual"):
        raise HTTPException(409, "Cliente já cadastrado")
    return Client.from_mongo(await db.clients.find_one({"phone": phone}))


@api.get("/admin/clients/{client_id}")
async def client_detail(client_id: str, admin=Depends(current_admin)):
    if not ObjectId.is_valid(client_id):
        raise HTTPException(404, "Cliente não encontrado")
    doc = await db.clients.find_one({"_id": ObjectId(client_id)})
    if not doc:
        raise HTTPException(404, "Cliente não encontrado")
    hist = await db.appointments.find({"client_phone": doc["phone"]}).sort([("date", -1), ("start_min", -1)]).to_list(500)
    items = [Appointment.from_mongo(h) for h in hist]
    done = [a for a in items if a.status == "concluido"]
    return {"client": Client.from_mongo(doc), "history": items,
            "visits": len(done), "total_spent": sum(a.price for a in done)}


@api.delete("/admin/clients/{client_id}")
async def delete_client(client_id: str, admin=Depends(current_admin)):
    if not ObjectId.is_valid(client_id):
        raise HTTPException(404, "Cliente não encontrado")
    await db.clients.delete_one({"_id": ObjectId(client_id)})
    return {"ok": True}


async def import_pairs(pairs, source):
    added = 0
    for name, phone in pairs:
        if await upsert_client(name, phone, source):
            added += 1
    return {"read": len(pairs), "added": added, "skipped": len(pairs) - added}


@api.post("/admin/clients/import-vcf")
async def import_vcf(file: UploadFile = File(...), admin=Depends(current_admin)):
    raw = await file.read()
    text = raw.decode("utf-8", "ignore")
    if "BEGIN:VCARD" not in text.upper():
        raise HTTPException(400, "Arquivo .vcf inválido")
    return await import_pairs(parse_vcf(text), "vcf")


class ContactsIn(BaseModel):
    contacts: List[ClientIn]


@api.post("/admin/clients/import-list")
async def import_list(body: ContactsIn, admin=Depends(current_admin)):
    pairs = []
    for c in body.contacts:
        p = normalize_phone(c.phone)
        if p:
            pairs.append((c.name, p))
    return await import_pairs(pairs, "celular")


@api.get("/admin/blocked-days")
async def list_blocked(admin=Depends(current_admin)):
    docs = await db.blocked_days.find({}).sort("date", 1).to_list(500)
    return [BlockedDay.from_mongo(d) for d in docs]


class BlockIn(BaseModel):
    date: str
    reason: str = ""


@api.post("/admin/blocked-days")
async def add_blocked(body: BlockIn, admin=Depends(current_admin)):
    parse_date(body.date)
    if await db.blocked_days.find_one({"date": body.date}):
        raise HTTPException(409, "Este dia já está bloqueado")
    b = BlockedDay(date=body.date, reason=body.reason.strip())
    res = await db.blocked_days.insert_one(b.to_mongo())
    b.id = str(res.inserted_id)
    return b


@api.delete("/admin/blocked-days/{block_id}")
async def delete_blocked(block_id: str, admin=Depends(current_admin)):
    if not ObjectId.is_valid(block_id):
        raise HTTPException(404, "Não encontrado")
    await db.blocked_days.delete_one({"_id": ObjectId(block_id)})
    return {"ok": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.admins.create_index("username", unique=True)
    await db.clients.create_index("phone", unique=True)
    await db.appointments.create_index([("date", 1), ("start_min", 1)])
    for i in (1, 2):
        u = os.environ[f"ADMIN{i}_USERNAME"].lower()
        await db.admins.update_one(
            {"username": u},
            {"$setOnInsert": {
                "username": u,
                "display_name": os.environ[f"ADMIN{i}_NAME"],
                "password_hash": bcrypt.hashpw(os.environ[f"ADMIN{i}_PASSWORD"].encode(), bcrypt.gensalt()).decode(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    vcf = ROOT_DIR / "contatos.vcf"
    if vcf.exists() and not await db.meta.find_one({"key": "vcf_seeded"}):
        r = await import_pairs(parse_vcf(vcf.read_text("utf-8", "ignore")), "vcf")
        await db.meta.insert_one({"key": "vcf_seeded", "result": r})
        logger.info(f"Seeded contacts: {r}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
