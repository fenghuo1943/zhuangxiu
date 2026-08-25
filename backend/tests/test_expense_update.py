from datetime import date

from backend.schemas import ExpenseUpdate


def test_expense_update_blank_optional_fields_become_none():
    payload = {
        "title": "水电材料",
        "amount": 120.5,
        "category_id": "hard",
        "sub_category_id": "",
        "stage_id": "",
        "date": "2026-08-25",
        "status": "paid",
        "payer": "",
        "note": "",
    }

    model = ExpenseUpdate(**payload)

    assert model.sub_category_id is None
    assert model.stage_id is None
    assert model.payer is None
    assert model.note is None
    assert model.date == date(2026, 8, 25)
