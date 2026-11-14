package id.wphone.core.prefix

import id.wphone.core.config.WinArch
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

data class PeHeaderResult(
    val validPe: Boolean,
    val arch: WinArch?,
    val machineHex: String,
    val isPe32Plus: Boolean,
    val sha256: String,
    val notes: String
)

/**
 * Pure Kotlin Windows PE32 / PE32+ binary inspector.
 * Verifies MZ/PE signatures and Machine architecture (0x014C x86 vs 0x8664 x64)
 * before registering an executable into an isolated Wine prefix.
 */
object PeHeaderInspector {

    fun inspect(file: File): PeHeaderResult {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buf = ByteArray(8192)
            var read: Int
            while (input.read(buf).also { read = it } != -1) {
                digest.update(buf, 0, read)
            }
        }
        val sha256 = digest.digest().joinToString("") { "%02x".format(it) }

        if (!file.exists() || file.length() < 0x40) {
            return PeHeaderResult(false, null, "N/A", false, sha256, "File too small for DOS header.")
        }

        RandomAccessFile(file, "r").use { raf ->
            val dos = ByteArray(0x40)
            raf.readFully(dos)
            if (dos[0] != 0x4D.toByte() || dos[1] != 0x5A.toByte()) {
                return PeHeaderResult(false, null, "N/A", false, sha256, "Missing MZ signature.")
            }

            val peOffset = ByteBuffer.wrap(dos, 0x3C, 4).order(ByteOrder.LITTLE_ENDIAN).int.toLong()
            if (peOffset + 26 >= file.length()) {
                return PeHeaderResult(false, null, "MZ-ONLY", false, sha256, "No PE header found.")
            }

            raf.seek(peOffset)
            val peHeader = ByteArray(26)
            raf.readFully(peHeader)
            if (peHeader[0] != 0x50.toByte() || peHeader[1] != 0x45.toByte() ||
                peHeader[2] != 0.toByte() || peHeader[3] != 0.toByte()
            ) {
                return PeHeaderResult(false, null, "N/A", false, sha256, "Invalid PE\\0\\0 signature.")
            }

            val bb = ByteBuffer.wrap(peHeader).order(ByteOrder.LITTLE_ENDIAN)
            val machine = bb.getShort(4).toInt() and 0xFFFF
            val optMagic = bb.getShort(24).toInt() and 0xFFFF

            val arch = when (machine) {
                0x014C -> WinArch.X86
                0x8664 -> WinArch.X64
                else -> null
            }

            return PeHeaderResult(
                validPe = true,
                arch = arch,
                machineHex = "0x%04x".format(machine),
                isPe32Plus = optMagic == 0x20B,
                sha256 = sha256,
                notes = if (arch != null) {
                    "Valid ${arch.name} Windows PE binary routed to Wine WoW64 + Box64."
                } else {
                    "Unsupported PE machine type 0x%04x.".format(machine)
                }
            )
        }
    }
}

class PrefixManager(private val wphoneRoot: File) {

    fun prefixesDir(): File = File(wphoneRoot, "prefixes").apply { mkdirs() }

    fun ensurePrefix(prefixId: String, winVersion: String = "win10"): File {
        val dir = File(prefixesDir(), prefixId)
        File(dir, "drive_c/windows/system32").mkdirs()
        File(dir, "drive_c/Program Files").mkdirs()

        val userReg = File(dir, "user.reg")
        if (!userReg.exists()) {
            userReg.writeText(
                """
                WINE REGISTRY Version 2
                [Software\\Wine\\Drivers]
                "Audio"="pulse"
                [Software\\Wine]
                "Version"="$winVersion"
                """.trimIndent()
            )
        }
        return dir
    }

    fun deletePrefix(prefixId: String): Boolean {
        val target = File(prefixesDir(), prefixId)
        return target.exists() && target.deleteRecursively()
    }
}
