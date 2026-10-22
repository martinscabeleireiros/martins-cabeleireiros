"""Backend API tests for Martins Cabeleireiro."""
import os
import io
from datetime import date, timedelta
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://martins-barbearia.preview.emergentagent.com"
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def tokens():
    t = {}
    for u, p in [("martins", "martins123"), ("elizama", "elizama123")]:
        r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=20)
        assert r.status_code == 200, f"Login {u}: {r.status_code} {r.text}"
        t[u] = r.json()["access_token"]
    return t


def H(tok): return {"Authorization": f"Bearer {tok}"}


# ---- Auth ----
def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"username": "martins", "password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_auth_me(tokens):
    r = requests.get(f"{API}/auth/me", headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["username"] == "martins"


def test_me_no_token():
    assert requests.get(f"{API}/auth/me", timeout=20).status_code == 401


# ---- Services ----
def test_services_14():
    r = requests.get(f"{API}/services", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 14
    assert all({"id", "name", "price", "duration"} <= set(s) for s in data)


# ---- Slots ----
def _next_weekday(target):
    d = date.today()
    while d.weekday() != target:
        d += timedelta(days=1)
    return d


def test_slots_sunday_closed():
    sunday = _next_weekday(6).isoformat()
    r = requests.get(f"{API}/slots", params={"date": sunday, "service_id": "corte-masculino"}, timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["open"] is False and j["slots"] == []


def test_slots_monday_open_15min_step_and_end_bound():
    monday = _next_weekday(0)
    if monday == date.today():
        monday += timedelta(days=7)
    r = requests.get(f"{API}/slots", params={"date": monday.isoformat(), "service_id": "corte-masculino"}, timeout=20)
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert len(slots) > 0
    # 15-min step
    mins = [int(s.split(":")[0]) * 60 + int(s.split(":")[1]) for s in slots]
    for a, b in zip(mins, mins[1:]):
        assert (b - a) % 15 == 0
    # end <= 20:00 for 30-min service -> last start <= 19:30
    assert max(mins) + 30 <= 20 * 60


def test_slots_invalid_service():
    assert requests.get(f"{API}/slots", params={"date": "2026-10-05", "service_id": "nope"}, timeout=20).status_code == 404


# ---- Appointments + conflicts ----
def _future_monday():
    d = date.today() + timedelta(days=1)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d.isoformat()


@pytest.fixture(scope="module")
def created_appt(tokens):
    d = _future_monday()
    body = {"service_id": "corte-masculino", "date": d, "time": "10:00",
            "client_name": "TEST Cliente", "client_phone": "69999887766", "notes": "pytest"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["end_time"] == "10:30" and j["duration"] == 30
    yield j
    # cleanup
    requests.patch(f"{API}/admin/appointments/{j['id']}", json={"status": "cancelado"}, headers=H(tokens["martins"]), timeout=20)


def test_appointment_conflict_overlap(created_appt):
    # overlap: start 10:15 for 30 min overlaps 10:00-10:30
    body = {"service_id": "corte-masculino", "date": created_appt["date"], "time": "10:15",
            "client_name": "TEST2", "client_phone": "69988776655"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 409


def test_appointment_persists_in_admin_list(created_appt, tokens):
    r = requests.get(f"{API}/admin/appointments", params={"date": created_appt["date"]},
                     headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    assert any(a["id"] == created_appt["id"] for a in r.json())


def test_appointment_invalid_phone():
    body = {"service_id": "corte-masculino", "date": _future_monday(), "time": "11:00",
            "client_name": "x", "client_phone": "123"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 400


def test_cancel_frees_slot(tokens):
    d = _future_monday()
    body = {"service_id": "barba", "date": d, "time": "14:00",
            "client_name": "TEST Free", "client_phone": "69911112222"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 200
    appt = r.json()
    # conflict exists
    r2 = requests.post(f"{API}/appointments", json={**body, "client_phone": "69911112223"}, timeout=20)
    assert r2.status_code == 409
    # cancel
    pr = requests.patch(f"{API}/admin/appointments/{appt['id']}", json={"status": "cancelado"},
                        headers=H(tokens["martins"]), timeout=20)
    assert pr.status_code == 200
    # slot available again
    sr = requests.get(f"{API}/slots", params={"date": d, "service_id": "barba"}, timeout=20)
    assert "14:00" in sr.json()["slots"]


# ---- Reminders ----
def test_reminders_tomorrow(tokens):
    r = requests.get(f"{API}/admin/reminders", headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "date" in j and "items" in j


# ---- Clients ----
def test_list_clients_pagination_search(tokens):
    r = requests.get(f"{API}/admin/clients", params={"limit": 5}, headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["total"] >= 0 and len(j["items"]) <= 5
    rs = requests.get(f"{API}/admin/clients", params={"q": "a", "limit": 3},
                      headers=H(tokens["martins"]), timeout=20)
    assert rs.status_code == 200


def test_client_crud_and_detail(tokens):
    # create
    r = requests.post(f"{API}/admin/clients", json={"name": "TEST Detail", "phone": "69955554444"},
                      headers=H(tokens["martins"]), timeout=20)
    assert r.status_code in (200, 409)
    if r.status_code == 409:
        q = requests.get(f"{API}/admin/clients", params={"q": "69955554444"},
                         headers=H(tokens["martins"]), timeout=20).json()
        cid = q["items"][0]["id"]
    else:
        cid = r.json()["id"]
    # detail
    d = requests.get(f"{API}/admin/clients/{cid}", headers=H(tokens["martins"]), timeout=20)
    assert d.status_code == 200
    j = d.json()
    assert "history" in j and "visits" in j and "total_spent" in j
    # delete
    dr = requests.delete(f"{API}/admin/clients/{cid}", headers=H(tokens["martins"]), timeout=20)
    assert dr.status_code == 200
    # verify gone
    gr = requests.get(f"{API}/admin/clients/{cid}", headers=H(tokens["martins"]), timeout=20)
    assert gr.status_code == 404


def test_import_vcf(tokens):
    with open("/app/backend/contatos.vcf", "rb") as f:
        data = f.read()
    files = {"file": ("contatos.vcf", io.BytesIO(data), "text/vcard")}
    r = requests.post(f"{API}/admin/clients/import-vcf", files=files,
                      headers=H(tokens["martins"]), timeout=120)
    assert r.status_code == 200
    j = r.json()
    assert "read" in j and "added" in j and "skipped" in j


def test_import_list(tokens):
    body = {"contacts": [{"name": "TEST List", "phone": "69977773333"}]}
    r = requests.post(f"{API}/admin/clients/import-list", json=body,
                      headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["read"] == 1
    # cleanup
    q = requests.get(f"{API}/admin/clients", params={"q": "69977773333"},
                     headers=H(tokens["martins"]), timeout=20).json()
    for it in q["items"]:
        requests.delete(f"{API}/admin/clients/{it['id']}", headers=H(tokens["martins"]), timeout=20)


# ---- Blocked days ----
def test_blocked_days_flow(tokens):
    d = (date.today() + timedelta(days=60)).isoformat()
    # cleanup any leftover
    cur = requests.get(f"{API}/admin/blocked-days", headers=H(tokens["martins"]), timeout=20).json()
    for b in cur:
        if b["date"] == d:
            requests.delete(f"{API}/admin/blocked-days/{b['id']}", headers=H(tokens["martins"]), timeout=20)
    r = requests.post(f"{API}/admin/blocked-days", json={"date": d, "reason": "TEST"},
                      headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    bid = r.json()["id"]
    # duplicate -> 409
    r2 = requests.post(f"{API}/admin/blocked-days", json={"date": d, "reason": "x"},
                       headers=H(tokens["martins"]), timeout=20)
    assert r2.status_code == 409
    # slots closed
    s = requests.get(f"{API}/slots", params={"date": d, "service_id": "corte-masculino"}, timeout=20).json()
    assert s["open"] is False and s["slots"] == []
    # delete
    dr = requests.delete(f"{API}/admin/blocked-days/{bid}", headers=H(tokens["martins"]), timeout=20)
    assert dr.status_code == 200


# ---- Change password (round-trip) ----
def test_change_password_roundtrip():
    # login
    r = requests.post(f"{API}/auth/login", json={"username": "elizama", "password": "elizama123"}, timeout=20)
    assert r.status_code == 200
    tok = r.json()["access_token"]
    # change
    r1 = requests.post(f"{API}/auth/change-password",
                       json={"current_password": "elizama123", "new_password": "elizama999"},
                       headers=H(tok), timeout=20)
    assert r1.status_code == 200
    # old fails
    assert requests.post(f"{API}/auth/login",
                         json={"username": "elizama", "password": "elizama123"}, timeout=20).status_code == 401
    # new works
    r2 = requests.post(f"{API}/auth/login",
                       json={"username": "elizama", "password": "elizama999"}, timeout=20)
    assert r2.status_code == 200
    tok2 = r2.json()["access_token"]
    # restore
    rr = requests.post(f"{API}/auth/change-password",
                       json={"current_password": "elizama999", "new_password": "elizama123"},
                       headers=H(tok2), timeout=20)
    assert rr.status_code == 200
    # verify restored
    assert requests.post(f"{API}/auth/login",
                         json={"username": "elizama", "password": "elizama123"}, timeout=20).status_code == 200


def test_short_new_password_rejected():
    r = requests.post(f"{API}/auth/login", json={"username": "martins", "password": "martins123"}, timeout=20)
    tok = r.json()["access_token"]
    rr = requests.post(f"{API}/auth/change-password",
                       json={"current_password": "martins123", "new_password": "123"},
                       headers=H(tok), timeout=20)
    assert rr.status_code == 400
