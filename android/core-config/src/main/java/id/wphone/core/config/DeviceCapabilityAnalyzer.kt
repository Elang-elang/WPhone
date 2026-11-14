package id.wphone.core.config

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.StatFs
import kotlinx.serialization.Serializable

@Serializable
enum class EasyProfile { LIGHT, MEDIUM, ADVANCED }

@Serializable
enum class GraphicsBackend { TURNIP_DXVK, SYSTEM_VULKAN_DXVK, VKD3D_PROTON, WINED3D_VIRGL }

@Serializable
enum class AudioBackend { PULSE_OPENSL_ES, PULSE_AAUDIO, ALSA_NULL }

@Serializable
enum class WinArch { X86, X64 }

@Serializable
data class LegacyMemoryBudget(
    val isSubAndroid10: Boolean,
    val isLowRamMode: Boolean,
    val maxVirtualResolution: String,
    val box64Mmap32: Boolean,
    val box64BigBlock: Int,
    val enableEsync: Boolean,
    val estimatedContainerCapMb: Long
)

@Serializable
data class DeviceCapabilities(
    val socModel: String,
    val primaryAbi: String,
    val supportsArm64: Boolean,
    val totalRamMb: Long,
    val freeStorageGb: Double,
    val androidSdk: Int,
    val hasVulkanHardware: Boolean,
    val gpuVendorHint: String,
    val recommendedProfile: EasyProfile,
    val recommendedGraphics: GraphicsBackend,
    val recommendedAudio: AudioBackend,
    val memoryBudget: LegacyMemoryBudget,
    val compatibilityWarnings: List<String>
)

@Serializable
data class WindowsAppConfig(
    val id: String,
    val name: String,
    val category: String,
    val executablePath: String,
    val arguments: String = "",
    val workingDirectory: String,
    val arch: WinArch = WinArch.X64,
    val prefixId: String,
    val graphicsBackend: GraphicsBackend = GraphicsBackend.WINED3D_VIRGL,
    val audioBackend: AudioBackend = AudioBackend.PULSE_OPENSL_ES,
    val resolution: String = "1280x720",
    val dpi: Int = 120,
    val envVars: Map<String, String> = emptyMap(),
    val keyboardMode: String = "desktop",
    val dependencies: List<String> = emptyList(),
    val sha256: String = ""
)

class DeviceCapabilityAnalyzer(private val context: Context) {

    fun analyze(): DeviceCapabilities {
        val abis = Build.SUPPORTED_ABIS.toList()
        val supportsArm64 = abis.contains("arm64-v8a")

        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val totalRamMb = memInfo.totalMem / (1024L * 1024L)
        val isLowRam = am.isLowRamDevice || totalRamMb <= 4096L
        val isSubAndroid10 = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q

        val stat = StatFs(context.filesDir.absolutePath)
        val freeStorageGb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)

        val hasVulkan = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_VULKAN_HARDWARE_VERSION)

        val socTag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Build.SOC_MODEL
        } else {
            Build.BOARD
        }
        val hardware = "${Build.HARDWARE} $socTag ${Build.MODEL}".lowercase()
        val isQualcomm = hardware.contains("qcom") || hardware.contains("sm") ||
            hardware.contains("msm") || hardware.contains("sdm") || hardware.contains("adreno")

        val warnings = mutableListOf<String>()
        if (!supportsArm64) {
            warnings += "ARM64 ABI missing: Wine WoW64 + Box64 requires an arm64-v8a Android host."
        }
        if (isSubAndroid10) {
            warnings += "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}): Lightweight Sub-Android 10 Mode active (OpenSL ES + VirGL fallback + memory cap)."
        }
        if (isLowRam) {
            warnings += "Low RAM ($totalRamMb MB): Light profile enforced; DXVK/VKD3D shader caches disabled to prevent LMK kills."
        }
        if (!isQualcomm) {
            warnings += "Non-Adreno GPU detected: Mesa Turnip is unsupported; VirGL/GLES or System Vulkan selected."
        }

        val recommendedProfile = when {
            isLowRam || isSubAndroid10 -> EasyProfile.LIGHT
            totalRamMb >= 7500L && isQualcomm && hasVulkan -> EasyProfile.ADVANCED
            totalRamMb >= 5000L && hasVulkan -> EasyProfile.MEDIUM
            else -> EasyProfile.LIGHT
        }

        val recommendedGraphics = when {
            isLowRam || !hasVulkan || Build.VERSION.SDK_INT < Build.VERSION_CODES.P -> GraphicsBackend.WINED3D_VIRGL
            isQualcomm && hasVulkan -> GraphicsBackend.TURNIP_DXVK
            hasVulkan -> GraphicsBackend.SYSTEM_VULKAN_DXVK
            else -> GraphicsBackend.WINED3D_VIRGL
        }

        val recommendedAudio = if (isLowRam || Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) {
            AudioBackend.PULSE_OPENSL_ES
        } else {
            AudioBackend.PULSE_AAUDIO
        }

        val budget = LegacyMemoryBudget(
            isSubAndroid10 = isSubAndroid10,
            isLowRamMode = isLowRam,
            maxVirtualResolution = if (isLowRam || isSubAndroid10) "960x540" else "1280x720",
            box64Mmap32 = isLowRam || isSubAndroid10,
            box64BigBlock = if (isLowRam) 1 else 2,
            enableEsync = !isSubAndroid10 && !isLowRam,
            estimatedContainerCapMb = (totalRamMb * (if (isLowRam) 0.45 else 0.65)).toLong().coerceAtLeast(512L)
        )

        return DeviceCapabilities(
            socModel = "${Build.MANUFACTURER} ${Build.MODEL} (${Build.HARDWARE})",
            primaryAbi = abis.firstOrNull() ?: "unknown",
            supportsArm64 = supportsArm64,
            totalRamMb = totalRamMb,
            freeStorageGb = freeStorageGb,
            androidSdk = Build.VERSION.SDK_INT,
            hasVulkanHardware = hasVulkan,
            gpuVendorHint = if (isQualcomm) "Qualcomm Adreno" else "Mali / PowerVR / Other",
            recommendedProfile = recommendedProfile,
            recommendedGraphics = recommendedGraphics,
            recommendedAudio = recommendedAudio,
            memoryBudget = budget,
            compatibilityWarnings = warnings
        )
    }
}
