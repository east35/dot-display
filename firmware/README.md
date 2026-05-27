# dot-display firmware

ESP32-DevKitC firmware that subscribes to MQTT frames from the Mac dev server
and renders them on a 64×32 HUB75 panel via the Waveshare RGB Matrix
Adapter Board (E).

## Pinout

Defaults in `src/main.cpp` are the **Adapter Board (E) V2.x** mapping for
ESP32-DevKitC V4 (classic ESP-WROOM-32, not S3).

## Mac side: mosquitto

```
brew install mosquitto
brew services start mosquitto
```

Default config listens on `localhost:1883`. Open the LAN by editing
`/opt/homebrew/etc/mosquitto/mosquitto.conf` (or wherever brew put it):

```
listener 1883 0.0.0.0
allow_anonymous true
```

Then `brew services restart mosquitto`.

Set `PUBLISHER=mqtt` and `MQTT_BROKER=mqtt://localhost:1883` in `.env` and run
`npm run start` from the project root.

## Flashing

```
brew install platformio
cd firmware
pio run -t upload
pio device monitor
```

The boot sweep (red → green → blue) confirms the panel and pinout are wired
correctly. After that, frames should start arriving over WiFi.
