#!/bin/bash
# Print efuse summary so we can verify XPD_SDIO_TIEH (flash voltage) is burned.
# Run with ESP32 off the adapter, USB direct.

~/.platformio/penv/bin/python ~/.platformio/packages/tool-esptoolpy/espefuse.py --port /dev/cu.usbserial-0001 summary
