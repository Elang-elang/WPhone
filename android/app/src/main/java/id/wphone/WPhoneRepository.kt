package id.wphone

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import id.wphone.core.config.DeviceCapabilities
import id.wphone.core.config.DeviceCapabilityAnalyzer
import id.wphone.core.config.EasyProfile
import id.wphone.core.config.InputOverlayPreset
import id.wphone.core.config.OrientationMode
import id.wphone.core.config.ThemeMode
import id.wphone.core.config.WinArch
import id.wphone.core.config.WindowsAppConfig
import id.wphone.core.prefix.PeHeaderInspector
import id.wphone.core.prefix.PeHeaderResult
import id.wphone.core.prefix.PrefixManager
import id.wphone.core.prefix.WineRegistryHive
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class PersistedAppState(
    val initialized: Boolean = false,
    val selectedProfile: EasyProfile = EasyProfile.LIGHT,
    val themeMode: ThemeMode = ThemeMode.DARK,
    val orientationMode: OrientationMode = OrientationMode.DYNAMIC_AUTO,
    val globalBox64SafeMode: Boolean = false,
    val inputPreset: InputOverlayPreset = InputOverlayPreset(),
    val apps: List<WindowsAppConfig> = emptyList()
)

class WPhoneRepository(
    private val context: Context,
    private val wphoneRoot: File,
    private val prefixManager: PrefixManager,
    private val analyzer: DeviceCapabilityAnalyzer
) {
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = true; encodeDefaults = true }
    private val stateFile = File(File(wphoneRoot, "config"), "wphone_state.json")

    fun loadState(caps: DeviceCapabilities): PersistedAppState {
        if (stateFile.exists()) {
            runCatching {
                val loaded = json.decodeFromString<PersistedAppState>(stateFile.readText())
                val hasBuiltInNotepad = loaded.apps.any { it.id == "wine-notepad" }
                val upgradedApps = if (!hasBuiltInNotepad) {
                    listOf(builtInWineNotepad(caps)) + loaded.apps
                } else {
                    loaded.apps
                }
                val upgradedPreset = if (loaded.inputPreset.buttons.isEmpty()) {
                    InputOverlayPreset()
                } else {
                    loaded.inputPreset
                }
                val upgraded = loaded.copy(apps = upgradedApps, inputPreset = upgradedPreset)
                if (!hasBuiltInNotepad || loaded.inputPreset.buttons.isEmpty()) {
                    saveState(upgraded)
                }
                return upgraded
            }
        }
        val initial = PersistedAppState(
            initialized = false,
            selectedProfile = caps.recommendedProfile,
            themeMode = ThemeMode.DARK,
            orientationMode = OrientationMode.DYNAMIC_AUTO,
            globalBox64SafeMode = false,
            inputPreset = InputOverlayPreset(),
            apps = defaultCatalogApps(caps)
        )
        saveState(initial)
        return initial
    }

    fun saveState(state: PersistedAppState) {
        stateFile.parentFile?.mkdirs()
        stateFile.writeText(json.encodeToString(state))
    }

    fun isAppExecutableReady(app: WindowsAppConfig, wineRootfsDir: File): Boolean {
        if (app.id == "wine-notepad") {
            return File(wineRootfsDir, "opt/wine/bin/wine").exists() ||
                File(wineRootfsDir, "opt/wine/bin/wine64").exists()
        }
        val cleanRel = app.executablePath
            .removePrefix("C:\\")
            .removePrefix("c:\\")
            .replace('\\', '/')
        if (app.executablePath.startsWith("Z:", ignoreCase = true)) {
            return File(app.executablePath.substring(2)).exists()
        }
        val inPrefix = File(File(prefixManager.prefixesDir(), app.prefixId), "drive_c/$cleanRel")
        return inPrefix.exists()
    }

    fun copyUriToImports(uri: Uri): Pair<File, String> {
        val displayName = resolveDisplayName(uri) ?: "imported_${System.currentTimeMillis()}.bin"
        val safeName = displayName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val dest = File(File(wphoneRoot, "imports").apply { mkdirs() }, safeName)
        context.contentResolver.openInputStream(uri)?.use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        } ?: error("Cannot open selected document URI")
        return dest to safeName
    }

    fun registerWindowsBinary(
        file: File,
        displayName: String,
        caps: DeviceCapabilities,
        state: PersistedAppState
    ): Pair<PersistedAppState, PeHeaderResult> {
        val pe = PeHeaderInspector.inspect(file)
        val cleanName = displayName.substringBeforeLast('.')
        val appId = "app-${System.currentTimeMillis()}"
        val prefixId = "pfx-$appId"
        prefixManager.ensurePrefix(
            prefixId = prefixId,
            appName = cleanName,
            winVersion = if (caps.memoryBudget.isLowRamMode) "win7" else "win10",
            isLegacyLowRam = caps.memoryBudget.isLowRamMode
        )

        val newEntry = WindowsAppConfig(
            id = appId,
            name = cleanName,
            category = "Utilities",
            executablePath = "Z:${file.absolutePath}",
            workingDirectory = file.parent ?: wphoneRoot.absolutePath,
            arch = pe.arch ?: WinArch.X64,
            prefixId = prefixId,
            graphicsBackend = caps.recommendedGraphics,
            audioBackend = caps.recommendedAudio,
            resolution = caps.memoryBudget.maxVirtualResolution,
            dpi = if (caps.memoryBudget.isLowRamMode) 96 else 120,
            sha256 = pe.sha256
        )
        val next = state.copy(apps = state.apps + newEntry)
        saveState(next)
        return next to pe
    }

    fun readPrefixHive(prefixId: String): WineRegistryHive = prefixManager.readRegistry(prefixId)

    fun savePrefixHive(prefixId: String, appName: String, hive: WineRegistryHive) {
        prefixManager.writeRegistry(prefixId, appName, hive)
    }

    private fun resolveDisplayName(uri: Uri): String? {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (idx >= 0) return cursor.getString(idx)
                }
            }
        return uri.lastPathSegment
    }

    private fun builtInWineNotepad(caps: DeviceCapabilities): WindowsAppConfig {
        prefixManager.ensurePrefix("pfx-notepad", "Wine Notepad", "win10", caps.memoryBudget.isLowRamMode)
        return WindowsAppConfig(
            id = "wine-notepad",
            name = "Wine Notepad (Built-in)",
            category = "Utilities",
            executablePath = "C:\\windows\\system32\\notepad.exe",
            workingDirectory = "C:\\windows\\system32",
            arch = WinArch.X64,
            prefixId = "pfx-notepad",
            graphicsBackend = caps.recommendedGraphics,
            audioBackend = caps.recommendedAudio,
            resolution = caps.memoryBudget.maxVirtualResolution,
            keyboardMode = "desktop"
        )
    }

    private fun defaultCatalogApps(caps: DeviceCapabilities): List<WindowsAppConfig> {
        prefixManager.ensurePrefix("pfx-notepadpp", "Notepad++ Portable", "win10", caps.memoryBudget.isLowRamMode)
        return listOf(
            builtInWineNotepad(caps),
            WindowsAppConfig(
                id = "notepadpp",
                name = "Notepad++ Portable (x64)",
                category = "Utilities",
                executablePath = "C:\\Program Files\\Notepad++\\notepad++.exe",
                workingDirectory = "C:\\Program Files\\Notepad++",
                arch = WinArch.X64,
                prefixId = "pfx-notepadpp",
                graphicsBackend = caps.recommendedGraphics,
                audioBackend = caps.recommendedAudio,
                resolution = caps.memoryBudget.maxVirtualResolution,
                keyboardMode = "desktop"
            )
        )
    }
}
