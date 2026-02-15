# 최소 수정 패치안 (치명 이슈 4개)

대상 파일: `AI_MULTI_ANALYZER_PRO_V2_0_WITH_AUTO_UPDATE_FIXED.py`

아래는 **기존 구조를 최대한 유지**하면서 치명 이슈 4개만 반영하는 최소 패치입니다.

---

## 1) 문자열 개행 문법 오류 방지

문제: 문자열에 실제 줄바꿈이 섞여 있으면 `SyntaxError` 가능.

```diff
- return False, None, "이미 다른 곳에서 사용 중인 계정입니다.
- 기존 사용이 종료된 후 다시 시도하세요."
+ return False, None, (
+     "이미 다른 곳에서 사용 중인 계정입니다.\n"
+     "기존 사용이 종료된 후 다시 시도하세요."
+ )
```

---

## 2) `update_cell` 연속 호출 → `batch_update`로 1회 호출

문제: 네트워크 지연/쿼터 소모/실패 지점 증가.

```diff
+ def update_session_cells(sheet, row_idx, col_map, values):
+     """세션 관련 셀들을 한 번에 업데이트"""
+     reqs = []
+     for key, value in values.items():
+         c = col_map[key]
+         reqs.append({"range": gspread.utils.rowcol_to_a1(row_idx, c), "values": [[str(value)]]})
+     sheet.batch_update(reqs)
```

`acquire_login_lock`, `refresh_login_lock`, `release_login_lock` 내부:

```diff
- sheet.update_cell(row_idx, col["active_token"], new_token)
- sheet.update_cell(row_idx, col["expires_at"], str(new_expires))
- sheet.update_cell(row_idx, col["last_seen"], str(now))
- sheet.update_cell(row_idx, col["device_id"], device_id)
+ update_session_cells(sheet, row_idx, col, {
+     "active_token": new_token,
+     "expires_at": new_expires,
+     "last_seen": now,
+     "device_id": device_id,
+ })
```

---

## 3) 로그인 락 원자성 보강(최소)

문제: 읽고-수정 사이 경쟁 상태(race condition).

핵심 아이디어: 쓰기 직전 한 번 더 읽어서 `active_token/expires_at`이 바뀌었으면 중단.

```diff
+ def recheck_row_state(sheet, uid):
+     records = sheet.get_all_records()
+     row_idx = find_user_row_index(records, uid)
+     if row_idx is None:
+         return None, None
+     return row_idx, records[row_idx - 2]
```

`acquire_login_lock`의 쓰기 직전:

```diff
+ # optimistic recheck (경쟁 상황 완화)
+ latest_row_idx, latest_row = recheck_row_state(sheet, uid)
+ if latest_row_idx != row_idx:
+     return False, None, "동시 로그인 충돌이 감지되었습니다. 다시 시도하세요."
+
+ latest_token = _get_cell(latest_row, "active_token")
+ latest_expires_s = _get_cell(latest_row, "expires_at", "0")
+ try:
+     latest_expires = int(float(latest_expires_s)) if latest_expires_s else 0
+ except (ValueError, TypeError):
+     latest_expires = 0
+
+ if latest_token != active_token or latest_expires != expires_at:
+     return False, None, "동시 로그인 충돌이 감지되었습니다. 다시 시도하세요."
```

---

## 4) bare `except:` 제거 + UI 스레드 안전 호출 보강

문제: 예외 은닉 + Tkinter 메인 스레드 규칙 위반 위험.

```diff
- except:
-     expires_at = 0
+ except (ValueError, TypeError):
+     expires_at = 0
```

```diff
- except:
-     continue
+ except Exception:
+     continue
```

워커 스레드에서 직접 UI 호출하는 구간:

```diff
- if len(preds) < num_predictions:
-     messagebox.showwarning("경고", f"생성된 조합: {len(preds)}개")
+ if len(preds) < num_predictions:
+     root.after(0, lambda: messagebox.showwarning("경고", f"생성된 조합: {len(preds)}개"))
```

종료부:

```diff
- except:
-     pass
+ except Exception:
+     pass
```

---

## 적용 우선순위

1. 문자열 개행 수정
2. `batch_update` 전환
3. 락 recheck 추가
4. bare `except` 정리 + `root.after` 보강

위 4개만 적용해도 **실행 안정성/로그인 충돌/운영 쿼터 문제**가 가장 크게 개선됩니다.
