import json
import urllib.request
import urllib.error

routes = [
    ("Bengaluru-Mysuru", {"start_city": "bengaluru", "final_destination": "mysuru", "days": 2, "departure_date": "2026-11-11"}),
    ("Bengaluru-Hampi", {"start_city": "bengaluru", "final_destination": "hampi", "days": 4, "departure_date": "2026-11-11"}),
    ("Bengaluru-Coorg", {"start_city": "bengaluru", "final_destination": "coorg", "days": 3, "departure_date": "2026-11-11"}),
    ("Bengaluru-Gokarna", {"start_city": "bengaluru", "final_destination": "gokarna", "days": 4, "departure_date": "2026-11-11"}),
    ("Mangaluru-Udupi", {"start_city": "mangaluru", "final_destination": "udupi", "days": 2, "departure_date": "2026-11-11"}),
    ("Hubballi-Gokak", {"start_city": "hubballi", "final_destination": "gokak", "days": 2, "departure_date": "2026-11-11"}),
    ("Mysuru-Ooty border", {"start_city": "mysuru", "final_destination": "ooty", "days": 2, "departure_date": "2026-11-11"}),
    ("Same start and end (Bengaluru-Bengaluru)", {"start_city": "bengaluru", "final_destination": "bengaluru", "days": 2, "departure_date": "2026-11-11"}),
    ("Very short route (Mysuru-Srirangapatna)", {"start_city": "mysuru", "final_destination": "srirangapatna", "days": 1, "departure_date": "2026-11-11"}),
    ("Belagavi-Vijayapura", {"start_city": "belagavi", "final_destination": "vijayapura", "days": 3, "departure_date": "2026-11-11"}),
    ("Unknown city (Bengaluru-Atlantis)", {"start_city": "bengaluru", "final_destination": "atlantis", "days": 2, "departure_date": "2026-11-11"}),
]

results = []
for name, payload in routes:
    print(f"Testing route: {name} ...")
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/routes/discover",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"}
        )
        res = urllib.request.urlopen(req)
        d = json.loads(res.read())
        
        # Test plan
        plan_req = {
            "discovery": payload,
            "selected_stop_ids": [s["candidate_id"] for s in d.get("candidates", [])[:2]],
            "selected_meal_ids": []
        }
        req2 = urllib.request.Request(
            "http://127.0.0.1:8000/api/routes/plan",
            data=json.dumps(plan_req).encode(),
            headers={"Content-Type": "application/json"}
        )
        res2 = urllib.request.urlopen(req2)
        p = json.loads(res2.read())
        
        status = f"PASSED (Discover: {d['route']['distance_km']} km, Plan: {len(p['itinerary'])} days)"
        print(f"  -> {status}")
        results.append((name, "PASSED", status))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        try:
            body = json.loads(err_body)
            msg = body.get("error", {}).get("message") or body.get("detail") or str(body)
        except Exception:
            msg = err_body
        status = f"EXPECTED ERROR {e.code}: {msg}"
        print(f"  -> {status}")
        results.append((name, f"HTTP {e.code}", msg))
    except Exception as e:
        status = f"FAILED: {e}"
        print(f"  -> {status}")
        results.append((name, "FAILED", str(e)))

print("\n--- SUMMARY TABLE ---")
for name, outcome, details in results:
    print(f"{name:40} | {outcome:12} | {details}")
