// dot-display ESP32 firmware
// Subscribes to MQTT, renders 64x32 raw-RGB frames on a HUB75 panel via the
// Waveshare RGB Matrix Adapter Board (E).

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESP32-HUB75-MatrixPanel-I2S-DMA.h>

// Set 1 to skip WiFi/MQTT entirely and just cycle solid colors on the panel.
// Useful for verifying the panel pinout + driver in isolation.
#define DEBUG_PANEL_ONLY 1

// ---- user config ----------------------------------------------------------
static const char* WIFI_SSID    = "Eros";
static const char* WIFI_PASS    = "5124061219";
static const char* MQTT_HOST    = "192.168.7.148";  // Mac LAN IP
static const uint16_t MQTT_PORT = 1883;
static const char* MQTT_FRAME   = "matrix/frame";
static const char* MQTT_META    = "matrix/meta";

// Seengreat RGB Matrix Adapter Board (E) Rev 2.x — classic ESP32-DevKitC socket.
// Matches the ESP32-HUB75-MatrixPanel-I2S-DMA library default pinout, which is
// what the Seengreat (E) board is wired to. E is unused for 1/16-scan 64x32.
#define R1_PIN  25
#define G1_PIN  26
#define B1_PIN  27
#define R2_PIN  14
#define G2_PIN  12
#define B2_PIN  13
#define A_PIN   23
#define B_PIN   19
#define C_PIN   5
#define D_PIN   17
#define E_PIN   -1
#define LAT_PIN 4
#define CLK_PIN 16
#define OE_PIN  15

static const int PANEL_W = 64;
static const int PANEL_H = 32;
static const size_t FRAME_BYTES = PANEL_W * PANEL_H * 3;

// MQTT frames can be up to FRAME_BYTES (6144) — PubSubClient default buffer is
// too small, so we set it explicitly in setup().
// ---------------------------------------------------------------------------

MatrixPanel_I2S_DMA* panel = nullptr;
WiFiClient netClient;
PubSubClient mqtt(netClient);

// Stage indicator bars on the top row of the panel for visual debugging
// since USB serial isn't available while seated on the adapter.
//   x=0..15  panel/init
//   x=16..31 wifi
//   x=32..47 mqtt
//   x=48..63 first-frame heartbeat (toggles)
enum class StageColor : uint8_t { Off, Yellow, Green, Red, Blue };
static void stage(int slot, StageColor c) {
  if (!panel) return;
  uint8_t r=0,g=0,b=0;
  switch (c) {
    case StageColor::Yellow: r=80; g=60; break;
    case StageColor::Green:  g=80; break;
    case StageColor::Red:    r=80; break;
    case StageColor::Blue:   b=80; break;
    default: break;
  }
  int x0 = slot * 16;
  for (int x = x0; x < x0 + 16; ++x) panel->drawPixelRGB888(x, 0, r, g, b);
}

static bool gotFirstFrame = false;
static uint32_t framesRecv = 0;

static void onFrame(byte* payload, unsigned int len) {
  if (len != FRAME_BYTES) return;
  size_t i = 0;
  for (int y = 0; y < PANEL_H; ++y) {
    for (int x = 0; x < PANEL_W; ++x) {
      uint8_t r = payload[i++];
      uint8_t g = payload[i++];
      uint8_t b = payload[i++];
      panel->drawPixelRGB888(x, y, r, g, b);
    }
  }
  gotFirstFrame = true;
  framesRecv++;
  // Heartbeat — blink slot 3 every 10 frames so we know frames keep arriving
  // even after first-frame indicator is overdrawn by app content.
  if ((framesRecv % 10) == 0) {
    stage(3, (framesRecv / 10) % 2 ? StageColor::Blue : StageColor::Green);
  }
}

static void onMqtt(char* topic, byte* payload, unsigned int len) {
  if (strcmp(topic, MQTT_FRAME) == 0) {
    onFrame(payload, len);
  } else if (strcmp(topic, MQTT_META) == 0) {
    Serial.printf("[meta] %.*s\n", (int)len, (const char*)payload);
  }
}

static bool connectWifi() {
  stage(1, StageColor::Yellow);
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  const uint32_t deadline = millis() + 15000;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(250);
    Serial.print('.');
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[wifi] timeout");
    stage(1, StageColor::Red);
    return false;
  }
  Serial.printf("\n[wifi] ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  stage(1, StageColor::Green);
  return true;
}

