import { usb, getDeviceList, Device } from 'usb'
import { Server } from 'socket.io'

// Common Android vendor IDs
const ANDROID_VENDOR_IDS = [
  0x04e8, // Samsung
  0x18d1, // Google / Nexus / Pixel
  0x2717, // Xiaomi
  0x19d2, // ZTE
  0x0bb4, // HTC
  0x12d1, // Huawei
  0x1ebf, // OnePlus (older)
  0x2a70, // OnePlus (newer)
  0x054c, // Sony
  0x0fce, // Sony Ericsson
  0x1004, // LG
  0x0502, // Acer
  0x0409, // Nokia
]

function isAndroidDevice(device: Device): boolean {
  return ANDROID_VENDOR_IDS.includes(device.deviceDescriptor.idVendor)
}

function getConnectedAndroidDevice(): Device | undefined {
  return getDeviceList().find(isAndroidDevice)
}

export function isDeviceCurrentlyConnected(): boolean {
  return !!getConnectedAndroidDevice()
}

export function initUsbService(io: Server) {
  // Check if a device is already connected when server starts
  const existing = getConnectedAndroidDevice()
  if (existing) {
    console.log('Android device already connected on startup')
  }

  usb.on('attach', (device: Device) => {
    if (isAndroidDevice(device)) {
      console.log('Android device connected')
      io.emit('device:connected')
    }
  })

  usb.on('detach', (device: Device) => {
    if (isAndroidDevice(device)) {
      console.log('Android device disconnected')
      io.emit('device:disconnected')
    }
  })

  console.log('USB service initialized')
}