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
    val subsystem: String,
    val sha256: String,
    val notes: String
)

enum class DllOverrideMode(val wineCode: String, val regValue: String) {
    NATIVE_BUILTIN("n,b", "native,builtin"),
    BUILTIN_NATIVE("b,n", "builtin,native"),
    NATIVE_ONLY("n", "native"),
    BUILTIN_ONLY("b", "builtin"),
    DISABLED("", "");

    companion object {
        fun fromRegValue(value: String): DllOverrideMode {
            val clean = value.trim().lowercase()
            return when (clean) {
                "native,builtin", "n,b" -> NATIVE_BUILTIN
                "builtin,native", "b,n" -> BUILTIN_NATIVE
                "native", "n" -> NATIVE_ONLY
                "builtin", "b" -> BUILTIN_ONLY
                else -> DISABLED
            }
        }
    }
}

/**
 * Structured Wine Registry Version 2 hive parser/serializer for user.reg.
 * Manages real DLL overrides, Windows version impersonation, Direct3D/VirGL tuning, and audio drivers.
 */
data class WineRegistryHive(
    val winVersion: String = "win10",
    val audioDriver: String = "pulse",
    val directDrawRenderer: String = "opengl",
    val videoMemoryMb: Int = 512,
    val csmtEnabled: Boolean = true,
    val dllOverrides: MutableMap<String, DllOverrideMode> = linkedMapOf()
) {
    fun toWineDllOverridesEnv(): String {
        return dllOverrides.entries.joinToString(";") { (dll, mode) ->
            "${dll}=${mode.wineCode}"
        }
    }

    fun serializeUserReg(appName: String): String {
        val sb = StringBuilder()
        sb.appendLine("WINE REGISTRY Version 2")
        sb.appendLine(";; Isolated prefix hive for $appName")
        sb.appendLine()
        sb.appendLine("[Software\\\\Wine]")
        sb.appendLine("\"Version\"=\"$winVersion\"")
        sb.appendLine()
        sb.appendLine("[Software\\\\Wine\\\\Drivers]")
        sb.appendLine("\"Audio\"=\"$audioDriver\"")
        sb.appendLine()
        sb.appendLine("[Software\\\\Wine\\\\Direct3D]")
        sb.appendLine("\"DirectDrawRenderer\"=\"$directDrawRenderer\"")
        sb.appendLine("\"VideoMemorySize\"=\"$videoMemoryMb\"")
        sb.appendLine("\"csmt\"=dword:${if (csmtEnabled) "00000001" else "00000000"}")
        sb.appendLine()
        sb.appendLine("[Software\\\\Wine\\\\DllOverrides]")
        dllOverrides.forEach { (dll, mode) ->
            sb.appendLine("\"$dll\"=\"${mode.regValue}\"")
        }
        return sb.toString()
    }

    companion object {
        fun parseUserReg(raw: String): WineRegistryHive {
            var winVer = "win10"
            var audio = "pulse"
            var ddRenderer = "opengl"
            var vram = 512
            var csmt = true
            val overrides = linkedMapOf<String, DllOverrideMode>()

            var currentSection = ""
            raw.lineSequence().forEach { rawLine ->
                val line = rawLine.trim()
                if (line.isEmpty() || line.startsWith(";") || line.startsWith("WINE REGISTRY")) return@forEach
                if (line.startsWith("[") && line.endsWith("]")) {
                    currentSection = line.substring(1, line.length - 1).lowercase()
                    return@forEach
                }
                val eq = line.indexOf('=')
                if (eq <= 0) return@forEach
                val key = line.substring(0, eq).trim().trim('"')
                val valRaw = line.substring(eq + 1).trim().trim('"')

                when {
                    currentSection == "software\\\\wine" && key.equals("Version", true) -> winVer = valRaw
                    currentSection == "software\\\\wine\\\\drivers" && key.equals("Audio", true) -> audio = valRaw
                    currentSection == "software\\\\wine\\\\direct3d" -> when (key.lowercase()) {
                        "directdrawrenderer" -> ddRenderer = valRaw
                        "videomemorysize" -> vram = valRaw.toIntOrNull() ?: 512
                        "csmt" -> csmt = !valRaw.endsWith("00000000")
                    }
                    currentSection == "software\\\\wine\\\\dlloverrides" -> {
                        overrides[key] = DllOverrideMode.fromRegValue(valRaw)
                    }
                }
            }

            return WineRegistryHive(
                winVersion = winVer,
                audioDriver = audio,
                directDrawRenderer = ddRenderer,
                videoMemoryMb = vram,
                csmtEnabled = csmt,
                dllOverrides = overrides
            )
        }
    }
}

