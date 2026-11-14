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
enum class WinArch { X86, X64 }

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
    val graphicsBackend: GraphicsBackend = GraphicsBackend.SYSTEM_VULKAN_DXVK,
    val resolution: String = "1280x720",
    val dpi: Int = 120,
    val envVars: Map<String, String> = emptyMap(),
    val keyboardMode: String = "desktop",
    val dependencies: List<String> = emptyList()
)

class DeviceCapabilityAnalyzer(private val context: Context) {

    fun analyze(): DeviceCapabilities {
        val abis = Build.SUPPORTED_ABIS.toList()
        val supportsArm64 = abis.contains("arm64-v8a")

        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val totalRamMb = memInfo.totalMem / (1024L * 1024L)

        val stat = StatFs(context.filesDir.absolutePath)
        val freeStorageGb = (stat.availableBlocksLong * stat.blockSizeLong) / (1024.0 * 1024.0 * 1024.0)

        val hasVulkan = context.packageManager.hasSystemFeature(PackageManager.FEATURE_VULKAN_HARDWARE_VERSION)
        val hardware = "${Build.HARDWARE} ${Build.SOC_MODEL}".lowercase()
        val isQualcomm = hardware.contains("qcom") || hardware.contains("sm") || hardware.contains("adreno")

        val warnings = mutableListOf<String>()
        if (!supportsArm64) {
            warnings += "ARM64 ABI missing: Wine WoW64 + Box64 requires an arm64-v8a Android host."
        }
        if (totalRamMb < 4500L) {
            warnings += "RAM <= 4 GB detected: Light profile recommended; avoid VKD3D-Proton DX12."
        }
        if (!isQualcomm) {
            warnings += "Non-Adreno GPU detected: Mesa Turnip is unsupported; use System Vulkan or VirGL."
        }

        val recommendedProfile = when {
            totalRamMb >= 7500L && isQualcomm && hasVulkan -> EasyProfile.ADVANCED
            totalRamMb >= 5000L && hasVulkan -> EasyProfile.MEDIUM
            else -> EasyProfile.LIGHT
        }

        val recommendedGraphics = when {
            isQualcomm && hasVulkan -> GraphicsBackend.TURNIP_DXVK
            hasVulkan -> GraphicsBackend.SYSTEM_VULKAN_DXVK
            else -> GraphicsBackend.WINED3D_VIRGL
        }

        return DeviceCapabilities(
            socModel = "${Build.MANUFACTURER} ${Build.MODEL} (${Build.HARDWARE})",
            primaryAbi = abis.firstOrNull() ?: "unknown",
            supportsArm64 = supportsArm64,
            totalRamMb = totalRamMb,
            freeStorageGb = freeStorageGb,
            androidSdk = Build.VERSION.SDK_INT,
            hasVulkanHardware = hasVulkan,
            gpuVendorHint = if (isQualcomm) "Qualcomm Adreno (Turnip candidate)" else "OEM / Mali / Other",
            recommendedProfile = recommendedProfile,
            recommendedGraphics = recommendedGraphics,
            compatibilityWarnings = warnings
        )
    }
}
