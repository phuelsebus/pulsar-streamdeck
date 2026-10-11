# Pulsar Battery for Stream Deck

Shows the battery level of a Pulsar wireless mouse on an Elgato Stream Deck key: battery icon, percentage,
colour by level (green / orange / red), blue with a bolt while charging. Press the key to refresh; it also
updates every minute.

Developed and tested with a **Pulsar X3 Superlight (Medium)** on the **Pulsar 8K Dongle** (USB PID `0x5406`), Windows 11.
Other Pulsar mice that use the same dongle protocol will probably work, but are untested.

> Unofficial project. Not affiliated with or endorsed by Pulsar Gaming Gears or Elgato.

## Requirements

- Windows 10/11, Stream Deck software 6.4+
- [Python 3](https://www.python.org/downloads/) (with `pip`)
- [Node.js](https://nodejs.org/) (only for installing, the Stream Deck software brings its own runtime)
- The mouse connected through its 2.4 GHz dongle

## Install

```powershell
git clone <this repo>
cd pulsar-streamdeck
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

The script installs `hidapi` (Python) and copies the plugin to
`%APPDATA%\Elgato\StreamDeck\Plugins`. Restart Stream Deck, then drag **Battery** (category *Pulsar Battery*) onto a key.

## Test without Stream Deck

```powershell
python com.phuelsebus.pulsar-battery.sdPlugin\bin\pulsar_battery.py
```

```json
{"percent": 82, "charging": false, "mv": 4026, "device_percent": 80}
```

`percent` is derived from the battery voltage with the same curve as Pulsar's web app, so it matches what you
see there. `device_percent` is the raw value reported by the mouse and can differ by a few percent.

## How it works

The dongle exposes a vendor HID interface (usage page `0xFF02`, usage `2`, report ID 8). The script sends
16-byte command packets (command `3` = host control, command `4` = battery) with a checksum of
`85 - sum(report ID + bytes 0..14)`, and reads the reply: percent, charging flag and voltage in mV.
The plugin runs the script and renders the key as an SVG.

The protocol was worked out by observing the behaviour of the browser based configurators
[Pulsar Fusion](https://bbb.pulsar.gg/cMouse/) and [OpenMouse](https://control.openmouse.app/);
no code was copied from them.

## Limitations

- Only one program can talk to the dongle at a time. If a configurator is open in the browser, a reading can fail;
  the plugin then keeps the last value.
- If the mouse is asleep, the key shows `offline` until it moves.
- The script uses `python` (or `py -3`) from `PATH`. Set the environment variable `PULSAR_PYTHON` to use another interpreter.

## Package a release

```powershell
npm install -g @elgato/cli
cd com.phuelsebus.pulsar-battery.sdPlugin
npm install --omit=dev
streamdeck pack .
```

## License

[MIT](LICENSE)