/**
 * Pure Kotlin Windows PE32 / PE32+ binary inspector (Android API 24+ compatible).
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
            return PeHeaderResult(false, null, "N/A", false, "Unknown", sha256, "File too small for DOS header.")
        }

        RandomAccessFile(file, "r").use { raf ->
            val dos = ByteArray(0x40)
            raf.readFully(dos)
            if (dos[0] != 0x4D.toByte() || dos[1] != 0x5A.toByte()) {
                return PeHeaderResult(false, null, "N/A", false, "Unknown", sha256, "Missing MZ signature.")
            }

            val peOffset = ByteBuffer.wrap(dos, 0x3C, 4).order(ByteOrder.LITTLE_ENDIAN).int.toLong()
            if (peOffset < 0 || peOffset + 96 >= file.length()) {
                return PeHeaderResult(false, null, "MZ-ONLY", false, "Unknown", sha256, "Incomplete or invalid PE header offset.")
            }

            raf.seek(peOffset)
            val peHeader = ByteArray(96)
            raf.readFully(peHeader)
            if (peHeader[0] != 0x50.toByte() || peHeader[1] != 0x45.toByte() ||
                peHeader[2] != 0.toByte() || peHeader[3] != 0.toByte()
            ) {
                return PeHeaderResult(false, null, "N/A", false, "Unknown", sha256, "Invalid PE\\0\\0 signature.")
            }

            val bb = ByteBuffer.wrap(peHeader).order(ByteOrder.LITTLE_ENDIAN)
            val machine = bb.getShort(4).toInt() and 0xFFFF
            val optMagic = bb.getShort(24).toInt() and 0xFFFF
            val subsystemVal = bb.getShort(24 + 68).toInt() and 0xFFFF

            val arch = when (machine) {
                0x014C -> WinArch.X86
                0x8664 -> WinArch.X64
                else -> null
            }
            val subsystem = when (subsystemVal) {
                2 -> "Windows GUI"
                3 -> "Windows CUI (Console)"
                else -> "Subsystem #$subsystemVal"
            }

            return PeHeaderResult(
                validPe = true,
                arch = arch,
                machineHex = "0x%04x".format(machine),
                isPe32Plus = optMagic == 0x20B,
                subsystem = subsystem,
                sha256 = sha256,
                notes = if (arch != null) {
                    "Valid ${arch.name} ($subsystem) PE binary routed to Wine WoW64 + Box64."
                } else {
                    "Unsupported PE machine type 0x%04x.".format(machine)
                }
            )
        }
    }
}

class PrefixManager(private val wphoneRoot: File) {

    fun prefixesDir(): File = File(wphoneRoot, "prefixes").apply { mkdirs() }

    fun ensurePrefix(
        prefixId: String,
        appName: String = prefixId,
        winVersion: String = "win10",
        isLegacyLowRam: Boolean = false
    ): File {
        val dir = File(prefixesDir(), prefixId)
        File(dir, "drive_c/windows/system32").mkdirs()
        File(dir, "drive_c/Program Files").mkdirs()
        File(dir, "drive_c/users/wphone").mkdirs()

        val userReg = File(dir, "user.reg")
        if (!userReg.exists()) {
            val hive = WineRegistryHive(
                winVersion = winVersion,
                audioDriver = "pulse",
                directDrawRenderer = "opengl",
                videoMemoryMb = if (isLegacyLowRam) 256 else 1024,
                csmtEnabled = !isLegacyLowRam
            )
            userReg.writeText(hive.serializeUserReg(appName))
        }
        return dir
    }

    fun readRegistry(prefixId: String): WineRegistryHive {
        val userReg = File(File(prefixesDir(), prefixId), "user.reg")
        if (!userReg.exists()) return WineRegistryHive()
        return WineRegistryHive.parseUserReg(userReg.readText())
    }

    fun writeRegistry(prefixId: String, appName: String, hive: WineRegistryHive) {
        val dir = ensurePrefix(prefixId, appName, hive.winVersion)
        File(dir, "user.reg").writeText(hive.serializeUserReg(appName))
    }

    fun deletePrefix(prefixId: String): Boolean {
        val target = File(prefixesDir(), prefixId)
        return target.exists() && target.deleteRecursively()
    }
}
