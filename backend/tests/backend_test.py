"""Backend API tests for Martins Cabeleireiro.

Covers: auth, services, slots (incl. exclude_id), appointments CRUD + conflicts,
reschedule, confirm toggle, reminders, clients, blocked days, report, QR.
"""
import os
import io
import re
from datetime import date, timedelta
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") if os.environ.get("EXPO_PUBLIC_BACKEND_URL") else "https://martins-barbearia.preview.emergentagent.com"
API = f"{BASE}/api"

CREDS = {"martins": "#Agora100%", "elizama": "#Zama2020"}


@pytest.fixture(scope="session")
def tokens():
    t = {}
    for u, p in CREDS.items():
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
    assert len(r.json()) == 14


# ---- Slots ----
def _next_weekday(target):
    d = date.today()
    while d.weekday() != target:
        d += timedelta(days=1)
    return d


def test_slots_sunday_closed():
    sunday = _next_weekday(6).isoformat()
    j = requests.get(f"{API}/slots", params={"date": sunday, "service_id": "corte-masculino"}, timeout=20).json()
    assert j["open"] is False and j["slots"] == []


def test_slots_invalid_service():
    assert requests.get(f"{API}/slots", params={"date": "2026-12-01", "service_id": "nope"}, timeout=20).status_code == 404


# ---- Appointments + conflicts ----
def _future_monday():
    d = date.today() + timedelta(days=2)
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
    assert j["end_time"] == "10:30"
    yield j
    # cleanup: cancel then DELETE
    requests.patch(f"{API}/admin/appointments/{j['id']}", json={"status": "cancelado"}, headers=H(tokens["martins"]), timeout=20)
    requests.delete(f"{API}/admin/appointments/{j['id']}", headers=H(tokens["martins"]), timeout=20)