static bool connectMqtt() {
  stage(2, StageColor::Yellow);
  String clientId = "dot-display-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[mqtt] connecting as %s to %s:%u\n", clientId.c_str(), MQTT_HOST, MQTT_PORT);
  if (mqtt.connect(clientId.c_str())) {
    Serial.println("[mqtt] connected");
    mqtt.subscribe(MQTT_FRAME, 0);
    mqtt.subscribe(MQTT_META, 0);
    stage(2, StageColor::Green);
    return true;
  }
  Serial.printf("[mqtt] failed rc=%d\n", mqtt.state());
  stage(2, StageColor::Red);
  return false;
}

void setup() {
  Serial.begin(115200);
  Serial.flush();
  delay(500);
  Serial.println();
  Serial.println("[boot] dot-display firmware");
  Serial.printf("[boot] chip=%s rev=%d cores=%d freq=%lu\n",
                ESP.getChipModel(), ESP.getChipRevision(),
                ESP.getChipCores(), (unsigned long)ESP.getCpuFreqMHz());
  Serial.flush();

  Serial.println("[panel] building HUB75 config (matching Seengreat V2.x demo)");
  Serial.flush();
  // Pin order matches the i2s_pins struct in the upstream library and the
  // Seengreat demo: R1,G1,B1,R2,G2,B2, A,B,C,D,E, LAT,OE,CLK.
  HUB75_I2S_CFG::i2s_pins pins = {
    R1_PIN, G1_PIN, B1_PIN, R2_PIN, G2_PIN, B2_PIN,
    A_PIN, B_PIN, C_PIN, D_PIN, E_PIN,
    LAT_PIN, OE_PIN, CLK_PIN
  };
  // Seengreat demo passes the driver chip in the constructor.
  HUB75_I2S_CFG mxconfig(PANEL_W, PANEL_H, 1, pins, HUB75_I2S_CFG::FM6126A);
  mxconfig.gpio.e = E_PIN;

  Serial.println("[panel] allocating MatrixPanel_I2S_DMA");
  Serial.flush();
  panel = new MatrixPanel_I2S_DMA(mxconfig);
  panel->setBrightness8(255);

  Serial.println("[panel] calling begin()");
  Serial.flush();
  if (!panel->begin()) {
    Serial.println("[panel] begin() FAILED — DMA alloc likely out of memory");
    Serial.flush();
  } else {
    Serial.println("[panel] begin() ok");
    Serial.flush();
  }
  panel->clearScreen();

  Serial.println("[panel] boot color sweep");
  Serial.flush();
  for (uint8_t c = 0; c < 3; ++c) {
    panel->fillScreenRGB888(c == 0 ? 64 : 0, c == 1 ? 64 : 0, c == 2 ? 64 : 0);
    delay(300);
  }
  panel->clearScreen();

  // Stage indicators: panel ok (slot 0 green), others off until they run.
  stage(0, StageColor::Green);

#if DEBUG_PANEL_ONLY
  Serial.println("[debug] panel-only mode — skipping wifi/mqtt");
  Serial.flush();
  return;
#else
  Serial.println("[wifi] starting");
  Serial.flush();
  connectWifi();

  Serial.println("[mqtt] configuring client");
  Serial.flush();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqtt);
  mqtt.setBufferSize(8192);
  mqtt.setSocketTimeout(5);
  mqtt.setKeepAlive(30);
  Serial.println("[setup] done");
  Serial.flush();
#endif
}

void loop() {
#if DEBUG_PANEL_ONLY
  // Cycle solid colors so we can verify scan/multiplexing.
  // Print a heartbeat so we know loop() is alive.
  static uint32_t tick = 0;
  static const uint8_t palette[][3] = {
    {64, 0, 0}, {0, 64, 0}, {0, 0, 64},
    {64, 64, 0}, {0, 64, 64}, {64, 0, 64},
    {64, 64, 64},
  };
  const auto& c = palette[tick % 7];
  panel->fillScreenRGB888(c[0], c[1], c[2]);
  Serial.printf("[tick %u] color=(%u,%u,%u)\n", tick, c[0], c[1], c[2]);
  Serial.flush();
  tick++;
  delay(1500);
  return;
#else
  if (WiFi.status() != WL_CONNECTED) {
    if (!connectWifi()) {
      delay(2000);
      return;
    }
  }
  if (!mqtt.connected()) {
    if (!connectMqtt()) {
      delay(2000);
      return;
    }
  }
  mqtt.loop();
#endif
}
