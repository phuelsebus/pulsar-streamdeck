"""Reads the battery level of a Pulsar wireless mouse through its USB dongle (HID).

Prints one JSON line: {"percent", "charging", "mv", "device_percent"} or {"error"}.
"""
import json
import sys
import time

import hid

VID = 0x3710
REPORT_ID = 8
USAGE_PAGE = 0xFF02
USAGE = 2
CMD_DEVICE_ONLINE = 3
CMD_BATTERY = 4


# Voltage curve (mV) -> percent, 20 segments of 5 % each (matches the Pulsar web app)
CURVE = [3050, 3420, 3480, 3540, 3600, 3660, 3720, 3760, 3800, 3840, 3880,
         3920, 3940, 3960, 3980, 4000, 4020, 4040, 4060, 4080, 4110]


def percent_from_voltage(mv, charging):
    if mv > CURVE[-1]:
        return 99 if charging else 100
    a = next((i for i, v in enumerate(CURVE) if mv < v), -1)
    if a == -1:
        return 0
    if a == 0:
        return 0
    step = (CURVE[a] - CURVE[a - 1]) / 5
    s = (mv - CURVE[a - 1]) / step + 5 * (a - 1)
    if s in (0, 15):
        s += 1
    return int(s + 0.5)


def packet(cmd, params=b""):
    p = bytearray(16)
    p[0] = cmd
    p[4] = len(params)
    p[5:5 + len(params)] = params
    p[15] = (85 - ((REPORT_ID + sum(p[:15])) & 0xFF)) & 0xFF
    return bytes(p)


def exchange(dev, cmd, params=b"", timeout=1.2):
    dev.write(bytes([REPORT_ID]) + packet(cmd, params))
    end = time.time() + timeout
    while time.time() < end:
        data = dev.read(64, 100)
        if not data:
            continue
        data = bytes(data)
        if data[0] in (8, 9) and len(data) >= 17 and data[1] == cmd:
            return data[1:17]  # strip the report ID
    raise TimeoutError(f"no response to command {cmd}")


def set_online(dev, on):
    for _ in range(20):
        r = exchange(dev, CMD_DEVICE_ONLINE, bytes([1 if on else 0]))
        if r[9] != 1:
            break
        time.sleep(0.01)
    return r


def read_battery():
    info = next((d for d in hid.enumerate(VID)
                 if d["usage_page"] == USAGE_PAGE and d["usage"] == USAGE), None)
    if not info:
        raise RuntimeError("Pulsar dongle not found")
    dev = hid.device()
    dev.open_path(info["path"])
    try:
        r = set_online(dev, True)
        if r[5] != 1:
            raise RuntimeError("Mouse offline (move it or click a button)")
        try:
            b = exchange(dev, CMD_BATTERY)
        finally:
            try:
                set_online(dev, False)
            except Exception:
                pass
        mv = (b[7] << 8) + b[8]
        charging = b[6] == 1
        pct = percent_from_voltage(mv, charging) if mv > 0 else b[5]
        return {"percent": pct, "charging": charging, "mv": mv, "device_percent": b[5]}
    finally:
        dev.close()


if __name__ == "__main__":
    try:
        print(json.dumps(read_battery()))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
