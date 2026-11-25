import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error instanceof Error ? reader.error : new Error('Could not read file'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Hands a generated file to the user. In a browser it downloads; inside the
 * Android app (where a WebView can't download) it opens the share sheet so the
 * file can be saved to Drive/Files or sent on WhatsApp.
 */
export async function saveFile(filename: string, blob: Blob): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
    })
    try {
      await Share.share({ title: filename, url: uri, dialogTitle: 'Save or share' })
    } catch (error) {
      // Closing the share sheet without choosing anything is not an error.
      if (!(error instanceof Error && /cancel/i.test(error.message))) throw error
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
