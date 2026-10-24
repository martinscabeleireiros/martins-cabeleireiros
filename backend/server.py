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