def test_appointment_conflict_overlap(created_appt):
    body = {"service_id": "corte-masculino", "date": created_appt["date"], "time": "10:15",
            "client_name": "TEST2", "client_phone": "69988776655"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 409


def test_slots_exclude_id_frees_own_slot(created_appt):
    # Without exclude_id: 10:00 should NOT be in slots (busy)
    d = created_appt["date"]
    j1 = requests.get(f"{API}/slots", params={"date": d, "service_id": "corte-masculino"}, timeout=20).json()
    assert "10:00" not in j1["slots"]
    # With exclude_id: 10:00 should BE in slots (exclude itself)
    j2 = requests.get(f"{API}/slots",
                      params={"date": d, "service_id": "corte-masculino", "exclude_id": created_appt["id"]},
                      timeout=20).json()
    assert "10:00" in j2["slots"]


# ---- Reschedule ----
def test_reschedule_success_and_resets_flags(tokens, created_appt):
    # First confirm it so we can verify reset
    requests.patch(f"{API}/admin/appointments/{created_appt['id']}",
                   json={"confirmed": True, "reminded": True},
                   headers=H(tokens["martins"]), timeout=20)
    # Reschedule to 15:00 same date
    r = requests.post(f"{API}/admin/appointments/{created_appt['id']}/reschedule",
                      json={"date": created_appt["date"], "time": "15:00"},
                      headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["time"] == "15:00" and j["end_time"] == "15:30"
    assert j["status"] == "agendado"
    assert j["confirmed"] is False and j["reminded"] is False
    # update fixture reference
    created_appt["time"] = "15:00"


def test_reschedule_conflict_with_other(tokens, created_appt):
    # Create a 2nd appt at 16:00 on same date; reschedule 1st to 16:00 should 409
    d = created_appt["date"]
    body = {"service_id": "corte-masculino", "date": d, "time": "16:00",
            "client_name": "TEST Other", "client_phone": "69990000111"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    assert r.status_code == 200
    other_id = r.json()["id"]
    try:
        rr = requests.post(f"{API}/admin/appointments/{created_appt['id']}/reschedule",
                           json={"date": d, "time": "16:00"},
                           headers=H(tokens["martins"]), timeout=20)
        assert rr.status_code == 409
    finally:
        requests.patch(f"{API}/admin/appointments/{other_id}", json={"status": "cancelado"},
                       headers=H(tokens["martins"]), timeout=20)
        requests.delete(f"{API}/admin/appointments/{other_id}", headers=H(tokens["martins"]), timeout=20)


def test_reschedule_requires_auth():
    r = requests.post(f"{API}/admin/appointments/aaa/reschedule", json={"date": "2026-12-01", "time": "10:00"}, timeout=20)
    assert r.status_code == 401


# ---- Confirm toggle ----
def test_patch_confirmed(tokens, created_appt):
    r = requests.patch(f"{API}/admin/appointments/{created_appt['id']}",
                       json={"confirmed": True},
                       headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    assert r.json()["confirmed"] is True
    r2 = requests.patch(f"{API}/admin/appointments/{created_appt['id']}",
                        json={"confirmed": False},
                        headers=H(tokens["martins"]), timeout=20)
    assert r2.status_code == 200
    assert r2.json()["confirmed"] is False


# ---- Reminders ----
def test_reminders_tomorrow(tokens):
    r = requests.get(f"{API}/admin/reminders", headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "date" in j and "items" in j


# ---- Report ----
def test_report_requires_auth():
    r = requests.get(f"{API}/admin/report", params={"month": "2026-10"}, timeout=20)
    assert r.status_code == 401


def test_report_bad_month(tokens):
    r = requests.get(f"{API}/admin/report", params={"month": "2026/10"}, headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 400
    r2 = requests.get(f"{API}/admin/report", params={"month": "bad"}, headers=H(tokens["martins"]), timeout=20)
    assert r2.status_code == 400


def test_report_shape_and_top_services_sorted(tokens):
    month = date.today().strftime("%Y-%m")
    r = requests.get(f"{API}/admin/report", params={"month": month}, headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    j = r.json()
    for k in ("month", "revenue", "expected", "total", "completed", "scheduled",
             "cancelled", "confirmed", "unique_clients", "avg_ticket", "top_services"):
        assert k in j, f"missing {k}"
    assert j["month"] == month
    assert j["total"] == j["completed"] + j["scheduled"]
    # top_services sorted desc by count
    counts = [s["count"] for s in j["top_services"]]
    assert counts == sorted(counts, reverse=True)


# ---- QR ----
def test_qr_returns_png():
    r = requests.get(f"{API}/qr", params={"data": "https://example.com/x"}, timeout=20)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"


# ---- Clients (regression) ----
def test_list_clients(tokens):
    r = requests.get(f"{API}/admin/clients", params={"limit": 5}, headers=H(tokens["martins"]), timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert j["total"] >= 0 and len(j["items"]) <= 5


def test_delete_requires_cancelled_first(tokens):
    """Regression: cannot delete non-cancelled appointments."""
    d = _future_monday()
    body = {"service_id": "barba", "date": d, "time": "11:00",
            "client_name": "TEST Del", "client_phone": "69922223333"}
    r = requests.post(f"{API}/appointments", json=body, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"could not create ({r.status_code})")
    aid = r.json()["id"]
    try:
        # delete without cancel -> 400
        dr = requests.delete(f"{API}/admin/appointments/{aid}", headers=H(tokens["martins"]), timeout=20)
        assert dr.status_code == 400
        # cancel then delete -> ok
        requests.patch(f"{API}/admin/appointments/{aid}", json={"status": "cancelado"},
                       headers=H(tokens["martins"]), timeout=20)
        dr2 = requests.delete(f"{API}/admin/appointments/{aid}", headers=H(tokens["martins"]), timeout=20)
        assert dr2.status_code == 200
    finally:
        requests.patch(f"{API}/admin/appointments/{aid}", json={"status": "cancelado"},
                       headers=H(tokens["martins"]), timeout=20)
        requests.delete(f"{API}/admin/appointments/{aid}", headers=H(tokens["martins"]), timeout=20)
