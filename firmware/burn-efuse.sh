#!/bin/bash
# Burn XPD_SDIO_TIEH efuse on this ESP32 to lock flash voltage at 3.3V.
# Run with ESP32 off the adapter, plugged direct via USB.
# Irreversible. Standard fix for Seengreat/Waveshare HUB75 adapter boards.

~/.platformio/penv/bin/python ~/.platformio/packages/tool-esptoolpy/espefuse.py --port /dev/cu.usbserial-0001 set_flash_voltage 3.3V
